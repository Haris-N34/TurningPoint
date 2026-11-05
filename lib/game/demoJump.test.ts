import { describe, expect, it } from "vitest";
import raw from "@/content/maps/launch-week.json";
import { replay, step } from "./engine";
import { DEMO_JUMP_SEED, expiredBeforeTp, playToTurningPoint } from "./demoJump";
import { parseMapScenario } from "./schema";
import { formatTime } from "./time";

const s = parseMapScenario(raw);

describe("demo jump to the turning point (P.2)", () => {
  const j = playToTurningPoint(s);

  it("stops at Wednesday 09:00 with the sponsor pulling out", () => {
    expect(j.state.tp.fired).toBe(true);
    expect(j.state.tp.disruptionId).toBe("sponsor-pulls-out");
    expect(formatTime(j.state.t)).toBe("Wed 09:00");
  });

  it("plays a decent run: nothing ran out of time, morale and trust healthy", () => {
    expect(expiredBeforeTp(s, j)).toEqual([]);
    const before = j.state.recaps.at(-1)!;
    expect(before.morale).toBeGreaterThanOrEqual(55);
    for (const v of Object.values(before.trust)) expect(v).toBeGreaterThanOrEqual(45);
  });

  it("leaves no checkpoint for the presenter and has asked the order question already", () => {
    expect(j.state.checkpointsDue).toEqual([]);
    expect(j.state.order.asked).toBe(true);
    expect(j.state.dialogue).toBeUndefined();
  });

  it("keeps a video slot free so the recovery-plan pick still raises its checkpoint", () => {
    let st = replay(s, DEMO_JUMP_SEED, [...j.log, { type: "talk", issue: "recovery-plan" }]);
    st = step(s, st, { type: "choose", issue: "recovery-plan", option: "b" });
    expect(st.checkpointsDue.some((c) => c.issue === "recovery-plan" && c.optionId === "b")).toBe(true);
  });

  it("replays to the same state", () => {
    expect(replay(s, DEMO_JUMP_SEED, j.log)).toEqual(j.state);
  });
});
