import { z } from "zod";
import type { Card } from "@/lib/card/types";
import { verifyEvidence } from "@/lib/card/verify";
import { SKILL_SLUGS, SKILLS, type SkillSlug } from "@/lib/engine/skills";
import { scoreCard } from "@/lib/scoring/score";

// What leaves the browser when an attempt finishes (PRD v2 C2 outbound, public API). Isomorphic.
// No name, email, university, transcript or media: levels, the Final score with breakdown, a short summary, a card link.

const Level = z.enum(["strong", "some", "not_observed", "needs_review"]);

export const BreakdownSchema = z.object({
  skill: z.enum(SKILL_SLUGS),
  weight: z.number(),
  game: z.number().nullable(),
  resume: z.number().nullable(),
  combined: z.number(),
  confidence: z.enum(["High", "Medium", "Low", "None"]),
});

export const AttemptSummarySchema = z.object({
  attemptId: z.string().min(1).max(80),
  challengeId: z.string().min(1).max(80),
  finishedAt: z.string(),
  targetSkills: z.array(z.enum(SKILL_SLUGS)).min(1),
  levels: z.partialRecord(z.enum(SKILL_SLUGS), Level),
  finalScore: z.object({
    value: z.number().min(0).max(100),
    gameWeight: z.number(),
    resumeWeight: z.number(),
    breakdown: z.array(BreakdownSchema),
    configVersion: z.string(),
  }),
  summary: z.string().max(400),
  cardPath: z.string(),
  witnessConfirmed: z.boolean().default(false),
  /** Set when the candidate came in through an ATS invite. */
  inviteToken: z.string().optional(),
});
export type AttemptSummary = z.infer<typeof AttemptSummarySchema>;

const name = (s: string) => SKILLS.find((x) => x.slug === s)?.name ?? s;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

export function summarize(card: Card, inviteToken?: string): AttemptSummary {
  const evidence = verifyEvidence(card).evidence;
  const levels: Partial<Record<SkillSlug, z.infer<typeof Level>>> = {};
  for (const e of evidence) levels[e.skill as SkillSlug] = e.level;
  const strong = evidence.filter((e) => e.level === "strong").map((e) => name(e.skill));
  const some = evidence.filter((e) => e.level === "some").map((e) => name(e.skill));
  const witness = !!card.realStory?.witnesses.some((w) => w.status === "confirmed");
  const parts = [
    strong.length ? `Strong evidence in ${list(strong)}` : "No strong evidence yet",
    some.length ? `some in ${list(some)}` : "",
  ].filter(Boolean);
  const summary = `${parts.join("; ")}.${witness ? " Real story confirmed by a witness." : ""}`;
  const f = scoreCard(card, card.resume ? { claims: card.resume.claims } : {});
  return AttemptSummarySchema.parse({
    attemptId: card.attemptId,
    challengeId: card.challenge.id,
    finishedAt: card.finishedAt,
    targetSkills: card.targetSkills,
    levels,
    finalScore: { value: f.value, gameWeight: f.gameWeight, resumeWeight: f.resumeWeight, breakdown: f.breakdown, configVersion: f.configVersion },
    summary,
    cardPath: `/recruiter/card/${card.attemptId}?challenge=${card.challenge.id}`,
    witnessConfirmed: witness,
    inviteToken,
  });
}

/** Strong in 2+ of the employer's target skills (Second Look, C3). */
export const strongTargets = (s: Pick<AttemptSummary, "levels" | "targetSkills">) => s.targetSkills.filter((k) => s.levels[k] === "strong");
export const skillName = name;
export const joinNames = list;
