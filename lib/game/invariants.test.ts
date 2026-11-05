import { describe, expect, it } from "vitest";
import { getMapScenario, MAP_IDS } from "@/content/maps";
import { rng } from "@/lib/engine/seed";
import { GAME } from "./config";
import { availableOptions, forLength, hiddenAvailable, newGame, nodeById, openIssues, replay, step, type Action, type GameLength, type GameState } from "./engine";
import { computeKpis } from "./kpis";
import type { MapScenario } from "./schema";
import { dayOf } from "./time";

// Scripted playthroughs over every map, seed, disruption and option policy, asserting engine invariants.

type Policy = "first" | "last" | "random" | "delegate" | "defer" | "ignore" | "explore";
const POLICIES: Policy[] = ["first", "last", "random", "delegate", "defer", "ignore", "explore"];
const SEEDS = ["s1", "att_abc", "demo-tp", "zz-9"];

/** The map with its disruption pool narrowed to one, so newGame (and replay) always picks it. */
const withDisruption = (s: MapScenario, id: string): MapScenario => ({ ...s, turningPoint: { ...s.turningPoint, pool: [id] } });

function nextAction(s: MapScenario, st: GameState, policy: Policy, r: () => number): Action {
  const due = st.checkpointsDue[0];
  if (due) return due.kind === "order" ? { type: "orderAnswer", ranking: openIssues(s, st).map((i) => i.id) } : { type: "checkpointDone", id: due.id };
  if (st.dialogue) {
    const opts = availableOptions(nodeById(s, st.dialogue.node), st);
    const o = policy === "last" ? opts.at(-1)! : policy === "random" ? opts[Math.floor(r() * opts.length)] : opts[0];
    return { type: "choose", issue: st.dialogue.issue, option: o.id };
  }
  if (policy === "ignore") return { type: "wait" };
  if (policy === "explore") {
    const h = hiddenAvailable(s, st)[0];
    if (h) return { type: "talk", issue: h.id };
  }
  const open = openIssues(s, st).sort((a, b) => (st.issues[a.id].deadline ?? Infinity) - (st.issues[b.id].deadline ?? Infinity));
  const i = open[0];
  if (!i) return { type: "wait" };
  if (policy === "defer") return { type: "defer", issue: i.id, reason: s.deferReasons[0] };
  if (policy === "delegate" && i.delegable) {
    const tried = new Set((st.issues[i.id].delegate ?? []).map((d) => d.to));
    const vol = s.npcs.find((n) => n.volunteer && !tried.has(n.id));
    if (vol) return { type: "delegate", issue: i.id, to: vol.id };
  }
  return { type: "talk", issue: i.id };
}

function checkState(s: MapScenario, st: GameState, where: string) {
  expect(Number.isFinite(st.budget), where).toBe(true);
  expect(Number.isInteger(st.budget), where).toBe(true);
  expect(st.budget, where).toBeGreaterThanOrEqual(0);
  expect(st.morale, where).toBeGreaterThanOrEqual(0);
  expect(st.morale, where).toBeLessThanOrEqual(100);
  for (const [g, v] of Object.entries(st.trust)) {
    expect(Number.isFinite(v), `${where} trust.${g}`).toBe(true);
    expect(v, `${where} trust.${g}`).toBeGreaterThanOrEqual(0);
    expect(v, `${where} trust.${g}`).toBeLessThanOrEqual(100);
  }
  // Nothing stays open past its deadline.
  for (const i of s.issues) {
    const x = st.issues[i.id];
    if (x.status === "open" && x.deadline !== undefined) expect(x.deadline, `${where} ${i.id} stuck open`).toBeGreaterThanOrEqual(st.t);
    if (x.closedAt !== undefined && x.openedAt !== undefined) expect(x.closedAt, `${where} ${i.id}`).toBeGreaterThanOrEqual(x.openedAt);
  }
  expect(st.videoCheckpoints, where).toBeLessThanOrEqual(forLength(s, st.length).checkpoints?.max ?? GAME.maxVideoCheckpoints);
}

function play(s: MapScenario, seed: string, policy: Policy, turnBased: boolean, length: GameLength = "full") {
  const r = rng(`policy:${seed}:${policy}`);
  let st = newGame(s, seed, { turnBased, length });
  const log: Action[] = [];
  const raised: string[] = [];
  for (let k = 0; k < 600 && !(st.ended && st.checkpointsDue.length === 0); k++) {
    const a = nextAction(s, st, policy, r);
    const before = st;
    st = step(s, st, a);
    log.push(a);
    for (const c of st.checkpointsDue) if (!before.checkpointsDue.some((x) => x.id === c.id)) raised.push(c.id);
    // A new recap shows the state at that day's end (the HUD after the step only differs if the turning point hit next morning).
    if (st.recaps.length > before.recaps.length) {
      const rc = st.recaps.at(-1)!;
      if (st.tp.fired && !before.tp.fired) expect(rc.budget, `recap day ${rc.day}`).toBe(st.tp.budgetBefore);
      else expect({ budget: rc.budget, morale: rc.morale, trust: rc.trust }, `recap day ${rc.day}`).toEqual({ budget: st.budget, morale: st.morale, trust: st.trust });
    }
    checkState(s, st, `${policy} step ${k} ${a.type}`);
  }
  return { st, log, raised };
}

