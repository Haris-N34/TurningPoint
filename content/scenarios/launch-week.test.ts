import { describe, expect, it } from "vitest";
import { getScenario } from "./index";
import { advance, choose, progress, startRun } from "@/lib/engine/engine";
import { planRun } from "@/lib/engine/seed";

describe("Launch Week content (S.3)", () => {
  it("registers the full 15-node story and prescribed checkpoints", () => {
    const s = getScenario("launch-week")!;
    expect(s).toBeDefined();
    expect(s.nodes).toHaveLength(15);
    expect(s.nodes.filter(n => n.type === "choice" && n.checkpointEligible).map(n => n.id)).toEqual(["n3", "n6", "n9", "n10", "n12"]);
    expect(s.disruptionPool).toEqual(["sponsor-pulls-out", "venue-cancels", "lead-volunteer-quits"]);
    expect(s.estimatedMinutes).toBe(15);
    expect(s.disruptions[0].effects.budget).toBe(-0.6 * s.resources.budget.start);
  });

  it("every option and disruption reaches the real-life checkpoint and end, with a midpoint turning point", () => {
    const s = getScenario("launch-week")!;
    expect(s).toBeDefined();
    for (const disruptionId of s.disruptionPool) {
      for (let option = 0; option < 3; option++) {
        const plan = { ...planRun(s, "launch-demo"), disruptionId };
        let state = startRun(s, plan);
        let realLife = false;
        let turns = 0;
        while (state.status !== "ended" && turns++ < 20) {
          const n = s.nodes.find(n => n.id === state.nodeId)!;
          if (n.type === "event" && n.turningPoint) {
            expect(n.id).toBe("n8");
            expect(progress(s, plan, state)).toBeGreaterThanOrEqual(0.4);
            expect(progress(s, plan, state)).toBeLessThanOrEqual(0.6);
          }
          if (n.type === "checkpoint" && n.kind === "real_life") realLife = true;
          state = n.type === "choice" ? choose(s, plan, state, n.options[option % n.options.length].id, 1000).state : advance(s, plan, state);
        }
        expect(realLife).toBe(true);
        expect(state.status).toBe("ended");
        expect(state.log).toHaveLength(10);
      }
    }
  });
});
