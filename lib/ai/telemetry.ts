import { z } from "zod";
import { store, type Store } from "@/lib/store/store";

// Every AI call is logged (PRD v2 B1, data model `ai_calls`): service, prompt version, model, latency,
// cost and whether the output passed validation. No inputs or outputs are stored, so no candidate data.

export const AiCallSchema = z.object({
  service: z.string(),
  promptId: z.string(),
  promptVersion: z.string(),
  model: z.string(),
  mode: z.enum(["live", "cached", "off"]),
  latencyMs: z.number().min(0),
  costUsd: z.number().min(0),
  valid: z.boolean(),
  /** Why the output was rejected or the call failed (never the content itself). */
  error: z.string().optional(),
  cacheHit: z.boolean().optional(),
  at: z.string(),
});
export type AiCall = z.infer<typeof AiCallSchema>;

const KEY = "ai_calls";
const MAX = 1000;

export const listAiCalls = (s: Store = store()): AiCall[] => s.getJSON(KEY, z.array(AiCallSchema)) ?? [];

export function logAiCall(call: AiCall, s: Store = store()) {
  try {
    s.setJSON(KEY, [...listAiCalls(s), AiCallSchema.parse(call)].slice(-MAX));
  } catch {
    // Telemetry never breaks the feature it measures.
  }
}

export const clearAiCalls = (s: Store = store()) => s.setJSON(KEY, []);

/** Nearest-rank percentile. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export type HealthRow = { service: string; calls: number; p50: number; p95: number; costUsd: number; failures: number; models: string[] };

export function aiHealth(calls: AiCall[]) {
  const row = (service: string, cs: AiCall[]): HealthRow => {
    const lat = cs.map((c) => c.latencyMs);
    return {
      service,
      calls: cs.length,
      p50: percentile(lat, 50),
      p95: percentile(lat, 95),
      costUsd: cs.reduce((a, c) => a + c.costUsd, 0),
      failures: cs.filter((c) => !c.valid).length,
      models: [...new Set(cs.map((c) => c.model))],
    };
  };
  const services = [...new Set(calls.map((c) => c.service))].sort();
  return { total: row("All services", calls), byService: services.map((s) => row(s, calls.filter((c) => c.service === s))) };
}
