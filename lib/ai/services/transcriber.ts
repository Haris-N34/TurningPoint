import { TranscriptSchema, type Transcript } from "@/lib/card/types";
import { fromChunks, type SpeechChunk } from "@/lib/checkpoint/transcript";
import type { PromptDef } from "../prompts/types";
import { runSync, type RunOptions } from "../run";

// Transcriber (PRD v2 B2): speech to text with word timestamps after each answer. In the demo the browser's
// own speech recognition hears the answer while it is recorded (components/checkpoint/useRecorder.ts); this
// service turns what it heard into a timed transcript, retries once, then marks the transcript "pending".
// Audio never goes to a language model.

export type TranscribeInput = { chunks: SpeechChunk[] };

export const PENDING: Transcript = { text: "", words: [], status: "pending" };

export const transcriberPrompt: PromptDef<TranscribeInput, Transcript> = {
  id: "transcriber",
  version: "1.0.0",
  service: "Transcriber",
  tier: "fast",
  localOnly: true,
  system: "Browser speech recognition; never sent to a language model.",
  render: () => "",
  schema: TranscriptSchema as unknown as PromptDef<TranscribeInput, Transcript>["schema"],
  local: (i) => fromChunks(i.chunks),
  fallback: () => PENDING,
  check: (o) => (o.words.some((w, k) => w.end < w.start || (k > 0 && w.start < o.words[k - 1].start)) ? "word times out of order" : undefined),
  fixtures: [
    { name: "two phrases", input: { chunks: [{ text: "I moved the launch", startS: 0, endS: 2 }, { text: "because the vendors needed time", startS: 2.5, endS: 5 }] } },
    { name: "silence", input: { chunks: [] } },
  ],
};

/** Any speech-to-text engine. The browser one is the default; a server one can plug in later. */
export interface Transcriber {
  transcribe(chunks: SpeechChunk[]): Promise<Transcript>;
}

export const browserTranscriber: Transcriber = {
  async transcribe(chunks) {
    return runSync(transcriberPrompt, { chunks }).output;
  },
};

/** Try, retry once, then "Transcript pending" (never blocks the candidate). */
export async function transcribeWithRetry(t: Transcriber, chunks: SpeechChunk[], retries = 1, opts: Pick<RunOptions, "log"> = {}): Promise<Transcript> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await t.transcribe(chunks);
    } catch (e) {
      if (attempt === retries) {
        opts.log?.({ service: "Transcriber", promptId: transcriberPrompt.id, promptVersion: transcriberPrompt.version, model: "browser-speech", mode: "off", latencyMs: 0, costUsd: 0, valid: false, error: e instanceof Error ? e.message : String(e), at: new Date().toISOString() });
      }
    }
  }
  return PENDING;
}
