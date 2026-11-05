import type { z } from "zod";
import { hashSeed } from "@/lib/engine/seed";

// A versioned prompt (PRD v2 B1). Every AI job is one of these. The deterministic `local` implementation
// is what runs with no API key (AI_MODE=off) and what every other mode falls back to.

export type ModelTier = "large" | "fast";

export type PromptDef<I, O> = {
  id: string;
  /** Bump on any change to the instructions, schema or local rules. Cache keys include it. */
  version: string;
  /** Service name shown on the AI health page. */
  service: string;
  tier: ModelTier;
  /** Instructions sent as the system prompt in live mode. */
  system: string;
  /** Turns the (already blind) input into the user message in live mode. */
  render: (input: I) => string;
  schema: z.ZodType<O>;
  /** Deterministic implementation. */
  local: (input: I) => O;
  /** Used when the provider fails, times out, or returns something invalid. */
  fallback: (input: I) => O;
  /** Checks beyond the schema (guards). Return a reason to reject the output. */
  check?: (output: O, input: I) => string | undefined;
  /** Jobs that are plain code (no model can do them better, or none should): always run locally. */
  localOnly?: boolean;
  /** Example inputs: replayed in cached mode and exercised by the tests. */
  fixtures: { name: string; input: I }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPrompt = PromptDef<any, any>;

/** Stable JSON (sorted keys), so the same input always hashes the same. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

/** Two salted 32-bit FNV-1a hashes as hex. Not cryptographic: it only names cache entries. */
export function hashInput(v: unknown): string {
  const s = stableStringify(v);
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  return hex(hashSeed(s)) + hex(hashSeed(`tp:${s.length}:${s}`));
}

export const cacheKey = (p: Pick<AnyPrompt, "id" | "version">, input: unknown) => `${p.id}@${p.version}:${hashInput(input)}`;
