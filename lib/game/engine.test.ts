import { describe, expect, it } from "vitest";
import raw from "@/content/maps/launch-week.json";
import { GAME } from "./config";
import { availableOptions, newGame, openIssues, replay, step, walkMinutes, type Action, type GameState } from "./engine";
import { computeKpis, kpiScoreBySkill } from "./kpis";
import { MapScenarioSchema, parseMapScenario } from "./schema";
import { dayOf, formatTime, parseTime } from "./time";

const s = parseMapScenario(raw);
const SEED = "att_test";
const ids = (st: GameState) => openIssues(s, st).map((i) => i.id);
/** Handle an issue by talking and choosing an option (first available by default). */
const handle = (st: GameState, issue: string, option?: "a" | "b" | "c" | "d"): GameState => {
  let x = step(s, st, { type: "talk", issue });
  if (!x.dialogue) return x;
  const node = s.nodes.find((n) => n.id === x.dialogue!.node)!;
  x = step(s, x, { type: "choose", issue, option: option ?? availableOptions(node, x)[0].id });
  return clearDue(x);
};
const clearDue = (st: GameState) => st.checkpointsDue.reduce((x, c) => step(s, x, c.kind === "order" ? { type: "orderAnswer", ranking: ids(x) } : { type: "checkpointDone", id: c.id }), st);

describe("time", () => {
  it("parses and formats game time", () => {
    expect(formatTime(parseTime("Wed 14:20"))).toBe("Wed 14:20");
    expect(dayOf(parseTime("Fri 09:00"))).toBe(4);
    expect(() => parseTime("Funday 9")).toThrow();
  });
});

describe("Launch Week map content (A3, A6)", () => {
  it("is valid and has 14 to 18 issues, 7 zones, a recovery plan and feedback issue", () => {
    expect(MapScenarioSchema.safeParse(raw).success).toBe(true);
    expect(s.issues.length).toBeGreaterThanOrEqual(14);
    expect(s.issues.length).toBeLessThanOrEqual(18);
    expect(s.zones.map((z) => z.name)).toEqual(expect.arrayContaining(["HQ Tent", "Volunteer Station", "Vendor Row", "Sponsor Office", "Storage Shed", "Main Stage", "Entrance Gate"]));
    expect(s.issues.some((i) => i.tags.includes("feedback"))).toBe(true);
  });

  it("never has more than 4 authored issues open at once if nothing is handled early", () => {
    let st = newGame(s, SEED, { turnBased: true });
    let max = 0;
    for (let d = 0; d < 5 && !st.ended; d++) {
      for (let k = 0; k < 18 && !st.ended && dayOf(st.t) === d; k++) {
        max = Math.max(max, ids(st).length);
        st = clearDue(step(s, st, { type: "move", zone: k % 2 ? "hq" : "stage" }));
      }
      if (!st.ended) st = clearDue(step(s, st, { type: "endDay" }));
    }
    expect(max).toBeLessThanOrEqual(4);
  });

  it("every turning-point dialogue has at least one explain-on-pick option (A9)", () => {
    for (const d of s.turningPoint.disruptions)
      for (const id of d.spawn) {
        const node = s.nodes.find((n) => n.id === s.issues.find((i) => i.id === id)!.node)!;
        if (id === "recovery-plan") expect(node.options.some((o) => o.explainOnPick)).toBe(true);
      }
  });
});

describe("clock (A5, A12)", () => {
  it("starts Monday 09:00 and moving costs fixed game time per route", () => {
    const st = newGame(s, SEED);
    expect(formatTime(st.t)).toBe("Mon 09:00");
    const cost = walkMinutes(s, "hq", "vendors");
    expect(cost).toBeGreaterThan(0);
    expect(step(s, st, { type: "move", zone: "vendors" }).t - st.t).toBe(cost);
    // Same route, same cost, both directions.
    expect(walkMinutes(s, "vendors", "hq")).toBe(cost);
  });

  it("drift advances the clock on the map but never in turn-based mode or during dialogue", () => {
    const live = newGame(s, SEED);
    expect(step(s, live, { type: "drift", minutes: 2 }).t).toBe(live.t + 2);
    const tb = newGame(s, SEED, { turnBased: true });
    expect(step(s, tb, { type: "drift", minutes: 60 }).t).toBe(tb.t);
    let talking = step(s, live, { type: "drift", minutes: 40 });
    talking = step(s, talking, { type: "talk", issue: "roles" });
    expect(talking.dialogue).toBeDefined();
    expect(step(s, talking, { type: "drift", minutes: 60 }).t).toBe(talking.t);
  });

  it("turn-based outcomes do not depend on drift (A12)", () => {
    const log: Action[] = [{ type: "move", zone: "volunteers" }, { type: "talk", issue: "roles" }, { type: "choose", issue: "roles", option: "b" }];
    const withDrift: Action[] = [{ type: "drift", minutes: 120 }, ...log.flatMap((a) => [a, { type: "drift", minutes: 90 } as Action])];
    const a = replay(s, SEED, log, { turnBased: true });
    const b = replay(s, SEED, withDrift, { turnBased: true });
    expect({ ...b, steps: 0 }).toEqual({ ...a, steps: 0 });
  });

  it("ends each day at 18:00 with a recap and moves to the next morning", () => {
    let st = newGame(s, SEED, { turnBased: true });
    st = step(s, st, { type: "endDay" });
    expect(formatTime(st.t)).toBe("Tue 09:00");
    expect(st.recaps).toHaveLength(1);
    expect(st.recaps[0]).toMatchObject({ day: 0 });
  });
});

