import { availableOptions, issueById, newGame, nodeById, openIssues, step, type Action, type GameState } from "./engine";
import type { DialogueOption, MapScenario } from "./schema";

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
 * Play to the turning point. Waits until a few problems are open (so the order question is asked and answered
 * before the turning point, not on top of the recovery plan), then handles them earliest deadline first.
 * Every checkpoint raised on the way is answered, so none is left for the presenter.
 */
export function playToTurningPoint(s: MapScenario, seed = DEMO_JUMP_SEED, opts: { turnBased?: boolean } = {}): DemoJump {
  let st = newGame(s, seed, opts);
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
    const soon = open.find((i) => (st.issues[i.id].deadline ?? Infinity) - st.t <= 120);
    if (open.length && (st.order.asked || soon || open.length >= 3)) act({ type: "talk", issue: (soon ?? open[0]).id });
    else act({ type: "wait" });
  }

  const tpIndex = st.events.findIndex((e) => e.kind === "turning_point");
  return { state: st, log, tpIndex };
}

/** Issues the scripted player let run out of time (should be none in the demo). */
export const expiredBeforeTp = (s: MapScenario, j: DemoJump) =>
  j.state.events.slice(0, j.tpIndex).filter((e) => e.kind === "expired" && !issueById(s, e.issue!).hidden).map((e) => e.issue!);
