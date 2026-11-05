import { rng } from "@/lib/engine/seed";
import { GAME } from "./config";
import type { DialogueNode, DialogueOption, Issue, MapScenario } from "./schema";
import { dayEndOf, dayOf, dayStartOf, parseTime } from "./time";

// The v2 game engine (PRD v2, A5 to A9). Pure and deterministic: the same scenario, seed and action log
// always give the same state, in map view or list view. Phaser and React only render and dispatch.

export type IssueStatus = "pending" | "open" | "resolved" | "delegated" | "deferred" | "expired";

export type IssueState = {
  status: IssueStatus;
  openedAt?: number;
  deadline?: number;
  closedAt?: number;
  outcome?: DialogueOption["id"];
  reason?: string;
  delegate?: { to: string; success: boolean }[];
};

export type GameEvent = {
  t: number;
  kind: "spawned" | "talked" | "resolved" | "delegated" | "delegate_failed" | "deferred" | "expired" | "turning_point" | "day_end" | "moved" | "market_day";
  issue?: string;
  detail?: string;
};

export type CheckpointDue = {
  id: string;
  kind: "action" | "explain" | "order";
  t: number;
  issue?: string;
  action?: "choose" | "delegate" | "defer";
  optionId?: string;
  optionLabel?: string;
  reason?: string;
  to?: string;
};

export type Recap = { day: number; budget: number; morale: number; trust: Record<string, number>; resolved: number; expired: number; deferred: number; delegated: number };

/** Quick mode (Mon to Wed) is the default in the UI; "full" is the five-day week. */
export type GameLength = "quick" | "full";

export type GameState = {
  scenarioId: string;
  length: GameLength;
  seed: string;
  t: number;
  turnBased: boolean;
  zone: string;
  budget: number;
  morale: number;
  trust: Record<string, number>;
  issues: Record<string, IssueState>;
  dialogue?: { issue: string; node: string };
  tp: { fired: boolean; disruptionId: string; at?: number; budgetBefore?: number; budgetAfter?: number };
  darkZones: string[];
  events: GameEvent[];
  choices: { issue: string; node: string; option: DialogueOption["id"]; label: string; t: number }[];
  discoveries: string[];
  plan: { seeded: string[]; fired: string[] };
  checkpointsDue: CheckpointDue[];
  videoCheckpoints: number;
  order: { asked: boolean; ranking?: string[]; askedAt?: number; did: string[] };
  moraleLowAfterTp?: number;
  recoveryAt?: number;
  recaps: Recap[];
  ended: boolean;
  /** Count of actions applied, for replay checks. */
  steps: number;
};

export type Action =
  | { type: "move"; zone: string }
  | { type: "talk"; issue: string }
  | { type: "choose"; issue: string; option: DialogueOption["id"] }
  | { type: "leave" }
  | { type: "delegate"; issue: string; to: string }
  | { type: "defer"; issue: string; reason: string }
  | { type: "drift"; minutes: number }
  | { type: "endDay" }
  | { type: "wait" }
  | { type: "orderAnswer"; ranking: string[] }
  | { type: "checkpointDone"; id: string };

export class GameError extends Error {}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function issueById(s: MapScenario, id: string): Issue {
  const i = s.issues.find((x) => x.id === id);
  if (!i) throw new GameError(`unknown issue "${id}"`);
  return i;
}
export function nodeById(s: MapScenario, id: string): DialogueNode {
  const n = s.nodes.find((x) => x.id === id);
  if (!n) throw new GameError(`unknown node "${id}"`);
  return n;
}

/** Walking cost between zones: fixed per route, never depends on how well the player moves (A4). */
export function walkMinutes(s: MapScenario, from: string, to: string): number {
  if (from === to) return 0;
  const a = s.zones.find((z) => z.id === from)!;
  const b = s.zones.find((z) => z.id === to)!;
  if (a.remote || b.remote) return 30;
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const tiles = Math.abs(ax - bx) + Math.abs(ay - by);
  return Math.max(GAME.walkMinutesPer10Tiles, Math.ceil(tiles / 10) * GAME.walkMinutesPer10Tiles);
}