const CASES = MAP_IDS.flatMap((mapId) => {
  const base = getMapScenario(mapId)!;
  return (["quick", "full"] as const).flatMap((length) =>
    base.turningPoint.pool.flatMap((d) => SEEDS.flatMap((seed) => POLICIES.map((policy) => ({ mapId, length, d, seed, policy })))),
  );
});

describe("scripted playthroughs keep the engine invariants", () => {
  it.each(CASES)("$mapId / $length / $d / $seed / $policy", ({ mapId, length, d, seed, policy }) => {
    const s = withDisruption(getMapScenario(mapId)!, d);
    const eff = forLength(s, length);
    const days = eff.days ?? GAME.workDays;
    for (const turnBased of [false, true]) {
      const { st, log, raised } = play(s, seed, policy, turnBased, length);
      const where = `${mapId} ${length} ${d} ${seed} ${policy} tb=${turnBased}`;
      // The week ends, every checkpoint is answered, the turning point fired with the forced disruption.
      expect(st.ended, where).toBe(true);
      expect(st.checkpointsDue, where).toEqual([]);
      expect(st.tp.fired && st.tp.disruptionId === d, where).toBe(true);
      // No visible issue is left open once the week is over.
      expect(openIssues(s, st).map((i) => i.id), where).toEqual([]);
      // Five day ends, one recap per working day, and each recap matches that day's events.
      expect(st.events.filter((e) => e.kind === "day_end").length, where).toBe(days);
      expect(st.recaps.map((x) => x.day), where).toEqual([...Array(days).keys()]);
      for (const rc of st.recaps) {
        const ev = st.events.filter((e) => dayOf(e.t) === rc.day);
        const n = (k: string) => ev.filter((e) => e.kind === k).length;
        expect({ resolved: rc.resolved, expired: rc.expired, deferred: rc.deferred, delegated: rc.delegated }, `${where} day ${rc.day}`).toEqual({
          resolved: n("resolved"),
          expired: n("expired"),
          deferred: n("deferred"),
          delegated: n("delegated"),
        });
      }
      // Events are in time order.
      for (let i = 1; i < st.events.length; i++) expect(st.events[i].t, `${where} event ${i}`).toBeGreaterThanOrEqual(st.events[i - 1].t);
      // Checkpoints: at most 4 video ones plus the order question, never twice the same id.
      expect(raised.filter((x) => x !== "order").length, where).toBeLessThanOrEqual(eff.checkpoints?.max ?? GAME.maxVideoCheckpoints);
      expect(raised.filter((x) => x === "order").length, where).toBeLessThanOrEqual(1);
      expect(new Set(raised).size, where).toBe(raised.length);
      // Anyone who engages gets at least the seeded minimum of checkpoints.
      if (["first", "last", "random", "explore", "delegate"].includes(policy)) expect(st.videoCheckpoints, where).toBeGreaterThanOrEqual(eff.checkpoints?.seeded[0] ?? GAME.seededCheckpoints[0]);
      // Results KPIs are computable: no NaN, scores 0 to 100 or null.
      for (const k of computeKpis(s, st)) {
        if (k.value !== null) expect(Number.isFinite(k.value), `${where} ${k.id}`).toBe(true);
        if (k.score !== null) {
          expect(Number.isFinite(k.score), `${where} ${k.id}`).toBe(true);
          expect(k.score, `${where} ${k.id}`).toBeGreaterThanOrEqual(0);
          expect(k.score, `${where} ${k.id}`).toBeLessThanOrEqual(100);
        }
      }
      // Replaying the input log gives exactly the live state.
      expect(replay(s, seed, log, { turnBased, length }), where).toEqual(st);
    }
  });
});

describe("The Client Pivot discoveries are reachable", () => {
  it.each(SEEDS)("Quick mode has no discoveries to find (%s): they are a full-week feature", (seed) => {
    const s = getMapScenario("client-pivot")!;
    expect(hiddenAvailable(s, newGame(s, seed, { length: "quick" }))).toEqual([]);
  });

  it.each(SEEDS)("an explorer finds all three and unlocks their options (%s)", (seed) => {
    const s = getMapScenario("client-pivot")!;
    const { st } = play(s, seed, "explore", false, "full");
    expect(st.discoveries).toEqual(expect.arrayContaining(["cafe-chat", "dusty-report", "store-employee"]));
    const unlocked = s.nodes.flatMap((n) => n.options.filter((o) => o.requires.length).map((o) => ({ n, o })));
    for (const { o } of unlocked) expect(o.requires.every((r) => st.discoveries.includes(r))).toBe(true);
  });
});

describe("dialogue fits the A to D grid", () => {
  it.each(MAP_IDS)("every option label on %s is at most 70 characters", (mapId) => {
    const long = getMapScenario(mapId)!.nodes.flatMap((n) => n.options.filter((o) => o.label.length > 70).map((o) => `${n.id}/${o.id}`));
    expect(long).toEqual([]);
  });
});
