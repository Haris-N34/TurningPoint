"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Transcript } from "@/lib/card/types";
import { createListener, speechCtor, type SpeechState } from "@/lib/checkpoint/speech";
import { createLiveAsr, type LiveAsr } from "@/lib/checkpoint/liveAsr";
import { warmLocalAsr } from "@/lib/checkpoint/localAsr";
import { pickMime } from "@/lib/checkpoint/recording";
import { fromChunks, type SpeechChunk } from "@/lib/checkpoint/transcript";

export type Mode = "video" | "voice" | "text";
export type { SpeechState };

export const speechSupported = () => !!speechCtor();

// Remember, per browser, that its own live captions gave no words, so the on-device captions start at once next time.
const LOCAL_KEY = "tp:live-captions";
const captionsLocal = () => {
  try {
    return localStorage.getItem(LOCAL_KEY) === "local";
  } catch {
    return false;
  }
};
const rememberLocal = (on: boolean) => {
  try {
    if (on) localStorage.setItem(LOCAL_KEY, "local");
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Private mode: decide again next time.
  }
};
/** Fetch the on-device caption model ahead of an answer (the interview's think time, or game start). */
export const prepareLiveCaptions = () => warmLocalAsr();
/** How long the browser's own captions get to produce a word before the on-device captions take over. */
const BROWSER_GRACE_MS = 1200;

/** audio: an audio-only copy, kept in memory for on-device transcription, never saved. */
export type Recording = { blob?: Blob; audio?: Blob; durationS: number; transcript: Transcript; mimeType?: string };

/** Record a stream to a Blob. Returns a stop function that resolves with the recording. */
function recordTo(s: MediaStream, video: boolean) {
  const parts: Blob[] = [];
  let r: MediaRecorder | null = null;
  try {
    r = new MediaRecorder(s, pickMime(video));
    r.ondataavailable = (e) => e.data.size && parts.push(e.data);
    r.start(1000);
  } catch {
    r = null;
  }
  return {
    mimeType: r?.mimeType,
    stop: () =>
      new Promise<Blob | undefined>((resolve) => {
        if (!r || r.state === "inactive") return resolve(parts.length ? new Blob(parts, r?.mimeType ? { type: r.mimeType } : undefined) : undefined);
        const rr = r;
        rr.onstop = () => resolve(parts.length ? new Blob(parts, { type: rr.mimeType }) : undefined);
        rr.stop();
      }),
  };
}

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
  const rec = useRef<ReturnType<typeof recordTo> | null>(null);
  const audioRec = useRef<ReturnType<typeof recordTo> | null>(null);
  const listener = useRef<ReturnType<typeof createListener> | null>(null);
  const live = useRef<LiveAsr | null>(null);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const browserWords = useRef(false);
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
    if (liveTimer.current) clearTimeout(liveTimer.current);
    live.current?.cancel();
    live.current = null;
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
    speechChunks.current = [];
    t0.current = performance.now();
    lastEnd.current = 0;
    setHeard("");
    setInterim("");
    const video = hasVideoTrack(s);
    rec.current = recordTo(s, video);
    // Video answers also keep an audio-only copy: it is what on-device transcription reads.
    audioRec.current = video && s.getAudioTracks().length ? recordTo(new MediaStream(s.getAudioTracks()), false) : null;
    // On-device captions: audio is captured from the first moment; the model only runs if the browser's own
    // captions stay silent (no speech service, blocked, offline, Firefox). Words then appear while talking.
    browserWords.current = false;
    if (liveTimer.current) clearTimeout(liveTimer.current);
    live.current?.cancel();
    live.current = createLiveAsr(s, (committed, partial) => {
      if (browserWords.current) return;
      setHeard(committed);
      setInterim(partial);
    });
    const goLocal = () => {
      if (!browserWords.current) live.current?.run();
    };
    const browserSpoke = () => {
      if (browserWords.current) return;
      browserWords.current = true;
      // The browser's captions work here: drop the on-device ones.
      if (liveTimer.current) clearTimeout(liveTimer.current);
      live.current?.cancel();
      live.current = null;
      rememberLocal(false);
    };
    const Ctor = speechCtor();
    if (!Ctor) {
      setSpeech({ kind: "unsupported" });
      goLocal();
      return;
    }
    liveTimer.current = setTimeout(goLocal, captionsLocal() ? 0 : BROWSER_GRACE_MS);
    const l = createListener({
      Ctor,
      lang: (typeof navigator !== "undefined" && navigator.language) || "en-US",
      now: () => (performance.now() - t0.current) / 1000,
      onFinal: (text, now) => {
        browserSpoke();
        const est = Math.max(0.6, text.split(/\s+/).length / 2.6);
        const startS = Math.max(lastEnd.current, now - est);
        speechChunks.current.push({ text, startS, endS: Math.max(startS + 0.1, now) });
        lastEnd.current = Math.max(startS + 0.1, now);
        setHeard(speechChunks.current.map((c) => c.text).join(" "));
      },
      onInterim: (t) => {
        if (t) browserSpoke();
        if (browserWords.current) setInterim(t);
      },
      onState: setSpeech,
    });
    listener.current = l;
    l.start();
  }, []);

  const stop = useCallback(async (): Promise<Recording> => {
    const durationS = +((performance.now() - t0.current) / 1000).toFixed(2);
    const r = rec.current;
    const a = audioRec.current;
    const l = listener.current;
    const lv = live.current;
    live.current = null;
    if (liveTimer.current) clearTimeout(liveTimer.current);
    const useLocal = !!lv && !browserWords.current;
    if (lv && !useLocal) lv.cancel();
    const [blob, audio, , local] = await Promise.all([
      r ? r.stop() : Promise.resolve(undefined),
      a ? a.stop() : Promise.resolve(undefined),
      // Give the browser's recognition a moment to deliver its last words (not needed when it never spoke).
      l ? l.stop(browserWords.current ? 1500 : 200) : Promise.resolve(),
      useLocal ? lv.finish().catch(() => [] as SpeechChunk[]) : Promise.resolve([] as SpeechChunk[]),
    ]);
    if (!speechChunks.current.length && local.length) {
      speechChunks.current = local;
      rememberLocal(true);
    }
    listener.current = null;
    rec.current = null;
    audioRec.current = null;
    setInterim("");
    return { blob, audio: audio ?? blob, durationS, transcript: fromChunks(speechChunks.current), mimeType: r?.mimeType };
  }, []);

  return { stream, level, error, speech, interim, heard, prepare, start, stop, release: cleanup, getError: () => errorRef.current };
}