const derived = new WeakMap<MapScenario, MapScenario>();

/**
 * The scenario a run of this length plays. "full" is the map as authored. "quick" applies the map's quick data:
 * fewer days, an earlier turning point, retimed issues, dropped issues that never spawn, lower checkpoint caps.
 * Ids, nodes and effects never change, so logs replay. Idempotent: a derived scenario has no quick data left.
 */
export function forLength(s: MapScenario, length: GameLength = "full"): MapScenario {
  if (length === "full" || !s.quick) return s;
  const hit = derived.get(s);
  if (hit) return hit;
  const q = s.quick;
  const out: MapScenario = {
    ...s,
    quick: undefined,
    summary: q.summary ?? s.summary,
    days: q.days,
    checkpoints: q.checkpoints,
    estimatedMinutes: Math.min(s.estimatedMinutes, 6),
    turningPoint: { ...s.turningPoint, at: q.turningPointAt },
    issues: s.issues.map((i) => {
      if (q.drop.includes(i.id)) {
        const { spawnAt: _drop, ...rest } = i;
        void _drop;
        return { ...rest, checkpointEligible: false };
      }
      return { ...i, ...q.issues[i.id] };
    }),
  };
  derived.set(s, out);
  return out;
}

const daysOf = (s: MapScenario) => s.days ?? GAME.workDays;

export function newGame(base: MapScenario, seed: string, opts: { turnBased?: boolean; length?: GameLength } = {}): GameState {
  const length = opts.length ?? "full";
  const s = forLength(base, length);
  const r = rng(`${seed}:map`);
  const disruptionId = s.turningPoint.pool[Math.floor(r() * s.turningPoint.pool.length)];
  // Follow-ups of the other disruptions never appear in this run, so they can't hold a seeded checkpoint.
  const chosen = s.turningPoint.disruptions.find((d) => d.id === disruptionId)!;
  const otherTp = new Set(s.turningPoint.disruptions.flatMap((d) => d.spawn).filter((id) => !chosen.spawn.includes(id)));
  const eligible = s.issues.filter((i) => i.checkpointEligible && !i.hidden && !otherTp.has(i.id)).map((i) => i.id);
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const seededRange = s.checkpoints?.seeded ?? GAME.seededCheckpoints;
  const count = r() < 0.5 ? seededRange[0] : seededRange[1];
  let budget = s.resources.budget.start;
  const v = s.variation["budget.start"];
  if (v) budget = Math.round((v[0] + r() * (v[1] - v[0])) / 100) * 100;

  const issues: Record<string, IssueState> = {};
  for (const i of s.issues) issues[i.id] = { status: "pending" };
  const state: GameState = {
    scenarioId: s.id,
    length,
    seed,
    t: dayStartOf(0),
    turnBased: !!opts.turnBased,
    zone: s.map.start,
    budget,
    morale: s.resources.morale.start,
    trust: Object.fromEntries(s.stakeholders.map((x) => [x.id, x.start])),
    issues,
    tp: { fired: false, disruptionId },
    darkZones: [],
    events: [],
    choices: [],
    discoveries: [],
    plan: { seeded: shuffled.slice(0, count), fired: [] },
    checkpointsDue: [],
    videoCheckpoints: 0,
    order: { asked: false, did: [] },
    recaps: [],
    ended: false,
    steps: 0,
  };
  return settle(s, state, state.t);
}

function applyEffects(state: GameState, e: Record<string, number>, share = 1): void {
  for (const [k, raw] of Object.entries(e)) {
    const d = Math.round(raw * share);
    if (k === "budget") state.budget = Math.max(0, state.budget + d);
    else if (k === "morale") state.morale = clamp(state.morale + d, 0, 100);
    else if (k.startsWith("trust.")) {
      const g = k.slice(6);
      state.trust[g] = clamp((state.trust[g] ?? 50) + d, 0, 100);
    }
  }
  if (state.tp.fired) state.moraleLowAfterTp = Math.min(state.moraleLowAfterTp ?? state.morale, state.morale);
}

