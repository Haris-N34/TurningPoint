import { availableOptions, forLength, issueById, newGame, nodeById, openIssues, step, type Action, type GameLength, type GameState } from "./engine";
import type { DialogueOption, MapScenario } from "./schema";
import { parseTime } from "./time";

// The stage demo jump (P.2): play a sensible scripted player from Monday 09:00 up to the turning point,
// so Wednesday morning looks like a decent run. Pure and deterministic, like the engine.

export const DEMO_JUMP_SEED = "demo-tp";

/** How good an option looks to the scripted player: steady morale and trust, careful with money. */
function score(o: DialogueOption): number {
  let v = 0;
  for (const [k, d] of Object.entries(o.effects)) v += k === "budget" ? d / 100 : d;
  // Explain-on-pick options would spend a video checkpoint slot the live demo needs later.
  return v - (o.explainOnPick ? 1000 : 0) - (o.minutes ?? 0) / 30;
}

export type DemoJump = { state: GameState; log: Action[]; tpIndex: number };

/**
 * Play to the turning point. Lets a few problems pile up while there is slack (so the order question is asked and
 * answered before the turning point, not on top of the recovery plan), then handles them earliest deadline first.
 * Every checkpoint raised on the way is answered, so none is left for the presenter.
 */
export function playToTurningPoint(base: MapScenario, seed = DEMO_JUMP_SEED, opts: { turnBased?: boolean; length?: GameLength } = {}): DemoJump {
  const s = forLength(base, opts.length);
  let st = newGame(base, seed, opts);
  const log: Action[] = [];
  const act = (a: Action) => {
    st = step(s, st, a);
    log.push(a);
  };
  for (let guard = 0; guard < 300 && !st.ended && !st.tp.fired; guard++) {
    const due = st.checkpointsDue[0];
    if (due) {
      act(due.kind === "order" ? { type: "orderAnswer", ranking: openIssues(s, st).map((i) => i.id) } : { type: "checkpointDone", id: due.id });
      continue;
    }
    if (st.dialogue) {
      const node = nodeById(s, st.dialogue.node);
      const best = [...availableOptions(node, st)].sort((a, b) => score(b) - score(a))[0];
      act({ type: "choose", issue: st.dialogue.issue, option: best.id });
      continue;
    }
    const open = openIssues(s, st).sort((a, b) => (st.issues[a.id].deadline ?? Infinity) - (st.issues[b.id].deadline ?? Infinity));
    // Wait for the next problem only while that leaves an hour of slack on the most urgent open one.
    const urgent = open.length ? (st.issues[open[0].id].deadline ?? Infinity) : Infinity;
    const nextSpawn = Math.min(...s.issues.filter((i) => st.issues[i.id].status === "pending" && i.spawnAt).map((i) => parseTime(i.spawnAt!)).filter((x) => x > st.t));
    const tp = st.tp.fired ? Infinity : parseTime(s.turningPoint.at);
    const canWait = !open.length || (!st.order.asked && open.length < 3 && nextSpawn < tp && nextSpawn <= urgent - 60);
    act(canWait ? { type: "wait" } : { type: "talk", issue: open[0].id });
  }

  const tpIndex = st.events.findIndex((e) => e.kind === "turning_point");
  return { state: st, log, tpIndex };
}

/** Issues the scripted player let run out of time (should be none in the demo). */
export const expiredBeforeTp = (s: MapScenario, j: DemoJump) =>
  j.state.events.slice(0, j.tpIndex).filter((e) => e.kind === "expired" && !issueById(s, e.issue!).hidden).map((e) => e.issue!);
