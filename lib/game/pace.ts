import { timing } from "@/lib/checkpoint/timing";
import { availableOptions, forLength, issueById, nodeById, step, type Action, type GameState } from "./engine";
import type { MapScenario } from "./schema";

// A.19: how long a full run takes for a player at normal pace. Real seconds per action, from the
// screens the player actually sees. Game time never depends on this (the engine ignores real time).

export const NORMAL_PACE = {
  introS: 60, // title, avatar, loading tips
  readCharsPerS: 20, // about 200 words a minute, typical adult reading (the "normal" typewriter shows 40 chars/s)
  decideS: 6, // weighing A to D once read
  reactionS: 1.5,
  walkSameZoneS: 3,
  walkOtherZoneS: 5, // walking to another zone: fast travel teleports after 4 s (createScene), plus a beat to arrive
  trackerActionS: 6, // delegate or defer from the issue tracker, incl. picking a reason
  waitS: 2,
  answerShare: 0.75, // people use about three quarters of the answer time
  reviewS: 10, // read back, submit
  orderRankS: 20,
  recapS: 8,
  cutsceneS: 25,
  resultsS: 45,
} as const;

export type PaceBreakdown = { total: number; parts: Record<string, number> };

/** Real seconds for a run, title screen to the results screen, by part. `actions` is the logged input (as GameShell records it).
 *  The real-life checkpoint after the results is a separate step (C2.5 covers the whole challenge). */
export function paceOf(s: MapScenario, start: GameState, actions: Action[], p = NORMAL_PACE): PaceBreakdown {
  const parts: Record<string, number> = { intro: p.introS };
  const add = (k: string, v: number) => (parts[k] = (parts[k] ?? 0) + v);
  const cp = (kind: "decision" | "real_life") => {
    const t = timing(kind);
    return t.thinkS / 2 + t.answerS * p.answerShare + p.reviewS;
  };
  let st = start;
  for (const a of actions) {
    const before = st;
    st = step(s, st, a);
    if (a.type === "talk") {
      const def = issueById(s, a.issue);
      const node = nodeById(s, def.node);
      add("walking", before.zone === def.zone ? p.walkSameZoneS : p.walkOtherZoneS);
      const chars = node.lines.reduce((n, l) => n + l.text.length, 0) + node.prompt.length;
      add("dialogue", chars / p.readCharsPerS);
    } else if (a.type === "choose") {
      const node = nodeById(s, issueById(s, a.issue).node);
      const chars = availableOptions(node, before).reduce((n, o) => n + o.label.length, 0);
      add("choices", chars / p.readCharsPerS + p.decideS + p.reactionS);
    } else if (a.type === "delegate" || a.type === "defer") add("tracker", p.trackerActionS);
    else if (a.type === "wait" || a.type === "move") add("waiting", p.waitS);
    else if (a.type === "orderAnswer") add("checkpoints", p.orderRankS + cp("decision"));
    else if (a.type === "checkpointDone") add("checkpoints", cp("decision"));
    if (st.recaps.length > before.recaps.length && forLength(s, start.length).recapModal !== false) add("recaps", p.recapS * (st.recaps.length - before.recaps.length));
    if (st.tp.fired && !before.tp.fired) add("cutscene", p.cutsceneS);
  }
  add("results", p.resultsS);
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts };
}

/** A scripted "engaged player": answers checkpoints, handles the most urgent issue, picks the first option. */
export function scriptedRun(s: MapScenario, start: GameState, pick: (ids: string[], i: number) => string = (ids) => ids[0]): Action[] {
  const out: Action[] = [];
  let st = start;
  for (let i = 0; i < 400 && !(st.ended && st.checkpointsDue.length === 0); i++) {
    let a: Action;
    const due = st.checkpointsDue[0];
    if (due) a = due.kind === "order" ? { type: "orderAnswer", ranking: [] } : { type: "checkpointDone", id: due.id };
    else if (st.dialogue) {
      const node = nodeById(s, st.dialogue.node);
      a = { type: "choose", issue: st.dialogue.issue, option: pick(availableOptions(node, st).map((o) => o.id), i) as "a" };
    } else {
      const open = Object.entries(st.issues)
        .filter(([, x]) => x.status === "open")
        .map(([id, x]) => ({ id, deadline: x.deadline ?? Infinity }))
        .sort((x, y) => x.deadline - y.deadline);
      a = open.length ? { type: "talk", issue: open[0].id } : { type: "wait" };
    }
    out.push(a);
    st = step(s, st, a);
  }
  return out;
}