describe("issues (A6)", () => {
  it("spawn on time, count down and expire with consequences and escalation", () => {
    let st = newGame(s, SEED, { turnBased: true });
    expect(st.issues.roles.status).toBe("open"); // spawns Mon 09:00, at the start
    expect(st.issues.permit.status).toBe("pending");
    st = step(s, st, { type: "move", zone: "volunteers" });
    st = clearDue(step(s, st, { type: "endDay" }));
    st = clearDue(step(s, st, { type: "endDay" }));
    expect(st.issues.permit.status).toBe("expired");
    expect(st.issues["permit-fine"].status).not.toBe("pending"); // escalation spawned
    expect(st.trust.partner).toBeLessThan(65);
  });

  it("talk + choose resolves, applies effects and costs talk time", () => {
    let st = step(s, newGame(s, SEED, { turnBased: true }), { type: "drift", minutes: 0 });
    st = step(s, st, { type: "move", zone: "volunteers" });
    const t0 = st.t;
    const morale = st.morale;
    st = handle(st, "roles", "b");
    expect(st.issues.roles.status).toBe("resolved");
    expect(st.morale).toBe(morale + 6);
    expect(st.t - t0).toBe(45 + 15);
  });

  it("delegation succeeds or fails from volunteer reliability and morale, and costs morale", () => {
    let st = step(s, newGame(s, SEED, { turnBased: true }), { type: "move", zone: "volunteers" });
    const morale = st.morale;
    st = step(s, st, { type: "delegate", issue: "roles", to: "priya" });
    expect(st.issues.roles.status).toBe("delegated");
    expect(st.morale).toBe(morale - GAME.delegateMoraleCost + 2);
    expect(() => step(s, st, { type: "delegate", issue: "vendor-mix", to: "priya" })).toThrow(/not open|needs you/);
  });

  it("defer needs a reason from the list and applies half the expiry cost", () => {
    let st = step(s, newGame(s, SEED, { turnBased: true }), { type: "move", zone: "volunteers" });
    expect(() => step(s, st, { type: "defer", issue: "roles", reason: "because" })).toThrow(/reason/);
    const morale = st.morale;
    st = step(s, st, { type: "defer", issue: "roles", reason: s.deferReasons[0] });
    expect(st.issues.roles).toMatchObject({ status: "deferred", reason: s.deferReasons[0] });
    expect(st.morale).toBe(morale - 4);
  });
});

describe("wait", () => {
  it("advances to the next spawn, or to the end of the day", () => {
    let st = newGame(s, SEED, { turnBased: true });
    st = step(s, st, { type: "wait" });
    expect(formatTime(st.t)).toBe("Mon 10:00");
    expect(st.issues["vendor-mix"].status).toBe("open");
  });
});

describe("turning point (A7)", () => {
  it("fires Wednesday 09:00, cuts the budget, darkens a zone and spawns the recovery issues", () => {
    let st = newGame(s, "seed-sponsor", { turnBased: true });
    st = { ...st, tp: { ...st.tp, disruptionId: "sponsor-pulls-out" } };
    const before = st.budget;
    st = clearDue(step(s, st, { type: "endDay" }));
    st = clearDue(step(s, st, { type: "endDay" }));
    expect(formatTime(st.t)).toBe("Wed 09:00");
    st = clearDue(step(s, st, { type: "move", zone: "hq" }));
    expect(st.tp.fired).toBe(true);
    expect(st.tp.budgetAfter).toBe(Math.round(st.tp.budgetBefore! * 0.4));
    expect(st.budget).toBeLessThan(before);
    expect(st.darkZones).toContain("sponsor");
    expect(["recovery-plan", "team-shaken", "vendors-worried"].every((id) => st.issues[id].status === "open")).toBe(true);
  });

  it("picks the disruption by seed", () => {
    const set = new Set(Array.from({ length: 40 }, (_, i) => newGame(s, `c${i}`).tp.disruptionId));
    expect(set.size).toBe(3);
  });
});

