"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Transcript } from "@/lib/card/types";
import { createListener, speechCtor, type SpeechState } from "@/lib/checkpoint/speech";
import { pickMime } from "@/lib/checkpoint/recording";
import { fromChunks, type SpeechChunk } from "@/lib/checkpoint/transcript";

export type Mode = "video" | "voice" | "text";
export type { SpeechState };

export const speechSupported = () => !!speechCtor();

export type Recording = { blob?: Blob; durationS: number; transcript: Transcript; mimeType?: string };

/** Why the camera or mic could not start, in plain words. */
export type DeviceError = "denied" | "missing" | "busy" | "unavailable";

function deviceError(e: unknown): DeviceError {
  const n = e instanceof Error || (e && typeof e === "object" && "name" in e) ? String((e as { name: string }).name) : "";
  if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError") return "denied";
  if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") return "missing";
  if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") return "busy";
  return "unavailable";
}

const hasVideoTrack = (s: MediaStream) => s.getVideoTracks().length > 0;

/**
 * Records video+mic or mic only with MediaRecorder, and transcribes with the browser's speech
 * recognition when available (no API keys). Recognition restarts by itself until the answer ends,
 * shows interim words live, and reports errors in plain words. Exposes a live mic level (C4.4).
 * Nothing about the face or voice is analysed beyond the words (F1).
 */
export function useRecorder() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<DeviceError | null>(null);
  const [speech, setSpeech] = useState<SpeechState>({ kind: "off" });
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const listener = useRef<ReturnType<typeof createListener> | null>(null);
  const speechChunks = useRef<SpeechChunk[]>([]);
  const t0 = useRef(0);
  const lastEnd = useRef(0);
  const raf = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const errorRef = useRef<DeviceError | null>(null);

  const cleanup = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    void listener.current?.stop(0);
    listener.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const meter = useCallback((s: MediaStream) => {
    if (!s.getAudioTracks().length) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtx.current = ctx;
      // Some browsers start the context suspended until a click; the meter would sit at zero.
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let last = 0;
      const tick = (now: number) => {
        if (now - last > 66) {
          last = now;
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += (v - 128) * (v - 128);
          const rms = Math.sqrt(sum / buf.length) / 128;
          // Perceptual curve with a small noise floor, so normal speech fills about two thirds.
          setLevel(Math.max(0, Math.min(1, (Math.sqrt(rms) - 0.05) * 2)));
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch {
      // Level meter is optional.
    }
  }, []);

  /** Ask for devices ahead of time (camera check, or the think window) so answering starts instantly. */
  const prepare = useCallback(
    async (mode: Mode): Promise<MediaStream | null> => {
      if (mode === "text") return null;
      setError((errorRef.current = null));
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError((errorRef.current = "unavailable"));
        return null;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: mode === "video" ? { width: 640, height: 360 } : false,
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        setStream(s);
        meter(s);
        return s;
      } catch (e) {
        setError((errorRef.current = deviceError(e)));
        return null;
      }
    },
    [meter],
  );

  const start = useCallback((s: MediaStream) => {
    chunks.current = [];
    speechChunks.current = [];
    t0.current = performance.now();
    lastEnd.current = 0;
    setHeard("");
    setInterim("");
    try {
      const r = new MediaRecorder(s, pickMime(hasVideoTrack(s)));
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.start(1000);
      rec.current = r;
    } catch {
      rec.current = null;
    }
    const Ctor = speechCtor();
    if (!Ctor) {
      setSpeech({ kind: "unsupported" });
      return;
    }
    const l = createListener({
      Ctor,
      lang: (typeof navigator !== "undefined" && navigator.language) || "en-US",
      now: () => (performance.now() - t0.current) / 1000,
      onFinal: (text, now) => {
        const est = Math.max(0.6, text.split(/\s+/).length / 2.6);
        const startS = Math.max(lastEnd.current, now - est);
        speechChunks.current.push({ text, startS, endS: Math.max(startS + 0.1, now) });
        lastEnd.current = Math.max(startS + 0.1, now);
        setHeard(speechChunks.current.map((c) => c.text).join(" "));
      },
      onInterim: setInterim,
      onState: setSpeech,
    });
    listener.current = l;
    l.start();
  }, []);

  const stop = useCallback(async (): Promise<Recording> => {
    const durationS = +((performance.now() - t0.current) / 1000).toFixed(2);
    const r = rec.current;
    const l = listener.current;
    const [blob] = await Promise.all([
      new Promise<Blob | undefined>((resolve) => {
        if (!r || r.state === "inactive") return resolve(chunks.current.length ? new Blob(chunks.current, r?.mimeType ? { type: r.mimeType } : undefined) : undefined);
        r.onstop = () => resolve(new Blob(chunks.current, { type: r.mimeType }));
        r.stop();
      }),
      // Give recognition a moment to deliver its last words.
      l ? l.stop(1500) : Promise.resolve(),
    ]);
    listener.current = null;
    rec.current = null;
    setInterim("");
    return { blob, durationS, transcript: fromChunks(speechChunks.current), mimeType: r?.mimeType };
  }, []);

  return { stream, level, error, speech, interim, heard, prepare, start, stop, release: cleanup, getError: () => errorRef.current };
}