/** A lifetime ends with the working day (nobody can act at night). With under 30 minutes left, it moves to the next morning. */
function lifetimeDeadline(s: MapScenario, at: number, lifetime: number): number {
  const day = dayOf(at);
  const end = dayEndOf(day);
  if (at + lifetime <= end) return at + lifetime;
  if (end - at >= 30 || day + 1 >= daysOf(s)) return Math.max(end, at + 30);
  return dayStartOf(day + 1) + 30;
}

function spawn(s: MapScenario, state: GameState, issueId: string, at: number) {
  const st = state.issues[issueId];
  if (!st || st.status !== "pending") return;
  const def = issueById(s, issueId);
  // A fixed deadline is authored on the clock; a lifetime is cut at the day end.
  const deadline = def.deadline ? Math.max(parseTime(def.deadline), at + 30) : def.lifetime ? lifetimeDeadline(s, at, Math.max(def.lifetime, 30)) : undefined;
  state.issues[issueId] = { status: "open", openedAt: at, deadline };
  state.events.push({ t: at, kind: "spawned", issue: issueId });
}

function expire(s: MapScenario, state: GameState, issueId: string, at: number) {
  const def = issueById(s, issueId);
  state.issues[issueId] = { ...state.issues[issueId], status: "expired", closedAt: at };
  applyEffects(state, def.onExpire.effects);
  state.events.push({ t: at, kind: "expired", issue: issueId });
  if (def.onExpire.spawn) spawn(s, state, def.onExpire.spawn, at);
  // Keep at least 2 seeded checkpoints possible: move a planned checkpoint off an issue that expired untouched.
  const idx = state.plan.seeded.indexOf(issueId);
  if (idx >= 0) {
    const replacement = s.issues.find(
      (i) => i.checkpointEligible && !i.hidden && !state.plan.seeded.includes(i.id) && ["pending", "open"].includes(state.issues[i.id].status),
    );
    state.plan.seeded = state.plan.seeded.filter((x) => x !== issueId).concat(replacement ? [replacement.id] : []);
  }
}

function fireTurningPoint(s: MapScenario, state: GameState, at: number) {
  const d = s.turningPoint.disruptions.find((x) => x.id === state.tp.disruptionId)!;
  const before = state.budget;
  state.budget = Math.round(state.budget * (1 - d.budgetCut));
  state.tp = { ...state.tp, fired: true, at, budgetBefore: before, budgetAfter: state.budget };
  applyEffects(state, d.effects);
  state.moraleLowAfterTp = state.morale;
  if (d.darkZone) state.darkZones.push(d.darkZone);
  state.events.push({ t: at, kind: "turning_point", detail: d.id });
  for (const id of d.spawn) spawn(s, state, id, at);
}

