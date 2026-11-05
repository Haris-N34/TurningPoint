// On-device speech to text for when the browser's live speech recognition hears nothing
// (Chromium builds without Google's speech service, Brave, Firefox, a dropped connection).
// A small Whisper model runs in the browser (transformers.js, WebAssembly). The audio never leaves
// the device and no key is needed: the model files are fetched once from huggingface.co and cached
// by the browser. Only the words are used, never the voice itself.

import type { SpeechChunk } from "./transcript";

export const ASR_MODEL = "onnx-community/whisper-tiny.en";

type AsrOutput = { text: string; chunks?: { text: string; timestamp: [number, number | null] }[] };
type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<AsrOutput>;

/** Tests swap the model for a stub (window.__tpLocalAsr). */
type Hook = (audio: Float32Array) => Promise<AsrOutput>;

let loading: Promise<Asr> | undefined;

function load(): Promise<Asr> {
  // Loaded only when needed, in its own chunk, so pages that never record don't pay for it.
  loading ??= import("@huggingface/transformers")
    .then((tf) => {
      tf.env.allowLocalModels = false;
      return tf.pipeline("automatic-speech-recognition", ASR_MODEL, { dtype: "q8", device: "wasm" }) as unknown as Promise<Asr>;
    })
    .catch((e) => {
      loading = undefined; // let a later answer try again
      throw e;
    });
  return loading;
}

/** Start fetching the model early (during the answer) so the transcript is ready sooner. */
export function warmLocalAsr() {
  if (typeof window === "undefined" || (window as unknown as { __tpLocalAsr?: Hook }).__tpLocalAsr) return;
  void load().catch(() => {});
}

/** Decode a recording to 16 kHz mono, the rate Whisper expects. */
export async function decodeTo16k(blob: Blob): Promise<Float32Array> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (buf.numberOfChannels === 1) return buf.getChannelData(0);
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) buf.getChannelData(c).forEach((v, i) => (out[i] += v / buf.numberOfChannels));
    return out;
  } finally {
    void ctx.close().catch(() => {});
  }
}

// Whisper marks silence and noise in brackets, and sometimes invents a polite sign-off on silence.
const NOISE = /\[[^\]]*\]|\([^)]*\)|♪/g;
export function cleanAsrText(t: string) {
  return t.replace(NOISE, " ").replace(/\s+/g, " ").trim();
}

/** Turn the model's timed chunks into transcript chunks (seconds from the answer start). */
export function toChunks(out: AsrOutput, durationS: number): SpeechChunk[] {
  const parts = out.chunks?.length ? out.chunks : [{ text: out.text, timestamp: [0, durationS] as [number, number | null] }];
  return parts
    .map((c) => ({ text: cleanAsrText(c.text), startS: c.timestamp[0] ?? 0, endS: c.timestamp[1] ?? durationS }))
    .filter((c) => c.text);
}

const PAD = 8000; // 0.5 s at 16 kHz

function shift(out: AsrOutput, by: number): AsrOutput {
  const t = (v: number | null) => (v === null ? null : Math.max(0, +(v + by).toFixed(2)));
  return { text: out.text, chunks: out.chunks?.map((c) => ({ text: c.text, timestamp: [t(c.timestamp[0]) ?? 0, t(c.timestamp[1])] })) };
}

/** Transcribe a recording on this device. Rejects if the model can't load (offline, very old browser). */
export async function transcribeLocally(blob: Blob, durationS: number): Promise<SpeechChunk[]> {
  const audio = await decodeTo16k(blob);
  const hook = (window as unknown as { __tpLocalAsr?: Hook }).__tpLocalAsr;
  if (hook) return toChunks(await hook(audio), durationS);
  const asr = await load();
  // Whisper's timestamp mode can return nothing when speech starts at the very first sample:
  // lead in with half a second of silence (and shift the times back), then retry without timestamps.
  const padded = new Float32Array(PAD + audio.length);
  padded.set(audio, PAD);
  const timed = await asr(padded, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
  if (cleanAsrText(timed.text)) return toChunks(shift(timed, -PAD / 16000), durationS);
  const plain = await asr(padded, { chunk_length_s: 30, stride_length_s: 5 });
  return toChunks({ text: plain.text }, durationS);
}
