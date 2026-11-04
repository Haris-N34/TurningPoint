import { describe, expect, it } from "vitest";
import { parseScenario } from "./schema";
import { planRun } from "./seed";
import { advance, choose, EngineError, progress, replay, startRun, view } from "./engine";
import { miniScenario } from "@/tests/fixtures/mini-scenario";

const s = parseScenario(miniScenario());

describe("planRun (S.2, C3.3, C4.1)", () => {
  it("is deterministic for the same seed", () => {
    expect(planRun(s, "attempt-1")).toEqual(planRun(s, "attempt-1"));
  });

  it("picks 2 or 3 eligible checkpoints and a pooled disruption", () => {
    for (let i = 0; i < 200; i++) {
      const p = planRun(s, `seed-${i}`);
      expect([2, 3]).toContain(p.checkpointNodeIds.length);
      for (const id of p.checkpointNodeIds) expect(["c1", "c2", "c4", "c5"]).toContain(id);
      expect(s.disruptionPool).toContain(p.disruptionId);
      expect(p.vars["budget.start"]).toBeGreaterThanOrEqual(4000);
      expect(p.vars["budget.start"]).toBeLessThanOrEqual(6000);
      expect(p.vars.teamSize).toBeGreaterThanOrEqual(6);
      expect(p.vars.teamSize).toBeLessThanOrEqual(10);
    }
  });

  it("different candidates get different disruptions and checkpoint timing", () => {
    const plans = Array.from({ length: 100 }, (_, i) => planRun(s, `cand-${i}`));
    expect(new Set(plans.map((p) => p.disruptionId)).size).toBe(3);
    expect(new Set(plans.map((p) => p.checkpointNodeIds.join())).size).toBeGreaterThan(3);
  });
});

describe("engine (C2.1 to C2.3, C3.1, C3.2)", () => {
  const plan = { ...planRun(s, "fixed"), disruptionId: "sponsor-pulls-out", checkpointNodeIds: ["c1", "c4"] };

  it("starts with seeded resources and interpolates text", () => {
    const st = startRun(s, plan);
    expect(st.resources.budget).toBe(plan.vars["budget.start"]);
    expect(view(s, plan, st).text).toBe(`You lead a team of ${plan.vars.teamSize}.`);
  });

  it("plays start to end, logging every choice and applying effects", () => {
    let st = startRun(s, plan);
    st = advance(s, plan, st); // scene -> c1
    const r1 = choose(s, plan, st, "b", 1234, new Date("2026-11-04T10:00:00Z"));
    expect(r1.checkpoint?.nodeId).toBe("c1");
    expect(r1.checkpoint?.recentChoices.at(-1)?.optionLabel).toBe("Let the team vote");
    st = r1.state;
    expect(st.resources.morale).toBe(75);
    expect(st.log[0]).toMatchObject({ nodeId: "c1", optionId: "b", decidedMs: 1234, at: "2026-11-04T10:00:00.000Z" });

    const r2 = choose(s, plan, st, "a", 500);
    expect(r2.checkpoint).toBeUndefined();
    st = r2.state;
    const v = view(s, plan, st);
    expect(v.kind).toBe("event");
    if (v.kind === "event") {
      expect(v.turningPoint).toBe(true);
      expect(v.title).toBe("Sponsor pulls out");
    }
    // Turning point resets a resource sharply on entry.
    expect(st.resources.budget).toBe(plan.vars["budget.start"] - 500 - 3000);
    expect(st.turningPointNodeId).toBe("e1");

    st = advance(s, plan, st); // -> c4, the new set of choices
    expect(view(s, plan, st).kind).toBe("choice");
    st = choose(s, plan, st, "c", 900).state;
    st = choose(s, plan, st, "a", 900).state;
    expect(view(s, plan, st).kind).toBe("checkpoint");
    st = advance(s, plan, st);
    expect(st.status).toBe("ended");
    expect(st.log).toHaveLength(4);
    expect(progress(s, plan, st)).toBe(1);
  });

  it("clamps resources to min and max", () => {
    let st = startRun(s, plan);
    st = advance(s, plan, st);
    st = choose(s, plan, st, "a", 1).state;
    st = choose(s, plan, st, "b", 1).state; // premium: morale +10
    st = advance(s, plan, st);
    st = choose(s, plan, st, "c", 1).state; // morale +15
    expect(st.resources.morale).toBeLessThanOrEqual(100);
    expect(st.resources.budget).toBeGreaterThanOrEqual(0);
  });

  it("puts the turning point near the middle of the run", () => {
    let st = startRun(s, plan);
    st = advance(s, plan, st);
    st = choose(s, plan, st, "a", 1).state;
    st = choose(s, plan, st, "a", 1).state;
    const p = progress(s, plan, st);
    expect(p).toBeGreaterThanOrEqual(0.4);
    expect(p).toBeLessThanOrEqual(0.6);
  });

  it("rejects invalid moves", () => {
    const st = startRun(s, plan);
    expect(() => choose(s, plan, st, "a", 1)).toThrow(EngineError);
    const atChoice = advance(s, plan, st);
    expect(() => choose(s, plan, atChoice, "zzz", 1)).toThrow(EngineError);
    expect(() => advance(s, plan, atChoice)).toThrow(EngineError);
  });

  it("replays a run exactly from seed and log", () => {
    let st = advance(s, plan, startRun(s, plan));
    st = choose(s, plan, st, "b", 10).state;
    st = choose(s, plan, st, "b", 20).state;
    const again = replay(s, plan, st.log);
    expect(again.resources).toEqual(advance(s, plan, st).resources);
    expect(again.log).toEqual(st.log);
  });
});
