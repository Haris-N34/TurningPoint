import { describe, expect, it } from "vitest";
import { getMapScenario, MAP_IDS } from "@/content/maps";
import { rng } from "@/lib/engine/seed";
import { GAME } from "./config";
import { availableOptions, forLength, GameError, newGame, nodeById, openIssues, replay, step, type Action, type GameLength, type GameState } from "./engine";
import { computeKpis } from "./kpis";
import type { MapScenario } from "./schema";

// Random-action fuzzer: any mix of moves, talks, leaves, picks, delegations, deferrals, waits, day ends and
// drift, valid or not. Only GameError may be thrown, and every reached state keeps the engine invariants.

function randomAction(s: MapScenario, st: GameState, r: () => number): Action {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const issues = s.issues.map((i) => i.id);
  const due = st.checkpointsDue[0];
  const roll = r();
  // Mostly sensible, sometimes nonsense (wrong issue, closed issue, bad reason, unknown volunteer).
  if (due && roll < 0.6) return due.kind === "order" ? { type: "orderAnswer", ranking: openIssues(s, st).map((i) => i.id) } : { type: "checkpointDone", id: due.id };
  if (st.dialogue && roll < 0.8) {
    const opts = availableOptions(nodeById(s, st.dialogue.node), st);
    return { type: "choose", issue: st.dialogue.issue, option: pick(opts).id };
  }
  const open = openIssues(s, st).map((i) => i.id);
  const target = open.length && r() < 0.7 ? pick(open) : pick(issues);
  const vols = s.npcs.filter((n) => n.volunteer).map((n) => n.id);
  return pick<Action>([
    { type: "talk", issue: target },
    { type: "talk", issue: target },
    { type: "move", zone: pick(s.zones).id },
    { type: "leave" },
    { type: "delegate", issue: target, to: r() < 0.8 ? pick(vols) : "nobody" },
    { type: "defer", issue: target, reason: r() < 0.8 ? pick(s.deferReasons) : "because" },
    { type: "wait" },
    { type: "endDay" },
    { type: "drift", minutes: 2 },
    { type: "choose", issue: target, option: pick(["a", "b", "c", "d"] as const) },
    { type: "checkpointDone", id: "cp9" },
  ]);
}

function invariants(s: MapScenario, st: GameState, where: string) {
  const eff = forLength(s, st.length);
  expect(Number.isFinite(st.budget) && st.budget >= 0, where).toBe(true);
  expect(st.morale >= 0 && st.morale <= 100, where).toBe(true);
  for (const v of Object.values(st.trust)) expect(v >= 0 && v <= 100, where).toBe(true);
  expect(st.videoCheckpoints, where).toBeLessThanOrEqual(eff.checkpoints?.max ?? GAME.maxVideoCheckpoints);
  if (st.dialogue) {
    expect(st.checkpointsDue, `${where}: checkpoint due while talking`).toEqual([]);
    expect(st.issues[st.dialogue.issue].status, where).toBe("open");
  }
  for (const i of s.issues) {
    const x = st.issues[i.id];
    if (x.status === "open" && x.deadline !== undefined) expect(x.deadline >= st.t, `${where} ${i.id} stuck open`).toBe(true);
  }
  if (eff.orderQuestion === false) expect(st.order.asked, where).toBe(false);
}

const RUNS = MAP_IDS.flatMap((m) => (["quick", "full"] as GameLength[]).flatMap((length) => [false, true].map((turnBased) => ({ m, length, turnBased }))));

describe("random-action fuzzer", () => {
  it.each(RUNS)("$m / $length / turnBased=$turnBased: 40 random runs, only GameError, invariants hold, replay matches", ({ m, length, turnBased }) => {
    const s = getMapScenario(m)!;
    for (let run = 0; run < 40; run++) {
      const seed = `fuzz-${m}-${length}-${run}`;
      const r = rng(`${seed}:actions`);
      let st = newGame(s, seed, { length, turnBased });
      const log: Action[] = [];
      for (let k = 0; k < 500 && !(st.ended && !st.checkpointsDue.length); k++) {
        const a = randomAction(s, st, r);
        try {
          const next = step(s, st, a);
          if (next !== st) log.push(a);
          st = next;
        } catch (e) {
          if (!(e instanceof GameError)) throw new Error(`${seed} step ${k} ${JSON.stringify(a)}: ${String(e)}`);
        }
        invariants(s, st, `${seed} step ${k} ${a.type}`);
      }
      // Finish the week if the random walk didn't.
      for (let k = 0; k < 200 && !(st.ended && !st.checkpointsDue.length); k++) {
        const due = st.checkpointsDue[0];
        const a: Action = due ? (due.kind === "order" ? { type: "orderAnswer", ranking: [] } : { type: "checkpointDone", id: due.id }) : st.dialogue ? { type: "leave" } : { type: "endDay" };
        st = step(s, st, a);
        log.push(a);
      }
      expect(st.ended, seed).toBe(true);
      for (const k of computeKpis(forLength(s, length), st)) if (k.score !== null) expect(Number.isFinite(k.score), `${seed} ${k.id}`).toBe(true);
      expect(replay(s, seed, log, { length, turnBased }), seed).toEqual(st);
    }
  });
});
