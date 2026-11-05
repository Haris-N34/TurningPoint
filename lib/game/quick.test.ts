import { describe, expect, it } from "vitest";
import { getMapScenario, MAP_IDS } from "@/content/maps";
import { forLength, newGame, replay, step } from "./engine";
import { DEMO_JUMP_SEED, expiredBeforeTp, playToTurningPoint } from "./demoJump";
import { scriptedRun } from "./pace";
import { MapScenarioSchema } from "./schema";
import { formatTime } from "./time";

describe("Quick mode (Mon to Wed)", () => {
  it.each(MAP_IDS)("%s has quick data, and its quick variant is a valid map", (id) => {
    const s = getMapScenario(id)!;
    expect(s.quick).toBeDefined();
    const q = forLength(s, "quick");
    expect(MapScenarioSchema.safeParse(q).success).toBe(true);
    expect(q.days).toBe(3);
    expect(q.turningPoint.at).toBe("Tue 09:00");
    expect(forLength(q, "quick")).toBe(q);
    expect(forLength(s, "full")).toBe(s);
    // Same ids, nodes and effects: only timing and which issues spawn change.
    expect(q.issues.map((i) => i.id)).toEqual(s.issues.map((i) => i.id));
    expect(q.nodes).toEqual(s.nodes);
  });

  it.each(MAP_IDS)("%s quick runs have 7 to 9 visible problems for every disruption", (id) => {
    const q = forLength(getMapScenario(id)!, "quick");
    const tpOnly = new Set(q.turningPoint.disruptions.flatMap((d) => d.spawn));
    for (const d of q.turningPoint.disruptions) {
      const run = q.issues.filter((i) => !i.hidden && ((i.spawnAt && !tpOnly.has(i.id)) || d.spawn.includes(i.id)));
      expect(run.length, d.id).toBeGreaterThanOrEqual(7);
      expect(run.length, d.id).toBeLessThanOrEqual(9);
    }
  });

  it.each(MAP_IDS)("%s quick: turning point Tuesday 09:00, three days, market day Thursday morning, at most 2 decision checkpoints", (id) => {
    const s = getMapScenario(id)!;
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const start = newGame(s, seed, { length: "quick" });
      expect(start.length).toBe("quick");
      const log = scriptedRun(s, start, (ids) => ids.at(-1)!);
      const st = replay(s, seed, log, { length: "quick" });
      expect(st.ended).toBe(true);
      expect(formatTime(st.tp.at!)).toBe("Tue 09:00");
      expect(st.recaps.map((r) => r.day)).toEqual([0, 1, 2]);
      expect(formatTime(st.t)).toBe("Thu 09:00");
      expect(st.videoCheckpoints).toBeLessThanOrEqual(2);
      expect(st.videoCheckpoints).toBeGreaterThanOrEqual(1);
    }
  });

  it("full week stays the default in the engine, so old logs replay unchanged", () => {
    const s = getMapScenario("launch-week")!;
    expect(newGame(s, "x").length).toBe("full");
    // A state saved before lengths existed plays as the full week.
    const old = { ...newGame(s, "x") } as Partial<ReturnType<typeof newGame>>;
    delete old.length;
    expect(() => step(s, old as ReturnType<typeof newGame>, { type: "wait" })).not.toThrow();
  });

  it("demo jump in Quick mode lands Tuesday 09:00 with the sponsor pulling out, a decent Monday, a slot free for the recovery pick", () => {
    const s = getMapScenario("launch-week")!;
    const j = playToTurningPoint(s, DEMO_JUMP_SEED, { length: "quick" });
    expect(formatTime(j.state.t)).toBe("Tue 09:00");
    expect(j.state.tp.disruptionId).toBe("sponsor-pulls-out");
    expect(expiredBeforeTp(forLength(s, "quick"), j)).toEqual([]);
    expect(j.state.checkpointsDue).toEqual([]);
    expect(j.state.order.asked).toBe(true);
    let st = step(s, j.state, { type: "talk", issue: "recovery-plan" });
    st = step(s, st, { type: "choose", issue: "recovery-plan", option: "b" });
    expect(st.checkpointsDue.some((c) => c.issue === "recovery-plan" && c.optionId === "b")).toBe(true);
    expect(replay(s, DEMO_JUMP_SEED, j.log, { length: "quick" })).toEqual(j.state);
  });
});
