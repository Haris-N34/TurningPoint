import type { Disruption, Scenario, ScenarioNode } from "./schema";
import { successors } from "./schema";
import type { RunPlan } from "./seed";

// Pure, deterministic game engine. No React, no storage. Fully unit tested.

export type ChoiceLogEntry = {
  nodeId: string;
  optionId: string;
  optionLabel: string;
  /** Milliseconds the candidate took to decide (C2.3). */
  decidedMs: number;
  /** ISO timestamp of the decision. */
  at: string;
  resourcesAfter: Record<string, number>;
};

export type RunState = {
  scenarioId: string;
  scenarioVersion: number;
  seed: string;
  nodeId: string;
  resources: Record<string, number>;
  log: ChoiceLogEntry[];
  /** Node ids in the order they were entered. */
  path: string[];
  turningPointNodeId?: string;
  status: "playing" | "ended";
};

export type CheckpointDue = {
  nodeId: string;
  /** The last 1 to 3 choices, newest last, for the checkpoint question (C4.2). */
  recentChoices: ChoiceLogEntry[];
  resources: Record<string, number>;
};

export type NodeView =
  | { kind: "scene"; node: ScenarioNode; text: string }
  | { kind: "choice"; node: Extract<ScenarioNode, { type: "choice" }>; text: string }
  | { kind: "event"; node: ScenarioNode; text: string; title?: string; turningPoint: boolean; disruption?: Disruption }
  | { kind: "checkpoint"; node: Extract<ScenarioNode, { type: "checkpoint" }>; text: string }
  | { kind: "end"; node: ScenarioNode; text: string };

export class EngineError extends Error {}

function nodeById(s: Scenario, id: string): ScenarioNode {
  const n = s.nodes.find((x) => x.id === id);
  if (!n) throw new EngineError(`unknown node "${id}"`);
  return n;
}

export function disruptionFor(s: Scenario, plan: RunPlan): Disruption {
  const d = s.disruptions.find((x) => x.id === plan.disruptionId);
  if (!d) throw new EngineError(`unknown disruption "${plan.disruptionId}"`);
  return d;
}

function clamp(s: Scenario, key: string, v: number): number {
  const r = s.resources[key];
  if (r.min !== undefined && v < r.min) v = r.min;
  if (r.max !== undefined && v > r.max) v = r.max;
  return v;
}

function applyEffects(s: Scenario, resources: Record<string, number>, effects: Record<string, number>) {
  const next = { ...resources };
  for (const [k, d] of Object.entries(effects)) next[k] = clamp(s, k, (next[k] ?? 0) + d);
  return next;
}

/** Enter a node: record it and apply event effects (so the takeover can show the drop). */
function enter(s: Scenario, plan: RunPlan, state: RunState, id: string): RunState {
  const node = nodeById(s, id);
  let resources = state.resources;
  let turningPointNodeId = state.turningPointNodeId;
  if (node.type === "event") {
    if (node.turningPoint) {
      resources = applyEffects(s, resources, disruptionFor(s, plan).effects);
      turningPointNodeId = node.id;
    } else {
      resources = applyEffects(s, resources, node.effects);
    }
  }
  return {
    ...state,
    nodeId: id,
    resources,
    turningPointNodeId,
    path: [...state.path, id],
    status: node.type === "end" ? "ended" : "playing",
  };
}

export function startRun(s: Scenario, plan: RunPlan): RunState {
  const resources: Record<string, number> = {};
  for (const [k, r] of Object.entries(s.resources)) {
    const v = plan.vars[`${k}.start`];
    resources[k] = clamp(s, k, v ?? r.start);
  }
  const blank: RunState = {
    scenarioId: s.id,
    scenarioVersion: s.version,
    seed: plan.seed,
    nodeId: s.start,
    resources,
    log: [],
    path: [],
    status: "playing",
  };
  return enter(s, plan, blank, s.start);
}

/** Replace {placeholders} with run variables or current resource values. */
export function interpolate(text: string, plan: RunPlan, resources: Record<string, number>): string {
  return text.replace(/\{([A-Za-z0-9_.]+)\}/g, (m, key: string) => {
    if (key in plan.vars) return String(plan.vars[key]);
    if (key in resources) return String(resources[key]);
    return m;
  });
}

