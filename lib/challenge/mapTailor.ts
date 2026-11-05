import { z } from "zod";
import { getMapScenario, MAP_FOR_TEMPLATE } from "@/content/maps";
import { parseMapScenario, type MapScenario } from "@/lib/game/schema";
import { LEX, swap, type Industry } from "./tailor";

// Employer edits to a v2 map (E1.3, E1.4). Only wording and checkpoint eligibility change; ids, effects,
// times and structure never do, so a run's action log replays the same on the edited map.

const texts = z.record(z.string(), z.string().min(1));
export const MapOverridesSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  /** NPC lines, keyed "node:index". */
  lines: texts.default({}),
  /** The question under each node, keyed by node id. */
  prompts: texts.default({}),
  /** Option labels and reaction lines, keyed "node:option". */
  options: texts.default({}),
  reactions: texts.default({}),
  issues: z.record(z.string(), z.object({ title: z.string().min(1).optional(), checkpointEligible: z.boolean().optional() })).default({}),
  disruptions: z.record(z.string(), z.object({ title: z.string().min(1).optional(), text: z.string().min(1).optional() })).default({}),
});
export type MapOverrides = z.infer<typeof MapOverridesSchema>;

/** The v2 map a template plays as, if it has one. */
export function mapForTemplate(templateId: string): { mapId: string; map: MapScenario } | undefined {
  const mapId = MAP_FOR_TEMPLATE[templateId];
  const map = mapId ? getMapScenario(mapId) : undefined;
  return mapId && map ? { mapId, map } : undefined;
}

/** Apply text and eligibility edits to a copy of the map. Unknown keys are ignored. No validation. */
function merge(base: MapScenario, ov: MapOverrides): MapScenario {
  const m = structuredClone(base);
  if (ov.title) m.title = ov.title;
  if (ov.summary) m.summary = ov.summary;
  if (ov.role) m.role = ov.role;
  for (const n of m.nodes) {
    n.lines.forEach((l, i) => (l.text = ov.lines[`${n.id}:${i}`] ?? l.text));
    n.prompt = ov.prompts[n.id] ?? n.prompt;
    for (const o of n.options) {
      o.label = ov.options[`${n.id}:${o.id}`] ?? o.label;
      if (o.reaction?.line) o.reaction.line = ov.reactions[`${n.id}:${o.id}`] ?? o.reaction.line;
    }
  }
  for (const i of m.issues) {
    const e = ov.issues[i.id];
    if (e?.title) i.title = e.title;
    if (e?.checkpointEligible !== undefined) i.checkpointEligible = e.checkpointEligible;
  }
  for (const d of m.turningPoint.disruptions) {
    const e = ov.disruptions[d.id];
    if (e?.title) d.title = e.title;
    if (e?.text) d.text = e.text;
  }
  return m;
}

/** The edited map, validated. Throws when the edits break a rule (e.g. fewer than 3 checkpoint-eligible issues). */
export const parseMapWithOverrides = (base: MapScenario, ov?: MapOverrides): MapScenario => (ov ? parseMapScenario(merge(base, MapOverridesSchema.parse(ov))) : base);

/** The map candidates play. Invalid edits are never used: the original map plays instead. */
export function applyMapOverrides(base: MapScenario, ov?: MapOverrides): MapScenario {
  try {
    return parseMapWithOverrides(base, ov);
  } catch {
    return base;
  }
}

/** Only what differs from the base map, so the challenge stores a small diff. */
export function diffMap(base: MapScenario, edited: MapScenario): MapOverrides {
  const ov: MapOverrides = { lines: {}, prompts: {}, options: {}, reactions: {}, issues: {}, disruptions: {} };
  if (edited.title !== base.title) ov.title = edited.title;
  if (edited.summary !== base.summary) ov.summary = edited.summary;
  if (edited.role !== base.role) ov.role = edited.role;
  for (const n of base.nodes) {
    const e = edited.nodes.find((x) => x.id === n.id);
    if (!e) continue;
    n.lines.forEach((l, i) => e.lines[i] && e.lines[i].text !== l.text && (ov.lines[`${n.id}:${i}`] = e.lines[i].text));
    if (e.prompt !== n.prompt) ov.prompts[n.id] = e.prompt;
    for (const o of n.options) {
      const eo = e.options.find((x) => x.id === o.id);
      if (eo && eo.label !== o.label) ov.options[`${n.id}:${o.id}`] = eo.label;
      if (eo?.reaction?.line && o.reaction?.line && eo.reaction.line !== o.reaction.line) ov.reactions[`${n.id}:${o.id}`] = eo.reaction.line;
    }
  }
  for (const i of base.issues) {
    const e = edited.issues.find((x) => x.id === i.id);
    if (!e) continue;
    const d: MapOverrides["issues"][string] = {};
    if (e.title !== i.title) d.title = e.title;
    if (e.checkpointEligible !== i.checkpointEligible) d.checkpointEligible = e.checkpointEligible;
    if (Object.keys(d).length) ov.issues[i.id] = d;
  }
  for (const d of base.turningPoint.disruptions) {
    const e = edited.turningPoint.disruptions.find((x) => x.id === d.id);
    if (!e) continue;
    const x: MapOverrides["disruptions"][string] = {};
    if (e.title !== d.title) x.title = e.title;
    if (e.text !== d.text) x.text = e.text;
    if (Object.keys(x).length) ov.disruptions[d.id] = x;
  }
  return ov;
}

export type MapTailorResult = { map: MapScenario; changed: boolean; error?: string };

/** Industry tailoring for a map (E1.3): the same local word swaps as the classic tailor, on dialogue text only. */
export function tailorMap(base: MapScenario, industry: Industry, company?: string): MapTailorResult {
  const lex = LEX[industry];
  if (!lex.length) return { map: base, changed: false };
  // Maps say "community market" where classic templates say "pop-up food market"; both get the same event name.
  const event = lex[0][1] as string;
  const t = (s: string) => swap(s, [[/(?:weekend )?community market/gi, event], ...lex], company);
  try {
    const m = structuredClone(base);
    m.title = t(m.title);
    m.summary = t(m.summary);
    m.role = t(m.role);
    m.industryFlavour = industry.toLowerCase();
    for (const n of m.nodes) {
      for (const l of n.lines) l.text = t(l.text);
      n.prompt = t(n.prompt);
      for (const o of n.options) {
        o.label = t(o.label);
        if (o.reaction?.line) o.reaction.line = t(o.reaction.line);
      }
    }
    for (const i of m.issues) i.title = t(i.title);
    for (const d of m.turningPoint.disruptions) {
      d.title = t(d.title);
      d.text = t(d.text);
    }
    return { map: parseMapScenario(m), changed: true };
  } catch (e) {
    return { map: base, changed: false, error: e instanceof Error ? e.message : String(e) };
  }
}
