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
  /** The checkpoint question the answer replies to: the decision context the scanner uses for specificity. */
  question: z.string().optional(),
  /** One label per human rater. Null until scored. */
  labels: z.record(z.string(), LevelSchema.nullable()).default({}),
});
export type GoldItem = z.infer<typeof GoldItemSchema> & { /** Settled label after discussion (labels.gold.json). */ gold?: Level };

/** answers.json: the fixed answer text (see gold/README.md). Labels live in labels.<rater>.json. */
export const GoldAnswersSchema = z.object({
  version: z.number(),
  answers: z.array(z.object({ id: z.string(), skill: z.enum(SKILL_SLUGS), checkpointQuestion: z.string().optional(), answer: z.string().min(1), nodeSkills: z.array(z.enum(SKILL_SLUGS)).optional() })),
});
/** labels.<rater>.json: { "g01": "strong", ... }. "gold" is the settled set, any other name is a rater. */
export const GoldLabelsSchema = z.record(z.string(), LevelSchema);

/** Join answers with every labels file. Pure: the caller reads the files. */
export function joinGold(answers: unknown, labelFiles: Record<string, unknown>): GoldItem[] {
  const a = GoldAnswersSchema.parse(answers);
  const raters = Object.fromEntries(Object.entries(labelFiles).map(([name, l]) => [name, GoldLabelsSchema.parse(l)]));
  return a.answers.map((x) => {
    const labels: Record<string, Level | null> = {};
    for (const [name, l] of Object.entries(raters)) if (name !== "gold") labels[name] = l[x.id] ?? null;
    return { id: x.id, skill: x.skill, kind: "decision" as const, nodeSkills: x.nodeSkills ?? [x.skill], transcript: x.answer, question: x.checkpointQuestion, labels, gold: raters.gold?.[x.id] };
  });
}

export const GOLD_MIN_ITEMS = 40;
export const GOLD_MIN_ACCURACY = 0.8;

/** The human truth: agreed label, or the only label. Disagreements wait for adjudication. */
export function humanLevel(item: GoldItem): Level | undefined {
  if (item.gold) return item.gold;
  const ls = Object.values(item.labels).filter((l): l is Level => !!l);
  if (!ls.length) return undefined;
  return ls.every((l) => l === ls[0]) ? ls[0] : undefined;
}

export const scanLevel = (item: GoldItem, opts: RunOptions = {}): Level => {
  const cp = { id: "g", nodeId: "n", kind: item.kind, question: item.question, transcript: fromChunks([{ text: item.transcript, startS: 0, endS: 30 }]) };
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
