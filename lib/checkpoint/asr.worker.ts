/// <reference lib="webworker" />
// Runs the on-device Whisper model off the main thread, so recording, the camera preview and the timer never
// stall while captions are worked out. Messages: { id, warm: true } or { id, audio, opts } -> { id, ok, out | error }.

import { env, pipeline } from "@huggingface/transformers";

const MODEL = "onnx-community/whisper-tiny.en";
type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<unknown>;
let loading: Promise<Asr> | null = null;

function load(threads: number): Promise<Asr> {
  loading ??= (async () => {
    env.allowLocalModels = false;
    const wasm = env.backends?.onnx?.wasm as { numThreads?: number } | undefined;
    if (wasm) wasm.numThreads = threads;
    return (await pipeline("automatic-speech-recognition", MODEL, { dtype: "q8", device: "wasm" })) as unknown as Asr;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

self.onmessage = async (e: MessageEvent<{ id: number; warm?: boolean; audio?: Float32Array; opts?: Record<string, unknown>; threads: number }>) => {
  const { id, warm, audio, opts, threads } = e.data;
  try {
    const asr = await load(threads);
    if (warm || !audio) return self.postMessage({ id, ok: true });
    const out = await asr(audio, opts ?? {});
    self.postMessage({ id, ok: true, out });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