/** Process every scheduled thing up to `target`, in time order: deadlines, spawns, turning point, day end. */
function settle(s: MapScenario, state: GameState, target: number): GameState {
  const tpAt = parseTime(s.turningPoint.at);
  for (let guard = 0; guard < 1000 && !state.ended; guard++) {
    const day = dayOf(state.t);
    const dayEnd = dayEndOf(day);
    // Same-time order: deadlines, then spawns, then the turning point, then the day end.
    const candidates: { at: number; prio: number; run: () => void }[] = [];
    for (const i of s.issues) {
      const st = state.issues[i.id];
      if (st.status === "open" && st.deadline !== undefined) candidates.push({ at: st.deadline, prio: 0, run: () => expire(s, state, i.id, st.deadline!) });
      if (st.status === "pending" && i.spawnAt) {
        const at = parseTime(i.spawnAt);
        candidates.push({ at, prio: 1, run: () => spawn(s, state, i.id, Math.max(at, state.t)) });
      }
    }
    if (!state.tp.fired) candidates.push({ at: tpAt, prio: 2, run: () => fireTurningPoint(s, state, tpAt) });
    candidates.push({
      at: dayEnd,
      prio: 3,
      run: () => {
        if (day + 1 >= daysOf(s)) {
          // Saturday is market day: whatever is still open is out of time (counted in Friday's recap).
          for (const i of s.issues) if (state.issues[i.id].status === "open" && !i.hidden) expire(s, state, i.id, dayEnd);
        }
        state.events.push({ t: dayEnd, kind: "day_end" });
        state.recaps.push(recapOf(state, day));
        if (day + 1 >= daysOf(s)) {
          state.t = dayStartOf(daysOf(s));
          state.events.push({ t: state.t, kind: "market_day" });
          state.ended = true;
          state.dialogue = undefined;
        } else {
          state.t = dayStartOf(day + 1);
        }
      },
    });
    const next = candidates.sort((a, b) => a.at - b.at || a.prio - b.prio)[0];
    if (!next || next.at > target) break;
    state.t = Math.max(state.t, next.at);
    next.run();
    // A day end jumps the clock forward; time left over from the action is dropped.
    if (state.t > target) target = state.t;
  }
  if (!state.ended && state.t < target) state.t = target;
  maybeAskOrder(s, state);
  return state;
}

function recapOf(state: GameState, day: number): Recap {
  const byDay = state.events.filter((e) => dayOf(e.t) === day);
  return {
    day,
    budget: state.budget,
    morale: state.morale,
    trust: { ...state.trust },
    resolved: byDay.filter((e) => e.kind === "resolved").length,
    expired: byDay.filter((e) => e.kind === "expired").length,
    deferred: byDay.filter((e) => e.kind === "deferred").length,
    delegated: byDay.filter((e) => e.kind === "delegated").length,
  };
}

export const openIssues = (s: MapScenario, state: GameState) =>
  s.issues.filter((i) => state.issues[i.id].status === "open" && !i.hidden);

/** Discoveries (hidden issues) that are reachable but not yet found. */
export const hiddenAvailable = (s: MapScenario, state: GameState) =>
  s.issues.filter((i) => i.hidden && state.issues[i.id].status === "open");

function maybeAskOrder(s: MapScenario, state: GameState) {
  if (state.order.asked || state.dialogue || state.ended) return;
  if (openIssues(s, state).length >= GAME.orderQuestionOpenIssues) {
    state.order = { ...state.order, asked: true, askedAt: state.t };
    state.checkpointsDue.push({ id: "order", kind: "order", t: state.t });
  }
}

function advance(s: MapScenario, state: GameState, minutes: number) {
  return settle(s, state, state.t + minutes);
}

function logOrderMove(state: GameState, issue: string) {
  if (state.order.ranking && state.order.did.length < state.order.ranking.length && !state.order.did.includes(issue)) state.order.did.push(issue);
}

/** Video slots left after keeping room for the seeded checkpoints still to come (cap 4, A9). */
function videoSlotsLeft(s: MapScenario, state: GameState) {
  const seededLeft = state.plan.seeded.filter((id) => !state.plan.fired.includes(id)).length;
  return (s.checkpoints?.max ?? GAME.maxVideoCheckpoints) - state.videoCheckpoints - seededLeft;
}

function maybeCheckpoint(s: MapScenario, state: GameState, due: Omit<CheckpointDue, "id" | "kind" | "t">, explain: boolean) {
  const issue = due.issue!;
  const seeded = state.plan.seeded.includes(issue) && !state.plan.fired.includes(issue);
  if (seeded) {
    // A seeded checkpoint on this issue: it counts as the seeded one even if the option was also flagged.
    state.plan.fired.push(issue);
    state.videoCheckpoints++;
    state.checkpointsDue.push({ id: `cp${state.videoCheckpoints}`, kind: explain ? "explain" : "action", t: state.t, ...due });
  } else if (explain && videoSlotsLeft(s, state) > 0) {
    state.videoCheckpoints++;
    state.checkpointsDue.push({ id: `cp${state.videoCheckpoints}`, kind: "explain", t: state.t, ...due });
  }
}

