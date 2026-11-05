import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { makeStore, MemoryKV } from "@/lib/store/store";
import type { PromptDef } from "./prompts/types";
import { cacheKey, hashInput } from "./prompts/types";
import { aiMode, CachedProvider, ClaudeProvider, LocalProvider, resolveProvider, type Provider } from "./providers";
import type { MessagesClient } from "./providers/claude";
import { run, runSync } from "./run";
import { aiHealth, listAiCalls, logAiCall, percentile, type AiCall } from "./telemetry";

// B.1: every model call goes through a provider; AI_MODE=live|cached|off; default off.

const Out = z.object({ answer: z.string().min(1) });
const echo: PromptDef<{ q: string }, z.infer<typeof Out>> = {
  id: "echo",
  version: "1.0.0",
  service: "Test",
  tier: "fast",
  system: "Echo.",
  render: (i) => i.q,
  schema: Out,
  local: (i) => ({ answer: `local:${i.q}` }),
  fallback: () => ({ answer: "fallback" }),
  check: (o) => (o.answer.includes("forbidden") ? "forbidden word" : undefined),
  fixtures: [{ name: "hi", input: { q: "hi" } }],
};

const logs: AiCall[] = [];
const log = (c: AiCall) => logs.push(c);
afterEach(() => {
  logs.length = 0;
  vi.unstubAllGlobals();
});

const fake = (output: unknown, delayMs = 0): Provider => ({
  name: "claude",
  generate: () => new Promise((r) => setTimeout(() => r({ output, model: "claude-haiku-5-5", costUsd: 0.001 }), delayMs)),
});

describe("AI_MODE kill switch", () => {
  it("defaults to off", () => {
    expect(aiMode({})).toBe("off");
    expect(resolveProvider({}, true)).toBeInstanceOf(LocalProvider);
  });
  it("cached mode replays the cache", () => {
    expect(aiMode({ AI_MODE: "cached" })).toBe("cached");
    expect(resolveProvider({ AI_MODE: "cached" }, true)).toBeInstanceOf(CachedProvider);
    expect(aiMode({ NEXT_PUBLIC_AI_MODE: "cached" })).toBe("cached");
  });
  it("live needs a server and a key; otherwise it degrades to cached", () => {
    expect(resolveProvider({ AI_MODE: "live" }, true)).toBeInstanceOf(CachedProvider);
    expect(resolveProvider({ AI_MODE: "live", ANTHROPIC_API_KEY: "k" }, false)).toBeInstanceOf(CachedProvider);
    expect(resolveProvider({ AI_MODE: "live", ANTHROPIC_API_KEY: "k" }, true)).toBeInstanceOf(ClaudeProvider);
  });
  it("unknown values mean off", () => {
    expect(aiMode({ AI_MODE: "yolo" })).toBe("off");
  });
});

describe("runner", () => {
  it("validates against the schema and logs the call", async () => {
    const r = await run(echo, { q: "a" }, { provider: new LocalProvider(), log, mode: "off" });
    expect(r).toMatchObject({ output: { answer: "local:a" }, valid: true, usedFallback: false, model: "local-rules" });
    expect(logs[0]).toMatchObject({ service: "Test", promptId: "echo", promptVersion: "1.0.0", model: "local-rules", valid: true, costUsd: 0 });
  });
  it("invalid output uses the fallback and logs a validation failure", async () => {
    const r = await run(echo, { q: "a" }, { provider: fake({ answer: 3 }), log });
    expect(r.output).toEqual({ answer: "fallback" });
    expect(r.valid).toBe(false);
    expect(logs[0].valid).toBe(false);
    expect(logs[0].error).toMatch(/schema/);
  });
  it("guard rejections use the fallback", async () => {
    const r = await run(echo, { q: "a" }, { provider: fake({ answer: "forbidden" }), log });
    expect(r.output.answer).toBe("fallback");
    expect(r.error).toMatch(/guard/);
  });
  it("times out to the fallback", async () => {
    const r = await run(echo, { q: "a" }, { provider: fake({ answer: "late" }, 200), timeoutMs: 20, log });
    expect(r.output.answer).toBe("fallback");
    expect(r.error).toMatch(/timed out/);
  });
  it("records live cost", async () => {
    await run(echo, { q: "a" }, { provider: fake({ answer: "ok" }), log, mode: "live" });
    expect(logs[0]).toMatchObject({ model: "claude-haiku-5-5", costUsd: 0.001, mode: "live" });
  });
  it("runSync never awaits a live provider: local rules answer", () => {
    const r = runSync(echo, { q: "b" }, { provider: fake({ answer: "live" }), log });
    expect(r.output.answer).toBe("local:b");
  });
});

