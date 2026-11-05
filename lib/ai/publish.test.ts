import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMapScenario } from "@/content/maps";
import { getScenario } from "@/content/scenarios";
import { publish, saveDraft } from "@/lib/challenge/challenge";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { LocalProvider, type Provider } from "./providers";
import { preparePublishedContent, scenarioForRun } from "./services/publish";
import { tailor } from "./services/tailor";
import { loadVariants } from "./services/variants";
import type { AiCall } from "./telemetry";

// B.3: Scenario Tailor and Dialogue Variants run at publish time and are cached; nothing is generated live.

function counting() {
  const calls: AiCall[] = [];
  const local = new LocalProvider();
  let generated = 0;
  const p: Provider = {
    name: "local",
    generate: async (pr, i) => (generated++, local.generateSync(pr, i)),
    generateSync: (pr, i) => (generated++, local.generateSync(pr, i)),
  };
  return { p, calls, log: (c: AiCall) => calls.push(c), count: () => generated };
}

describe("publish-time content (B.3)", () => {
  it("tailors, publishes and caches dialogue variants with the challenge", () => {
    const s = makeStore(new MemoryKV());
    const c0 = counting();
    const base = getScenario("launch-week")!;
    const t = tailor(base, "Energy", "Prairie Grid", { provider: c0.p, log: c0.log });
    expect(t.changed).toBe(true);
    const draft = saveDraft(s, { company: { name: "Prairie Grid", colour: "#000" }, title: "Analyst", templateId: "launch-week", industry: "Energy", targetSkills: ["adaptability", "resilience", "prioritization"], scenario: t.scenario });
    const table = preparePublishedContent(s, draft, { provider: c0.p, log: c0.log });
    publish(s, draft.id);
    expect(table).toBeDefined();
    expect(loadVariants(s, draft.id)).toEqual(table);
    expect(c0.calls.map((c) => c.promptId)).toEqual(["scenario-tailor", "dialogue-variants"]);

    // Publishing again reuses the cache.
    const before = c0.count();
    preparePublishedContent(s, draft, { provider: c0.p, log: c0.log });
    expect(c0.count()).toBe(before);
  });

  it("play reads the cache and never generates", () => {
    const s = makeStore(new MemoryKV());
    const c = counting();
    preparePublishedContent(s, { id: "ch1", templateId: "launch-week" }, { provider: c.p, log: c.log });
    const n = c.count();
    const map = getMapScenario("launch-week")!;
    const a = scenarioForRun(s, "ch1", map, "seed-1");
    const b = scenarioForRun(s, "ch1", map, "seed-1");
    expect(a).toEqual(b);
    expect(c.count()).toBe(n);
    // Without a published table the original lines are used, still with no generation.
    expect(scenarioForRun(s, "unknown", map, "x")).toEqual(map);
  });

  it("game code never imports a generating service", () => {
    const offenders: string[] = [];
    for (const root of ["components/game", "components/game2", "lib/game"]) {
      const dir = path.join(process.cwd(), root);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir, { recursive: true }).map(String)) {
        if (!/\.(ts|tsx)$/.test(f)) continue;
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        if (/lib\/ai\/(run|providers|services\/(tailor|variants))/.test(src)) offenders.push(`${root}/${f}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
