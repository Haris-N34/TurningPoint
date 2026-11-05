import { z } from "zod";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { SKILL_SLUGS, type SkillSlug } from "@/lib/engine/skills";
import type { RunOptions } from "../run";
import { scanEvidence } from "../services/scanner";
import { agreement, asLevel, cohensKappa, type Level } from "./metrics";

// Gold-set accuracy eval (PRD v2 B3, B.10). Hand-scored answers live in lib/ai/evals/gold/*.json.
// The Evidence Scanner must match the human level on 80%+ with no item off by two levels.

const LevelSchema = z.enum(["strong", "some", "not_observed"]);
export const GoldItemSchema = z.object({
  id: z.string(),
  skill: z.enum(SKILL_SLUGS),
  kind: z.enum(["decision", "real_life", "follow_up"]).default("decision"),
  /** Skills the decision was designed to surface (scenario skillSignals). */
  nodeSkills: z.array(z.enum(SKILL_SLUGS)).default([]),
  transcript: z.string().min(1),
  /** One label per human rater. Null until scored. */
  labels: z.record(z.string(), LevelSchema.nullable()).default({}),
});
export const GoldFileSchema = z.object({ items: z.array(GoldItemSchema) });
export type GoldItem = z.infer<typeof GoldItemSchema>;

export const GOLD_MIN_ITEMS = 40;
export const GOLD_MIN_ACCURACY = 0.8;

/** The human truth: agreed label, or the only label. Disagreements wait for adjudication. */
export function humanLevel(item: GoldItem): Level | undefined {
  const ls = Object.values(item.labels).filter((l): l is Level => !!l);
  if (!ls.length) return undefined;
  return ls.every((l) => l === ls[0]) ? ls[0] : undefined;
}

export const scanLevel = (item: GoldItem, opts: RunOptions = {}): Level => {
  const cp = { id: "g", nodeId: "n", kind: item.kind, transcript: fromChunks([{ text: item.transcript, startS: 0, endS: 30 }]) };
  return asLevel(scanEvidence({ targetSkills: [item.skill as SkillSlug], checkpoints: [cp], decisionPath: [], nodeSkills: { n: item.nodeSkills } }, {}, opts)[0].level);
};

export function evaluateGold(items: GoldItem[], opts: RunOptions = {}) {
  const scored = items.filter((i) => humanLevel(i));
  const disputed = items.filter((i) => Object.values(i.labels).filter(Boolean).length > 1 && !humanLevel(i)).length;
  const human = scored.map((i) => humanLevel(i)!);
  const ai = scored.map((i) => scanLevel(i, opts));
  // Inter-rater agreement where two people labelled the same item.
  const both = items.filter((i) => Object.values(i.labels).filter(Boolean).length >= 2);
  const [r1, r2] = both.length ? Object.keys(both[0].labels) : [];
  const interRater = both.length ? cohensKappa(both.map((i) => i.labels[r1]!), both.map((i) => i.labels[r2]!)) : null;
  const misses = scored.flatMap((i, k) => (ai[k] === human[k] ? [] : [{ id: i.id, skill: i.skill, human: human[k], ai: ai[k] }]));
  return { total: items.length, labelled: scored.length, disputed, interRater, ...agreement(ai, human), misses };
}
