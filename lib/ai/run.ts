import type { PromptDef } from "./prompts/types";
import { aiMode, LocalProvider, provider as currentProvider, type AiMode, type Provider } from "./providers";
import { logAiCall, type AiCall } from "./telemetry";

// The one place model calls happen (B.1). Validate against the prompt's Zod schema, run its guards,
// fall back to the template on failure or timeout, and log the call either way.

export type RunOptions = {
  provider?: Provider;
  /** Give up and use the fallback after this long (Checkpoint Interviewer: 4 s). */
  timeoutMs?: number;
  /** Where telemetry goes; defaults to the local store's ai_calls collection. */
  log?: (call: AiCall) => void;
  mode?: AiMode;
};

export type RunResult<O> = {
  output: O;
  /** True when the provider's output passed schema and guards; false means the fallback was used. */
  valid: boolean;
  usedFallback: boolean;
  model: string;
  error?: string;
};

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

function validate<I, O>(p: PromptDef<I, O>, input: I, raw: unknown): { ok: true; output: O } | { ok: false; error: string } {
  const parsed = p.schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `schema: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  const why = p.check?.(parsed.data, input);
  return why ? { ok: false, error: `guard: ${why}` } : { ok: true, output: parsed.data };
}

function finish<I, O>(
  p: PromptDef<I, O>,
  input: I,
  opts: RunOptions,
  t0: number,
  got: { raw?: unknown; model: string; costUsd: number; cacheHit?: boolean; error?: string },
): RunResult<O> {
  const v = got.error ? ({ ok: false, error: got.error } as const) : validate(p, input, got.raw);
  const result: RunResult<O> = v.ok
    ? { output: v.output, valid: true, usedFallback: false, model: got.model }
    : { output: p.fallback(input), valid: false, usedFallback: true, model: got.model, error: v.error };
  const call: AiCall = {
    service: p.service,
    promptId: p.id,
    promptVersion: p.version,
    model: got.model,
    mode: opts.mode ?? aiMode(),
    latencyMs: Math.max(0, Math.round(now() - t0)),
    costUsd: got.costUsd,
    valid: result.valid,
    error: result.error,
    cacheHit: got.cacheHit,
    at: new Date().toISOString(),
  };
  (opts.log ?? logAiCall)(call);
  return result;
}

const pick = (p: { localOnly?: boolean }, opts: RunOptions): Provider => (p.localOnly ? new LocalProvider() : opts.provider ?? currentProvider());

export async function run<I, O>(p: PromptDef<I, O>, input: I, opts: RunOptions = {}): Promise<RunResult<O>> {
  const prov = pick(p, opts);
  const t0 = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const call = prov.generate(p, input);
    const res = opts.timeoutMs
      ? await Promise.race([
          call,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`timed out after ${opts.timeoutMs} ms`)), opts.timeoutMs);
          }),
        ])
      : await call;
    return finish(p, input, opts, t0, { raw: res.output, model: res.model, costUsd: res.costUsd, cacheHit: res.cacheHit });
  } catch (e) {
    return finish(p, input, opts, t0, { model: prov.name === "claude" ? "claude" : "local-rules", costUsd: 0, error: e instanceof Error ? e.message : String(e) });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Synchronous run for render paths (card building, questions at choice time). Uses the provider's sync
 * path when it has one (local, cached); a live provider is never awaited here, the local rules answer.
 */
export function runSync<I, O>(p: PromptDef<I, O>, input: I, opts: RunOptions = {}): RunResult<O> {
  const prov = pick(p, opts);
  const sync = prov.generateSync ? prov : new LocalProvider();
  const t0 = now();
  try {
    const res = sync.generateSync!(p, input);
    return finish(p, input, opts, t0, { raw: res.output, model: res.model, costUsd: res.costUsd, cacheHit: res.cacheHit });
  } catch (e) {
    return finish(p, input, opts, t0, { model: "local-rules", costUsd: 0, error: e instanceof Error ? e.message : String(e) });
  }
}
