import { z } from "zod";
import { SKILL_SLUGS } from "@/lib/engine/skills";
import { parseTime } from "./time";

// Map scenario format (PRD v2, A3 to A7, A12). Scenarios are data; one engine plays any of them.

const id = z.string().min(1).regex(/^[a-z0-9-]+$/, "ids are lowercase-with-dashes");
const skill = z.enum(SKILL_SLUGS);
const gameTime = z.string().refine((s) => {
  try {
    parseTime(s);
    return true;
  } catch {
    return false;
  }
}, "use a game time like \"Wed 14:20\"");
/** Resource deltas. Keys: "budget", "morale", or "trust.<stakeholder>". */
const effects = z.record(z.string(), z.number()).default({});
const expression = z.enum(["neutral", "worried", "happy", "angry"]);
const emote = z.enum(["heart", "sweat", "anger", "note", "exclaim", "question"]);

export const ZoneSchema = z.object({
  id,
  name: z.string(),
  /** Tile rectangle on the 40x30 map. */
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  /** Zones reached by fast travel only (e.g. a bus stop to the client site). */
  remote: z.boolean().default(false),
});

export const LookSchema = z.object({
  skin: z.string(),
  hair: z.string(),
  hairStyle: z.enum(["short", "bun", "curly", "long", "bald", "spiky"]),
  outfit: z.string(),
  accent: z.string().optional(),
  extra: z.enum(["glasses", "apron", "vest", "none"]).default("none"),
});

export const NpcSchema = z.object({
  id,
  name: z.string(),
  role: z.string(),
  zone: id,
  tile: z.object({ x: z.number().int(), y: z.number().int() }),
  /** Portrait id in public/assets/portraits/manifest.json. */
  portrait: z.string(),
  look: LookSchema,
  /** Volunteers can take delegated issues. */
  volunteer: z.object({ reliability: z.number().min(0).max(1) }).optional(),
  /** Ambient NPCs never hold issues. */
  ambient: z.boolean().default(false),
});

export const LineSchema = z.object({
  who: z.string(),
  text: z.string().min(1),
  expression: expression.default("neutral"),
});

export const OptionSchema = z.object({
  id: z.enum(["a", "b", "c", "d"]),
  label: z.string().min(1),
  effects,
  /** Extra game minutes this decision takes beyond the conversation. */
  minutes: z.number().int().min(0).default(0),
  /** Picking this opens a video checkpoint immediately (A9). */
  explainOnPick: z.boolean().default(false),
  reaction: z.object({ emote, expression, line: z.string().optional() }).optional(),
  /** Issues this choice spawns (follow-ups) and discoveries it requires to be shown. */
  unlocks: z.array(id).default([]),
  requires: z.array(id).default([]),
  /** KPI hooks read by lib/game/kpis.ts. */
  kpi: z
    .object({
      coreBudgetShare: z.number().min(0).max(1).optional(),
      feedback: z.enum(["open", "defensive", "dismissive"]).optional(),
      insight: z.enum(["correct", "partial", "wrong"]).optional(),
      discovery: id.optional(),
      fit: z.enum(["good", "poor"]).optional(),
    })
    .default({}),
});

export const NodeSchema = z.object({
  id,
  npc: z.string(),
  lines: z.array(LineSchema).min(1),
  prompt: z.string().min(1),
  options: z.array(OptionSchema).min(2).max(4),
  /** Optional mini data view (Client Pivot): simple bar charts. */
  charts: z
    .array(z.object({ title: z.string(), unit: z.string().default(""), points: z.array(z.tuple([z.string(), z.number()])).min(2) }))
    .optional(),
});

export const IssueSchema = z.object({
  id,
  title: z.string().min(1),
  npc: id,
  zone: id,
  /** Spawn time; issues without one only appear when something spawns them. */
  spawnAt: gameTime.optional(),
  deadline: gameTime.optional(),
  /** For triggered issues: minutes from spawn to deadline. */
  lifetime: z.number().int().positive().optional(),
  severity: z.enum(["low", "medium", "high"]),
  talkCost: z.number().int().min(15).max(120),
  node: id,
  delegable: z.boolean().default(true),
  /** Outcome when a volunteer handles it successfully. */
  delegateEffects: effects,
  onExpire: z.object({ effects, spawn: id.optional() }).default({ effects: {} }),
  skillSignals: z.array(skill).default([]),
  checkpointEligible: z.boolean().default(false),
  /** Hidden discoveries: no "!" bubble, never required, never counted as open (A12). */
  hidden: z.boolean().default(false),
  tags: z.array(z.enum(["recovery", "feedback", "data", "discovery", "pitch"])).default([]),
});

export const DisruptionSchema = z.object({
  id,
  title: z.string(),
  caller: id,
  text: z.string(),
  effects,
  /** Budget drop as a share of current budget (applied before effects), e.g. 0.6. */
  budgetCut: z.number().min(0).max(1).default(0),
  darkZone: id.optional(),
  spawn: z.array(id).default([]),
});