describe("cached provider", () => {
  it("replays by prompt id, version and input hash", () => {
    const p = new CachedProvider({ [cacheKey(echo, { q: "x" })]: { output: { answer: "recorded" }, model: "claude-haiku-5-5" } });
    expect(runSync(echo, { q: "x" }, { provider: p, log }).output.answer).toBe("recorded");
    expect(logs[0]).toMatchObject({ cacheHit: true, model: "claude-haiku-5-5" });
    // A miss falls back to local rules; still no network.
    expect(runSync(echo, { q: "y" }, { provider: p, log }).output.answer).toBe("local:y");
    expect(logs[1].cacheHit).toBe(false);
  });
  it("a new prompt version misses the old cache", () => {
    const p = new CachedProvider({ [cacheKey(echo, { q: "x" })]: { output: { answer: "recorded" }, model: "m" } });
    expect(p.has({ ...echo, version: "2.0.0" }, { q: "x" })).toBe(false);
  });
  it("hash is stable under key order", () => {
    expect(hashInput({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(hashInput({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(hashInput({ a: 1 })).not.toBe(hashInput({ a: 2 }));
  });
});

describe("Claude provider", () => {
  it("sends the prompt with a structured output format and the right model per tier", async () => {
    const parse = vi.fn(async () => ({ parsed_output: { answer: "hi" }, stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 100 } }));
    const client: MessagesClient = { messages: { parse } };
    const p = new ClaudeProvider("test-key", client);
    const r = await p.generate(echo, { q: "hello" });
    expect(r.model).toBe("claude-haiku-5-5");
    expect(r.costUsd).toBeCloseTo((1000 * 0.1 + 100 * 0.5) / 1e6);
    const req = parse.mock.calls[0][0 as never] as Record<string, unknown>;
    expect(req).toMatchObject({ model: "claude-haiku-5-5", system: "Echo.", messages: [{ role: "user", content: "hello" }] });
    expect(req).not.toHaveProperty("temperature");
    expect(req.output_config).toBeTruthy();
    const big = await p.generate({ ...echo, tier: "large" }, { q: "x" });
    expect(big.model).toBe("claude-opus-5-5");
  });
  it("a refusal falls back", async () => {
    const client: MessagesClient = { messages: { parse: async () => ({ parsed_output: null, stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 0 } }) } };
    const r = await run(echo, { q: "a" }, { provider: new ClaudeProvider("k", client), log });
    expect(r.output.answer).toBe("fallback");
  });
  it("nothing outside lib/ai talks to a model provider", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const offenders: string[] = [];
    for (const root of ["app", "components", "lib", "content"]) {
      const dir = path.join(process.cwd(), root);
      for (const f of fs.readdirSync(dir, { recursive: true }).map(String)) {
        if (!/\.(ts|tsx)$/.test(f) || (root === "lib" && f.startsWith("ai"))) continue;
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        if (/@anthropic-ai\/sdk|api\.anthropic\.com|ANTHROPIC_API_KEY/.test(src)) offenders.push(`${root}/${f}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it("no API key appears in the source", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "lib/ai");
    const files = fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => /\.(ts|json)$/.test(f));
    for (const f of files) expect(fs.readFileSync(path.join(dir, f), "utf8")).not.toMatch(/sk-ant-[A-Za-z0-9]/);
  });
});

describe("telemetry", () => {
  it("logs to the local ai_calls collection", () => {
    const s = makeStore(new MemoryKV());
    logAiCall({ service: "S", promptId: "p", promptVersion: "1", model: "local-rules", mode: "off", latencyMs: 3, costUsd: 0, valid: true, at: new Date().toISOString() }, s);
    expect(listAiCalls(s)).toHaveLength(1);
  });
  it("computes p50, p95, cost and failures per service", () => {
    const base = { promptId: "p", promptVersion: "1", model: "m", mode: "live" as const, at: "" };
    const calls: AiCall[] = Array.from({ length: 20 }, (_, i) => ({ ...base, service: i < 10 ? "A" : "B", latencyMs: i + 1, costUsd: 0.01, valid: i !== 3 }));
    const h = aiHealth(calls);
    expect(h.total).toMatchObject({ calls: 20, p50: 10, p95: 19, failures: 1 });
    expect(h.total.costUsd).toBeCloseTo(0.2);
    expect(h.byService.map((r) => [r.service, r.calls, r.failures])).toEqual([["A", 10, 1], ["B", 10, 0]]);
    expect(percentile([], 50)).toBe(0);
  });
});
