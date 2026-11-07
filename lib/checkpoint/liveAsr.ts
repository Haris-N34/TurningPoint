// Live on-device captions: when the browser's own speech recognition gives no words, the small Whisper model
// (lib/checkpoint/localAsr.ts) transcribes the microphone audio while the candidate is still talking.
// Every pass re-reads the audio since the last committed point, so words appear within a second or two and
// earlier words can still be corrected as more context arrives. Long answers are committed in pieces at a
// quiet moment, so each pass stays short. Audio stays on this device and is never saved by this module.

import type { SpeechChunk } from "./transcript";
import { cleanAsrText, runAsr } from "./localAsr";

const RATE = 16000;
/** Commit the window once it is this long, at the quietest moment in its last few seconds. */
const COMMIT_AFTER_S = 8;
/** Minimum gap between passes; a pass that runs longer simply delays the next one. */
const MIN_GAP_MS = 400;

/** Pure: downsample float audio to 16 kHz by averaging (the input rate is usually 44.1 or 48 kHz). */
export function downsample(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === RATE) return input;
  const ratio = fromRate / RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += input[j];
    out[i] = b > a ? s / (b - a) : 0;
  }
  return out;
}

/** Pure: index of the quietest 200 ms frame between `from` and `to` (sample indexes), for a clean cut. */
export function quietestCut(audio: Float32Array, from: number, to: number): number {
  const frame = RATE / 5;
  let best = to;
  let bestE = Infinity;
  for (let i = Math.max(0, from); i + frame <= to; i += frame / 2) {
    let e = 0;
    for (let j = i; j < i + frame; j++) e += audio[j] * audio[j];
    if (e < bestE) {
      bestE = e;
      best = i + frame / 2;
    }
  }
  return Math.floor(best);
}

/** Pure: a rough level check so pure silence never reaches the model (it can invent words on silence). */
export function hasSpeech(audio: Float32Array): boolean {
  let peak = 0;
  for (let i = 0; i < audio.length; i += 4) peak = Math.max(peak, Math.abs(audio[i]));
  return peak > 0.02;
}

export type LiveAsr = {
  /** Begin transcribing (audio is captured from the moment the controller was created). */
  run: () => void;
  readonly running: boolean;
  /** Stop capturing; transcribe what is left and return the whole answer as timed chunks. */
  finish: () => Promise<SpeechChunk[]>;
  /** Stop and drop everything (the browser's own captions took over, or the answer was cancelled). */
  cancel: () => void;
};

/**
 * Capture `stream`'s audio now; transcribe it live once `run()` is called. `onUpdate(committed, partial)` fires
 * after every pass: committed text is settled, partial is the current guess for the newest words.
 */
export function createLiveAsr(stream: MediaStream, onUpdate: (committed: string, partial: string) => void): LiveAsr | null {
  if (typeof window === "undefined" || !stream.getAudioTracks().length) return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  // ScriptProcessor is deprecated but works everywhere without a separate worklet file.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  const raw: Float32Array[] = [];
  let rawLen = 0;
  proc.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    raw.push(new Float32Array(d));
    rawLen += d.length;
  };
  src.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);

  let pcm = new Float32Array(0); // 16 kHz, everything captured so far
  let pcmFrom = 0; // how many raw samples are already in pcm
  const sync = () => {
    if (rawLen === pcmFrom) return;
    const all = new Float32Array(rawLen - pcmFrom);
    let o = 0;
    let skip = pcmFrom;
    for (const b of raw) {
      if (skip >= b.length) {
        skip -= b.length;
        continue;
      }
      all.set(b.subarray(skip), o);
      o += b.length - skip;
      skip = 0;
    }
    const add = downsample(all, ctx.sampleRate);
    const next = new Float32Array(pcm.length + add.length);
    next.set(pcm);
    next.set(add, pcm.length);
    pcm = next;
    pcmFrom = rawLen;
  };

  let running = false;
  let stopped = false;
  let busy: Promise<void> = Promise.resolve();
  let commitAt = 0; // sample index of the start of the open window
  const committed: SpeechChunk[] = [];
  let partial = "";
  let lastPassEnd = 0;
  const text = () => committed.map((c) => c.text).join(" ");

  const transcribe = async (from: number, to: number) => {
    const w = pcm.subarray(from, to);
    if (w.length < RATE / 2 || !hasSpeech(w)) return "";
    return cleanAsrText((await runAsr(w)).text);
  };

  const pass = async () => {
    sync();
    const end = pcm.length;
    if (end - commitAt > COMMIT_AFTER_S * RATE) {
      const cut = quietestCut(pcm, end - 3 * RATE, end - RATE / 2);
      const t = await transcribe(commitAt, cut);
      if (t) committed.push({ text: t, startS: +(commitAt / RATE).toFixed(2), endS: +(cut / RATE).toFixed(2) });
      commitAt = cut;
    }
    partial = await transcribe(commitAt, end);
    if (!stopped) onUpdate(text(), partial);
  };

  const loop = async () => {
    while (running && !stopped) {
      const wait = MIN_GAP_MS - (performance.now() - lastPassEnd);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (!running || stopped) break;
      busy = pass().catch(() => {});
      await busy;
      lastPassEnd = performance.now();
    }
  };

  const close = () => {
    stopped = true;
    running = false;
    try {
      src.disconnect();
      proc.disconnect();
      mute.disconnect();
    } catch {
      // already disconnected
    }
    void ctx.close().catch(() => {});
  };

  return {
    run: () => {
      if (running || stopped) return;
      running = true;
      void loop();
    },
    get running() {
      return running;
    },
    finish: async () => {
      const wasRunning = running;
      running = false;
      await busy;
      sync();
      stopped = true;
      const end = pcm.length;
      close();
      if (!wasRunning && !committed.length) {
        // Never started live: one pass over everything (still faster than decoding a compressed file).
        const t = await transcribe(0, end).catch(() => "");
        return t ? [{ text: t, startS: 0, endS: +(end / RATE).toFixed(2) }] : [];
      }
      const t = await transcribe(commitAt, end).catch(() => partial);
      const last = t || partial;
      return last ? [...committed, { text: last, startS: +(commitAt / RATE).toFixed(2), endS: +(end / RATE).toFixed(2) }] : [...committed];
    },
    cancel: close,
  };
}
