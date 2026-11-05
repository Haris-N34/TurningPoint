import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedDemo } from "@/lib/demo/seed";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { CACHE } from "./cache";
import { fixturesOf, PROMPTS } from "./prompts/registry";
import { CachedProvider, resolveProvider, setProvider } from "./providers";
import { runSync } from "./run";
import { askCopilot } from "./services/copilot";
import { mapValues } from "./services/valueMapper";
import type { AiCall } from "./telemetry";

// B.9: AI_MODE=cached runs the demo with no network access to the model provider.

const calls: AiCall[] = [];
const log = (c: AiCall) => calls.push(c);

beforeAll(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("network is off in this test");
  });
  setProvider(resolveProvider({ AI_MODE: "cached", ANTHROPIC_API_KEY: undefined }, true));
});
afterAll(() => {
  vi.unstubAllGlobals();
  setProvider(undefined);
});

describe("cached mode (B.9)", () => {
  it("resolves to the cached provider, even with AI_MODE=live and no key", () => {
    expect(resolveProvider({ AI_MODE: "cached" }, true)).toBeInstanceOf(CachedProvider);
    expect(resolveProvider({ AI_MODE: "live" }, true)).toBeInstanceOf(CachedProvider);
  });

  it.each(PROMPTS.filter((p) => !p.localOnly).map((p) => [p.id, p] as const))("%s: every fixture replays from the cache (run `pnpm ai:record` after changing a prompt)", (_, p) => {
    const provider = new CachedProvider(CACHE);
    for (const f of fixturesOf(p)) {
      expect(provider.has(p, f.input), `${p.id}@${p.version} "${f.name}" missing from lib/ai/cache/recorded.json`).toBe(true);
      const r = runSync(p, f.input, { provider, log });
      expect(r.valid, `${p.id}/${f.name}: ${r.error}`).toBe(true);
    }
  });

  it("the demo flow works with the network off", () => {
    const s = makeStore(new MemoryKV());
    const challenges = seedDemo(s);
    expect(challenges.length).toBeGreaterThan(0);
    const card = s.getCard("att_demo_maya")!;
    expect(card.consistency?.length).toBeGreaterThan(0);
    const a = askCopilot("Where did they show prioritization?", card, { log });
    expect(a.citations.length).toBeGreaterThan(0);
    expect(mapValues(["Communicate tech and business"], { log })[0].skill).toBe("communication");
  });
});
