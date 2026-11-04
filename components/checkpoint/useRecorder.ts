"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Transcript } from "@/lib/card/types";
import { fromChunks, type SpeechChunk } from "@/lib/checkpoint/transcript";

export type Mode = "video" | "voice" | "text";

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(): void;
  stop(): void;
};

function speechCtor(): (new () => SpeechRec) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const speechSupported = () => !!speechCtor();

export type Recording = { blob?: Blob; durationS: number; transcript: Transcript; mimeType?: string };

/**
 * Records video+mic or mic only with MediaRecorder, and transcribes with the browser's speech
 * recognition when available (no API keys). Exposes a live mic level for the waveform (C4.4).
 * Nothing about the face or voice is analysed beyond the words (F1).
 */
export function useRecorder() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const speech = useRef<SpeechRec | null>(null);
  const speechChunks = useRef<SpeechChunk[]>([]);
  const t0 = useRef(0);
  const lastEnd = useRef(0);
  const raf = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** Ask for devices ahead of time (device check, or the think window) so answering starts instantly. */
  const prepare = useCallback(async (mode: Mode): Promise<MediaStream | null> => {
    if (mode === "text") return null;
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" ? { width: 640, height: 360 } : false });
      setStream(s);
      try {
        const ctx = new AudioContext();
        audioCtx.current = ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Level meter is optional.
      }
      return s;
    } catch (e) {
      setError(e instanceof Error && e.name === "NotAllowedError" ? "denied" : "unavailable");
      return null;
    }
  }, []);

  const start = useCallback(
    (s: MediaStream) => {
      chunks.current = [];
      speechChunks.current = [];
      t0.current = performance.now();
      lastEnd.current = 0;
      try {
        const r = new MediaRecorder(s);
        r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        r.start(1000);
        rec.current = r;
      } catch {
        rec.current = null;
      }
      const Ctor = speechCtor();
      if (Ctor) {
        try {
          const sr = new Ctor();
          sr.continuous = true;
          sr.interimResults = false;
          sr.lang = "en-CA";
          sr.onresult = (e) => {
            const now = (performance.now() - t0.current) / 1000;
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const res = e.results[i];
              if (!res.isFinal) continue;
              const text = res[0].transcript.trim();
              if (!text) continue;
              const est = Math.max(0.6, text.split(/\s+/).length / 2.6);
              const startS = Math.max(lastEnd.current, now - est);
              speechChunks.current.push({ text, startS, endS: now });
              lastEnd.current = now;
            }
          };
          sr.onerror = () => {};
          sr.onend = null;
          sr.start();
          speech.current = sr;
        } catch {
          speech.current = null;
        }
      }
    },
    [],
  );

  const stop = useCallback(async (): Promise<Recording> => {
    const durationS = +((performance.now() - t0.current) / 1000).toFixed(2);
    const r = rec.current;
    const blob = await new Promise<Blob | undefined>((resolve) => {
      if (!r || r.state === "inactive") return resolve(chunks.current.length ? new Blob(chunks.current) : undefined);
      r.onstop = () => resolve(new Blob(chunks.current, { type: r.mimeType }));
      r.stop();
    });
    const sr = speech.current;
    if (sr) {
      // Give recognition a moment to deliver its last final result.
      await new Promise<void>((resolve) => {
        const done = setTimeout(resolve, 1500);
        sr.onend = () => {
          clearTimeout(done);
          resolve();
        };
        try {
          sr.stop();
        } catch {
          clearTimeout(done);
          resolve();
        }
      });
    }
    speech.current = null;
    rec.current = null;
    return { blob, durationS, transcript: fromChunks(speechChunks.current), mimeType: r?.mimeType };
  }, []);

  return { stream, level, error, prepare, start, stop, release: cleanup };
}
