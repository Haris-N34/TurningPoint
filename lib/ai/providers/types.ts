import type { PromptDef } from "../prompts/types";

// The provider interface (PRD v2 B1). Every model call in the app goes through one of these.
// Outputs come back unvalidated; the runner (lib/ai/run.ts) validates them against the prompt's schema.

export type AiMode = "live" | "cached" | "off";

export type GenerateResult = {
  output: unknown;
  /** Model id, or "local-rules" for the deterministic implementation. */
  model: string;
  costUsd: number;
  /** For cached mode: whether the answer came from the cache. */
  cacheHit?: boolean;
};

export interface Provider {
  readonly name: "local" | "cached" | "claude";
  generate<I, O>(p: PromptDef<I, O>, input: I): Promise<GenerateResult>;
  /** Local and cached providers can answer synchronously (card building runs in a render path). */
  generateSync?<I, O>(p: PromptDef<I, O>, input: I): GenerateResult;
}

export const LOCAL_MODEL = "local-rules";

/** Model per job size (PRD v2 B1): large jobs on Opus, fast jobs on Haiku. */
export const MODELS = { large: "claude-opus-5-5", fast: "claude-haiku-5-5" } as const;

/** USD per million tokens, input and output (Haiku rate is for prompts of 100K tokens or fewer). */
export const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
};

export function costOf(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICES[model];
  return p ? (inputTokens * p.in + outputTokens * p.out) / 1_000_000 : 0;
}
