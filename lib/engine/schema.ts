import { z } from "zod";
import { SKILL_SLUGS } from "./skills";

// Scenario JSON schema (PRD, Scenario engine). Scenarios are data: one engine plays any of them.

const id = z.string().min(1).regex(/^[A-Za-z0-9_-]+$/, "ids use letters, digits, - and _");
const skill = z.enum(SKILL_SLUGS);
// Resource deltas, e.g. { "budget": -500, "morale": 5 }.
const effects = z.record(z.string(), z.number()).default({});
// Optional art: key of a file in public/art, with alt text (C2.6).
const art = z.object({ key: z.string().min(1), alt: z.string().min(1) });

export const ResourceSchema = z.object({
  label: z.string().min(1),
  start: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
});

export const OptionSchema = z.object({
  id,
  label: z.string().min(1),
  effects,
  next: id,
});

const base = { id, text: z.string().min(1), art: art.optional() };

export const SceneNode = z.object({ ...base, type: z.literal("scene"), next: id });

export const ChoiceNode = z.object({
  ...base,
  type: z.literal("choice"),
  options: z.array(OptionSchema).min(2).max(4),
  checkpointEligible: z.boolean().default(false),
  skillSignals: z.array(skill).default([]),
  // Pre-written question used when the AI question is late or fails (PRD, AI pipeline).
  fallbackQuestion: z.string().optional(),
});

// A scripted event. If turningPoint is true, the engine swaps in the seeded disruption
// (its text, effects and next) instead of this node's own.
export const EventNode = z.object({
  ...base,
  type: z.literal("event"),
  turningPoint: z.boolean().default(false),
  effects,
  next: id.optional(),
});

// Placeholder the engine may activate. "real_life" is the final checkpoint (C5).
export const CheckpointNode = z.object({
  ...base,
  type: z.literal("checkpoint"),
  kind: z.enum(["decision", "real_life"]).default("real_life"),
  next: id,
});

export const EndNode = z.object({ ...base, type: z.literal("end") });

export const NodeSchema = z.discriminatedUnion("type", [SceneNode, ChoiceNode, EventNode, CheckpointNode, EndNode]);

export const DisruptionSchema = z.object({
  id,
  title: z.string().min(1),
  text: z.string().min(1),
  effects,
  next: id,
  art: art.optional(),
});

const ScenarioBase = z.object({
  id,
  version: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().optional(),
  industryFlavour: z.string().min(1),
  targetSkills: z.array(skill).min(1),
  start: id,
  resources: z.record(z.string(), ResourceSchema),
  // Per-candidate number ranges, e.g. { "budget.start": [4000, 6000], "teamSize": [6, 10] }.
  // Text can use {teamSize} or {budget} placeholders.
  variation: z.record(z.string(), z.tuple([z.number(), z.number()])).default({}),
  disruptions: z.array(DisruptionSchema).min(1),
  disruptionPool: z.array(id).min(1),
  // Minutes for a typical run, shown in the builder (E1.2).
  estimatedMinutes: z.number().positive().optional(),
  nodes: z.array(NodeSchema).min(2),
});

export type Scenario = z.infer<typeof ScenarioBase>;
export type ScenarioNode = z.infer<typeof NodeSchema>;
export type ChoiceNodeT = z.infer<typeof ChoiceNode>;
export type Disruption = z.infer<typeof DisruptionSchema>;

/** Every node id a node can lead to. Turning-point events can lead to any disruption's next. */
export function successors(s: Scenario, n: ScenarioNode): string[] {
  switch (n.type) {
    case "scene":
    case "checkpoint":
      return [n.next];
    case "choice":
      return n.options.map((o) => o.next);
    case "event":
      if (n.turningPoint) return s.disruptions.filter((d) => s.disruptionPool.includes(d.id)).map((d) => d.next);
      return n.next ? [n.next] : [];
    case "end":
      return [];
  }
}

/** Graph checks the PRD requires on top of the shape: returns a list of problems (empty = valid). */
export function graphProblems(s: Scenario): string[] {
  const problems: string[] = [];
  const byId = new Map<string, ScenarioNode>();
  for (const n of s.nodes) {
    if (byId.has(n.id)) problems.push(`duplicate node id "${n.id}"`);
    byId.set(n.id, n);
  }
  if (!byId.has(s.start)) problems.push(`start node "${s.start}" does not exist`);

  for (const n of s.nodes) {
    if (n.type === "event" && !n.turningPoint && !n.next) problems.push(`event "${n.id}" has no next`);
    if (n.type === "choice") {
      const ids = n.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) problems.push(`choice "${n.id}" has duplicate option ids`);
    }
    for (const t of successors(s, n)) {
      if (!byId.has(t)) problems.push(`"${n.id}" points to missing node "${t}"`);
    }
  }
  for (const d of s.disruptions) {
    if (!byId.has(d.next)) problems.push(`disruption "${d.id}" points to missing node "${d.next}"`);
  }
  for (const p of s.disruptionPool) {
    if (!s.disruptions.some((d) => d.id === p)) problems.push(`disruptionPool has unknown disruption "${p}"`);
  }
  for (const n of s.nodes) {
    const keys = [
      ...(n.type === "choice" ? n.options.flatMap((o) => Object.keys(o.effects)) : []),
      ...(n.type === "event" ? Object.keys(n.effects) : []),
    ];
    for (const k of keys) if (!(k in s.resources)) problems.push(`"${n.id}" changes unknown resource "${k}"`);
  }
  for (const d of s.disruptions) {
    for (const k of Object.keys(d.effects)) if (!(k in s.resources)) problems.push(`disruption "${d.id}" changes unknown resource "${k}"`);
  }
  if (problems.length) return problems;

  // Reachability from start.
  const reachable = new Set<string>();
  const stack = [s.start];
  while (stack.length) {
    const cur = stack.pop()!;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    stack.push(...successors(s, byId.get(cur)!));
  }
  for (const n of s.nodes) if (!reachable.has(n.id)) problems.push(`node "${n.id}" is unreachable`);

  // Every reachable node must have some path to an end node.
  const canEnd = new Set(s.nodes.filter((n) => n.type === "end").map((n) => n.id));
  if (canEnd.size === 0) problems.push("scenario has no end node");
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of s.nodes) {
      if (!canEnd.has(n.id) && successors(s, n).some((t) => canEnd.has(t))) {
        canEnd.add(n.id);
        changed = true;
      }
    }
  }
  for (const n of s.nodes) if (reachable.has(n.id) && !canEnd.has(n.id)) problems.push(`node "${n.id}" has no path to an end`);

  const eligible = s.nodes.filter((n) => n.type === "choice" && n.checkpointEligible).length;
  if (eligible < 3) problems.push(`needs at least 3 checkpoint-eligible choices, has ${eligible}`);
  if (!s.nodes.some((n) => n.type === "event" && n.turningPoint)) problems.push("needs a turning-point event");

  return problems;
}

export const ScenarioSchema = ScenarioBase.superRefine((s, ctx) => {
  for (const message of graphProblems(s)) ctx.addIssue({ code: "custom", message });
});

/** Parse and fully validate a scenario. Throws a readable error listing every problem. */
export function parseScenario(json: unknown): Scenario {
  const r = ScenarioSchema.safeParse(json);
  if (!r.success) {
    throw new Error("Invalid scenario:\n" + r.error.issues.map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n"));
  }
  return r.data;
}
