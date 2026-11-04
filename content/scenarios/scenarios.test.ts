import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseScenario } from "@/lib/engine/schema";
import { planRun } from "@/lib/engine/seed";
import { advance, choose, progress, startRun, view } from "@/lib/engine/engine";
import { SCENARIO_IDS } from "./index";

const dir = join(process.cwd(), "content/scenarios");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe.each(files)("content/scenarios/%s", (file) => {
  const s = parseScenario(JSON.parse(readFileSync(join(dir, file), "utf8")));

  it("is registered in index.ts", () => {
    expect(SCENARIO_IDS).toContain(s.id);
  });

  it("every art has alt text and every eligible choice has a fallback question", () => {
    for (const n of s.nodes) {
      if (n.art) expect(n.art.alt.length).toBeGreaterThan(0);
      if (n.type === "choice" && n.checkpointEligible) expect(n.fallbackQuestion, n.id).toBeTruthy();
    }
  });

  it("turning point fires between 40% and 60% of the run on the first-option path (C3.1)", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      const plan = planRun(s, seed);
      let st = startRun(s, plan);
      while (st.status === "playing" && !(view(s, plan, st).kind === "event" && st.turningPointNodeId)) {
        const v = view(s, plan, st);
        st = v.kind === "choice" ? choose(s, plan, st, v.node.options[0].id, 1).state : advance(s, plan, st);
      }
      const p = progress(s, plan, st);
      expect(p, `seed ${seed}`).toBeGreaterThanOrEqual(0.4);
      expect(p, `seed ${seed}`).toBeLessThanOrEqual(0.6);
    }
  });
});