describe("checkpoints (A9)", () => {
  it("seeds 2 or 3 checkpoints on eligible issues and fires after the action", () => {
    for (let i = 0; i < 30; i++) {
      const st = newGame(s, `k${i}`);
      expect([2, 3]).toContain(st.plan.seeded.length);
      for (const id of st.plan.seeded) expect(s.issues.find((x) => x.id === id)!.checkpointEligible).toBe(true);
    }
    let st = newGame(s, SEED, { turnBased: true });
    st = { ...st, plan: { seeded: ["roles", "fridge"], fired: [] } };
    st = step(s, step(s, st, { type: "move", zone: "volunteers" }), { type: "talk", issue: "roles" });
    st = step(s, st, { type: "choose", issue: "roles", option: "a" });
    expect(st.checkpointsDue.find((c) => c.kind === "action")).toMatchObject({ issue: "roles", action: "choose", optionLabel: "Assign roles myself and post a checklist" });
  });

  it("explain-on-pick opens a checkpoint immediately, quoting the option, capped at 4", () => {
    let st = newGame(s, SEED, { turnBased: true });
    st = { ...st, plan: { seeded: [], fired: [] } };
    st = step(s, step(s, st, { type: "move", zone: "volunteers" }), { type: "talk", issue: "roles" });
    st = step(s, st, { type: "choose", issue: "roles", option: "c" });
    expect(st.checkpointsDue.find((c) => c.kind === "explain")).toMatchObject({ optionId: "c", optionLabel: "Take logistics myself so the team stays happy" });
    // Cap: never more than 4 video checkpoints in a run.
    const full = { ...st, videoCheckpoints: 4 };
    expect(full.videoCheckpoints).toBe(GAME.maxVideoCheckpoints);
  });

  it("asks the order question once when 3 issues are open, and logs what was done next", () => {
    let st = newGame(s, SEED, { turnBased: true });
    while (ids(st).length < 3) st = step(s, st, { type: "drift", minutes: 0 }), (st = step(s, st, { type: "move", zone: st.zone === "hq" ? "stage" : "hq" }));
    expect(st.checkpointsDue.filter((c) => c.kind === "order")).toHaveLength(1);
    const plan = ids(st).slice(0, 3).reverse();
    st = step(s, st, { type: "orderAnswer", ranking: plan });
    st = handle(st, ids(st)[0]);
    expect(st.order.ranking).toEqual(plan);
    expect(st.order.did.length).toBe(1);
    expect(st.checkpointsDue.filter((c) => c.kind === "order")).toHaveLength(0);
  });
});

describe("list view and map view (A10)", () => {
  it("produce identical engine state for the same inputs", () => {
    const log: Action[] = [
      { type: "move", zone: "volunteers" },
      { type: "talk", issue: "roles" },
      { type: "choose", issue: "roles", option: "b" },
      { type: "move", zone: "vendors" },
      { type: "talk", issue: "vendor-mix" },
      { type: "choose", issue: "vendor-mix", option: "a" },
      { type: "endDay" },
    ];
    // Map view sends the same actions, plus drift ticks that turn-based ignores; list view never drifts.
    const map = replay(s, SEED, log.flatMap((a) => [a, { type: "drift", minutes: 2 } as Action]), { turnBased: true });
    const list = replay(s, SEED, log, { turnBased: true });
    expect({ ...map, steps: 0 }).toEqual({ ...list, steps: 0 });
  });
});

describe("KPIs (A8)", () => {
  function playWeek(seed: string, pick: "a" | "b" | "c" | "d" = "a") {
    let st = newGame(s, seed, { turnBased: true });
    for (let guard = 0; guard < 200 && !st.ended; guard++) {
      st = clearDue(st);
      const open = ids(st);
      if (open.length) {
        const id = open[0];
        const node = s.nodes.find((n) => n.id === s.issues.find((i) => i.id === id)!.node)!;
        const opts = availableOptions(node, st);
        st = handle(st, id, (opts.find((o) => o.id === pick) ?? opts[0]).id);
      } else st = step(s, st, { type: "wait" });
    }
    return st;
  }

  it("computes all eight KPIs deterministically from the input log", () => {
    const a = playWeek(SEED);
    const b = playWeek(SEED);
    expect(a.ended).toBe(true);
    const k = computeKpis(s, a);
    expect(k.map((x) => x.id)).toEqual([
      "critical-handled",
      "deliberate-deferrals",
      "recovery-speed",
      "budget-protected",
      "morale-trajectory",
      "delegation-quality",
      "stakeholder-balance",
      "feedback-response",
    ]);
    expect(computeKpis(s, b)).toEqual(k);
    for (const x of k) expect(x.explanation.length).toBeGreaterThan(10);
    expect(k.find((x) => x.id === "budget-protected")!.value).toBe(0.8);
    expect(k.find((x) => x.id === "feedback-response")!.display).toBe("Took it on board");
    expect(k.find((x) => x.id === "recovery-speed")!.value).not.toBeNull();
  });

  it("dismissive feedback and an unrealistic plan score lower", () => {
    const good = kpiScoreBySkill(computeKpis(s, playWeek(SEED, "a")));
    const poor = kpiScoreBySkill(computeKpis(s, playWeek(SEED, "c")));
    expect(good.feedback!).toBeGreaterThan(poor.feedback!);
  });

  it("never reads real-time data: identical logs with different real timing give identical KPIs", () => {
    const st = playWeek(SEED);
    expect(JSON.stringify(computeKpis(s, st))).not.toMatch(/\b(ms|milliseconds?|seconds?|clicks?|keystrokes?)\b/i);
  });
});