/** Options the candidate can see on a node (some need a hidden discovery first). */
export function availableOptions(node: DialogueNode, state: GameState) {
  return node.options.filter((o) => o.requires.every((r) => state.discoveries.includes(r)));
}

function requireOpen(state: GameState, issue: string) {
  const st = state.issues[issue];
  if (!st) throw new GameError(`unknown issue "${issue}"`);
  if (st.status !== "open") throw new GameError(`issue "${issue}" is not open (${st.status})`);
}

/** Apply one action. Returns a new state; never mutates the input. */
export function step(base: MapScenario, prev: GameState, action: Action): GameState {
  const s = forLength(base, prev.length ?? "full");
  if (prev.ended && action.type !== "checkpointDone" && action.type !== "orderAnswer") throw new GameError("the week is over");
  const state: GameState = structuredClone(prev);
  state.steps++;
  switch (action.type) {
    case "move": {
      if (state.dialogue) throw new GameError("finish the conversation first");
      if (!s.zones.some((z) => z.id === action.zone)) throw new GameError(`unknown zone "${action.zone}"`);
      const cost = walkMinutes(s, state.zone, action.zone);
      state.zone = action.zone;
      state.events.push({ t: state.t, kind: "moved", detail: action.zone });
      return advance(s, state, cost);
    }
    case "talk": {
      if (state.dialogue) throw new GameError("already in a conversation");
      const def = issueById(s, action.issue);
      requireOpen(state, action.issue);
      if (state.zone !== def.zone) {
        const cost = walkMinutes(s, state.zone, def.zone);
        state.zone = def.zone;
        advance(s, state, cost);
        if (state.ended || state.issues[action.issue].status !== "open") return state;
      }
      state.dialogue = { issue: action.issue, node: def.node };
      state.events.push({ t: state.t, kind: "talked", issue: action.issue });
      return state;
    }
    case "leave": {
      state.dialogue = undefined;
      return state;
    }
    case "choose": {
      if (!state.dialogue || state.dialogue.issue !== action.issue) throw new GameError("not talking about that issue");
      const def = issueById(s, action.issue);
      const node = nodeById(s, def.node);
      const opt = availableOptions(node, state).find((o) => o.id === action.option);
      if (!opt) throw new GameError(`option "${action.option}" is not available`);
      state.dialogue = undefined;
      state.issues[action.issue] = { ...state.issues[action.issue], status: "resolved", closedAt: state.t, outcome: opt.id };
      state.choices.push({ issue: action.issue, node: node.id, option: opt.id, label: opt.label, t: state.t });
      state.events.push({ t: state.t, kind: "resolved", issue: action.issue, detail: opt.id });
      applyEffects(state, opt.effects);
      if (opt.kpi.discovery && !state.discoveries.includes(opt.kpi.discovery)) state.discoveries.push(opt.kpi.discovery);
      if (def.tags.includes("discovery") && !state.discoveries.includes(def.id)) state.discoveries.push(def.id);
      if (def.tags.includes("recovery") && state.recoveryAt === undefined) state.recoveryAt = state.t;
      for (const u of opt.unlocks) spawn(s, state, u, state.t);
      logOrderMove(state, action.issue);
      maybeCheckpoint(s, state, { issue: action.issue, action: "choose", optionId: opt.id, optionLabel: opt.label }, opt.explainOnPick);
      return advance(s, state, def.talkCost + opt.minutes);
    }
    case "delegate": {
      if (state.dialogue) throw new GameError("finish the conversation first");
      const def = issueById(s, action.issue);
      requireOpen(state, action.issue);
      if (!def.delegable) throw new GameError("this one needs you");
      const vol = s.npcs.find((n) => n.id === action.to && n.volunteer);
      if (!vol) throw new GameError(`"${action.to}" can't take delegated work`);
      const prior = state.issues[action.issue].delegate ?? [];
      if (prior.some((d) => d.to === action.to)) throw new GameError("already tried that volunteer");
      const score = vol.volunteer!.reliability * 100 + (state.morale - 50) / 2;
      const success = score >= GAME.delegateThreshold[def.severity];
      applyEffects(state, { morale: -GAME.delegateMoraleCost });
      const delegate = [...prior, { to: action.to, success }];
      if (success) {
        state.issues[action.issue] = { ...state.issues[action.issue], status: "delegated", closedAt: state.t, delegate };
        applyEffects(state, def.delegateEffects);
        state.events.push({ t: state.t, kind: "delegated", issue: action.issue, detail: action.to });
      } else {
        state.issues[action.issue] = { ...state.issues[action.issue], delegate };
        state.events.push({ t: state.t, kind: "delegate_failed", issue: action.issue, detail: action.to });
      }
      logOrderMove(state, action.issue);
      maybeCheckpoint(s, state, { issue: action.issue, action: "delegate", to: vol.name }, false);
      return advance(s, state, GAME.delegateMinutes);
    }
    case "defer": {
      if (state.dialogue) throw new GameError("finish the conversation first");
      const def = issueById(s, action.issue);
      requireOpen(state, action.issue);
      if (!s.deferReasons.includes(action.reason)) throw new GameError("pick a reason to defer");
      state.issues[action.issue] = { ...state.issues[action.issue], status: "deferred", closedAt: state.t, reason: action.reason };
      applyEffects(state, def.onExpire.effects, GAME.deferPenaltyShare);
      state.events.push({ t: state.t, kind: "deferred", issue: action.issue, detail: action.reason });
      logOrderMove(state, action.issue);
      maybeCheckpoint(s, state, { issue: action.issue, action: "defer", reason: action.reason }, false);
      return advance(s, state, GAME.deferMinutes);
    }
    case "drift": {
      // Turn-based mode: only actions cost time (A5). Drift never runs during a conversation.
      if (state.turnBased || state.dialogue || state.ended) return prev;
      return advance(s, state, action.minutes);
    }
    case "wait": {
      // Wait for the next thing to happen (next problem or the end of the day). Turn-based and list view use it.
      if (state.dialogue) throw new GameError("finish the conversation first");
      const end = dayEndOf(dayOf(state.t));
      const next = s.issues
        .filter((i) => state.issues[i.id].status === "pending" && i.spawnAt && parseTime(i.spawnAt) > state.t)
        .map((i) => parseTime(i.spawnAt!))
        .concat(state.tp.fired ? [] : [parseTime(s.turningPoint.at)])
        .filter((x) => x > state.t)
        .sort((a, b) => a - b)[0];
      return settle(s, state, Math.min(next ?? end, end));
    }
    case "endDay": {
      if (state.dialogue) throw new GameError("finish the conversation first");
      return settle(s, state, dayEndOf(dayOf(state.t)) + 1);
    }
    case "orderAnswer": {
      state.order = { ...state.order, ranking: action.ranking.slice(0, 3) };
      state.checkpointsDue = state.checkpointsDue.filter((c) => c.kind !== "order");
      return state;
    }
    case "checkpointDone": {
      state.checkpointsDue = state.checkpointsDue.filter((c) => c.id !== action.id);
      return state;
    }
  }
}

/** Replay a whole input log (A10, A16). */
export function replay(s: MapScenario, seed: string, actions: Action[], opts: { turnBased?: boolean; length?: GameLength } = {}): GameState {
  return actions.reduce((st, a) => step(s, st, a), newGame(s, seed, opts));
}

export const isPaused = (state: GameState) => !!state.dialogue || state.checkpointsDue.length > 0 || state.ended;