export function view(s: Scenario, plan: RunPlan, state: RunState): NodeView {
  const node = nodeById(s, state.nodeId);
  const t = (x: string) => interpolate(x, plan, state.resources);
  switch (node.type) {
    case "scene":
      return { kind: "scene", node, text: t(node.text) };
    case "choice":
      return { kind: "choice", node, text: t(node.text) };
    case "event":
      if (node.turningPoint) {
        const d = disruptionFor(s, plan);
        return { kind: "event", node, text: t(d.text), title: d.title, turningPoint: true, disruption: d };
      }
      return { kind: "event", node, text: t(node.text), turningPoint: false };
    case "checkpoint":
      return { kind: "checkpoint", node, text: t(node.text) };
    case "end":
      return { kind: "end", node, text: t(node.text) };
  }
}

/** Make a choice. Returns the new state and, if this node was picked by the seed, a due checkpoint. */
export function choose(
  s: Scenario,
  plan: RunPlan,
  state: RunState,
  optionId: string,
  decidedMs: number,
  now: Date = new Date(),
): { state: RunState; checkpoint?: CheckpointDue } {
  if (state.status !== "playing") throw new EngineError("run has ended");
  const node = nodeById(s, state.nodeId);
  if (node.type !== "choice") throw new EngineError(`node "${node.id}" is not a choice`);
  const opt = node.options.find((o) => o.id === optionId);
  if (!opt) throw new EngineError(`no option "${optionId}" on "${node.id}"`);

  const resources = applyEffects(s, state.resources, opt.effects);
  const entry: ChoiceLogEntry = {
    nodeId: node.id,
    optionId: opt.id,
    optionLabel: interpolate(opt.label, plan, state.resources),
    decidedMs: Math.max(0, Math.round(decidedMs)),
    at: now.toISOString(),
    resourcesAfter: resources,
  };
  const afterChoice: RunState = { ...state, resources, log: [...state.log, entry] };
  const next = enter(s, plan, afterChoice, opt.next);
  const checkpoint = plan.checkpointNodeIds.includes(node.id)
    ? { nodeId: node.id, recentChoices: next.log.slice(-3), resources }
    : undefined;
  return { state: next, checkpoint };
}

/** Continue past a scene, event or checkpoint node. */
export function advance(s: Scenario, plan: RunPlan, state: RunState): RunState {
  if (state.status !== "playing") throw new EngineError("run has ended");
  const node = nodeById(s, state.nodeId);
  if (node.type === "choice" || node.type === "end") throw new EngineError(`cannot advance from a ${node.type} node`);
  let nextId: string | undefined;
  if (node.type === "event" && node.turningPoint) nextId = disruptionFor(s, plan).next;
  else if (node.type === "event") nextId = node.next;
  else nextId = node.next;
  if (!nextId) throw new EngineError(`event "${node.id}" has no next`);
  return enter(s, plan, state, nextId);
}

/** Shortest number of steps from a node to any end node (for progress estimates). */
function distanceToEnd(s: Scenario, plan: RunPlan, from: string): number {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    const n = nodeById(s, cur);
    if (n.type === "end") return dist.get(cur)!;
    const next = n.type === "event" && n.turningPoint ? [disruptionFor(s, plan).next] : successors(s, n);
    for (const t of next) {
      if (!dist.has(t)) {
        dist.set(t, dist.get(cur)! + 1);
        queue.push(t);
      }
    }
  }
  return Infinity;
}

/** Fraction of the run completed, 0 to 1 (drives the progress map and the 40-60% rule, C3.1). */
export function progress(s: Scenario, plan: RunPlan, state: RunState): number {
  if (state.status === "ended") return 1;
  const done = state.path.length - 1;
  const left = distanceToEnd(s, plan, state.nodeId);
  return done / (done + left);
}

/** Replay a stored run from its seed and choice log (C2.4 resume, audit). */
export function replay(s: Scenario, plan: RunPlan, log: Pick<ChoiceLogEntry, "optionId" | "decidedMs" | "at">[]): RunState {
  let state = startRun(s, plan);
  let i = 0;
  while (state.status === "playing") {
    const n = nodeById(s, state.nodeId);
    if (n.type === "choice") {
      const e = log[i++];
      if (!e) break;
      state = choose(s, plan, state, e.optionId, e.decidedMs, new Date(e.at)).state;
    } else {
      state = advance(s, plan, state);
    }
  }
  return state;
}