export const MapScenarioSchema = z
  .object({
    id,
    version: z.number().int().positive(),
    title: z.string(),
    summary: z.string(),
    role: z.string(),
    industryFlavour: z.string(),
    targetSkills: z.array(skill).min(1),
    estimatedMinutes: z.number().positive().default(14),
    map: z.object({ tiled: z.string(), width: z.number().int(), height: z.number().int(), start: id }),
    resources: z.object({
      budget: z.object({ label: z.string(), start: z.number(), unit: z.string().default("$") }),
      morale: z.object({ label: z.string(), start: z.number().min(0).max(100) }),
    }),
    stakeholders: z.array(z.object({ id, label: z.string(), start: z.number().min(0).max(100) })).min(1),
    zones: z.array(ZoneSchema).min(2),
    npcs: z.array(NpcSchema).min(1),
    nodes: z.array(NodeSchema).min(1),
    issues: z.array(IssueSchema).min(1),
    turningPoint: z.object({ at: gameTime, disruptions: z.array(DisruptionSchema).min(1), pool: z.array(id).min(1) }),
    deferReasons: z.array(z.string()).min(2),
    variation: z.record(z.string(), z.tuple([z.number(), z.number()])).default({}),
  })
  .superRefine((s, ctx) => {
    const err = (message: string) => ctx.addIssue({ code: "custom", message });
    const zones = new Set(s.zones.map((z) => z.id));
    const npcs = new Set(s.npcs.map((n) => n.id));
    const nodes = new Set(s.nodes.map((n) => n.id));
    const issues = new Set(s.issues.map((i) => i.id));
    const stake = new Set(s.stakeholders.map((x) => x.id));
    const checkEffects = (where: string, e: Record<string, number>) => {
      for (const k of Object.keys(e)) {
        if (k === "budget" || k === "morale") continue;
        const m = k.match(/^trust\.(.+)$/);
        if (!m || !stake.has(m[1])) err(`${where} changes unknown resource "${k}"`);
      }
    };
    if (!zones.has(s.map.start)) err(`map.start "${s.map.start}" is not a zone`);
    for (const n of s.npcs) if (!zones.has(n.zone)) err(`npc "${n.id}" is in unknown zone "${n.zone}"`);
    for (const n of s.nodes) {
      for (const o of n.options) {
        checkEffects(`node ${n.id} option ${o.id}`, o.effects);
        for (const u of o.unlocks) if (!issues.has(u)) err(`node ${n.id} option ${o.id} unlocks unknown issue "${u}"`);
        for (const r of o.requires) if (!issues.has(r)) err(`node ${n.id} option ${o.id} requires unknown discovery "${r}"`);
      }
      if (n.options.filter((o) => o.requires.length === 0).length < 2) err(`node ${n.id} needs 2 options with no requirements`);
    }
    for (const i of s.issues) {
      if (!npcs.has(i.npc)) err(`issue ${i.id} has unknown npc "${i.npc}"`);
      if (!zones.has(i.zone)) err(`issue ${i.id} has unknown zone "${i.zone}"`);
      if (!nodes.has(i.node)) err(`issue ${i.id} points to missing node "${i.node}"`);
      if (i.onExpire.spawn && !issues.has(i.onExpire.spawn)) err(`issue ${i.id} spawns unknown issue "${i.onExpire.spawn}" on expiry`);
      checkEffects(`issue ${i.id} onExpire`, i.onExpire.effects);
      checkEffects(`issue ${i.id} delegateEffects`, i.delegateEffects);
      if (i.spawnAt && i.deadline && parseTime(i.deadline) <= parseTime(i.spawnAt)) err(`issue ${i.id} deadline is not after spawn`);
      if (!i.hidden && !i.deadline && !i.lifetime) err(`issue ${i.id} needs a deadline or a lifetime`);
    }
    for (const d of s.turningPoint.disruptions) {
      checkEffects(`disruption ${d.id}`, d.effects);
      if (!npcs.has(d.caller)) err(`disruption ${d.id} has unknown caller "${d.caller}"`);
      for (const sp of d.spawn) if (!issues.has(sp)) err(`disruption ${d.id} spawns unknown issue "${sp}"`);
      if (d.darkZone && !zones.has(d.darkZone)) err(`disruption ${d.id} darkens unknown zone "${d.darkZone}"`);
      if (!d.spawn.some((sp) => s.issues.find((i) => i.id === sp)?.tags.includes("recovery"))) err(`disruption ${d.id} spawns no recovery issue`);
    }
    for (const p of s.turningPoint.pool) if (!s.turningPoint.disruptions.some((d) => d.id === p)) err(`pool has unknown disruption "${p}"`);
    if (!s.issues.some((i) => i.tags.includes("recovery"))) err("needs a recovery-plan issue");
    if (s.issues.filter((i) => i.checkpointEligible).length < 3) err("needs at least 3 checkpoint-eligible issues");
  });

export type MapScenario = z.infer<typeof MapScenarioSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type DialogueNode = z.infer<typeof NodeSchema>;
export type DialogueOption = z.infer<typeof OptionSchema>;
export type Npc = z.infer<typeof NpcSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type Look = z.infer<typeof LookSchema>;

export function parseMapScenario(json: unknown): MapScenario {
  const r = MapScenarioSchema.safeParse(json);
  if (!r.success) throw new Error("Invalid map scenario:\n" + r.error.issues.map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n"));
  return r.data;
}
