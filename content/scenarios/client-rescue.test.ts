import { describe, expect, it } from "vitest";
import { getScenario } from "./index";
import { advance, choose, progress, startRun } from "@/lib/engine/engine";
import { planRun } from "@/lib/engine/seed";

describe("Client Rescue (S.4)", () => {
  it("registers a complete consulting template with three distinct scope changes", () => {
    const s = getScenario("client-rescue")!;
    expect(s).toBeDefined();
    expect(s.nodes).toHaveLength(15);
    expect(s.industryFlavour).toBe("consulting");
    expect(s.disruptionPool).toHaveLength(3);
    expect(s.nodes.filter(n => n.type === "choice" && n.checkpointEligible)).toHaveLength(5);
    for (const disruptionId of s.disruptionPool) {
      for (let option = 0; option < 3; option++) {
        const plan = { ...planRun(s, "client-demo"), disruptionId };
        let state = startRun(s, plan);
        let realLife = false;
        let steps = 0;
        while (state.status !== "ended" && steps++ < 20) {
          const n = s.nodes.find(n => n.id === state.nodeId)!;
          if (n.type === "event" && n.turningPoint) expect(progress(s, plan, state)).toBe(0.5);
          if (n.type === "checkpoint" && n.kind === "real_life") realLife = true;
          state = n.type === "choice" ? choose(s, plan, state, n.options[option].id, 1000).state : advance(s, plan, state);
        }
        expect(realLife).toBe(true);
        expect(state.status).toBe("ended");
        expect(state.log).toHaveLength(10);
      }
    }
  });
});
