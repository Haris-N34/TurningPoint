import { cacheKey, type PromptDef } from "../prompts/types";
import { LocalProvider } from "./local";
import { type GenerateResult, type Provider } from "./types";

export type CacheEntry = { output: unknown; model: string };
export type CacheTable = Record<string, CacheEntry>;

/**
 * Replays recorded outputs from lib/ai/cache/*.json, keyed by prompt id, version and input hash (B9).
 * A miss falls back to the local implementation, so the demo never needs the network.
 */
export class CachedProvider implements Provider {
  readonly name = "cached" as const;
  private local = new LocalProvider();
  constructor(private table: CacheTable) {}

  has(p: Pick<PromptDef<unknown, unknown>, "id" | "version">, input: unknown) {
    return cacheKey(p, input) in this.table;
  }

  generateSync<I, O>(p: PromptDef<I, O>, input: I): GenerateResult {
    const hit = this.table[cacheKey(p, input)];
    if (hit) return { output: structuredClone(hit.output), model: hit.model, costUsd: 0, cacheHit: true };
    return { ...this.local.generateSync(p, input), cacheHit: false };
  }
  async generate<I, O>(p: PromptDef<I, O>, input: I) {
    return this.generateSync(p, input);
  }
}
