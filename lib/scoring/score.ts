import type { Card } from "@/lib/card/types";
import type { Kpi } from "@/lib/game/kpis";
import { kpiScoreBySkill } from "@/lib/game/kpis";
import type { SkillSlug } from "@/lib/engine/skills";
import { clampResumeWeight, SCORING_CONFIG } from "./config";

// Scoring (PRD v2, Part D). The Final score SORTS candidates; nothing anywhere filters or rejects by it.

export type Confidence = "High" | "Medium" | "Low" | "None";

export type GameSkillScore = {
  skill: SkillSlug;
  kpiPart: number | null;
  transcriptPart: number | null;
  score: number | null;
  level: string;
  confidence: Confidence;
};

export type ResumeClaimLike = { skills: string[]; backed: boolean };

export type BreakdownRow = {
  skill: SkillSlug;
  weight: number;
  game: number | null;
  resume: number | null;
  combined: number;
  confidence: Confidence;
};

export type FinalScore = {
  value: number;
  gameWeight: number;
  resumeWeight: number;
  hasResume: boolean;
  breakdown: BreakdownRow[];
  configVersion: string;
};

const round = (x: number) => Math.round(x);

/** Per-skill game score: KPI part (deterministic) and transcript part (Evidence Scanner level). */
export function gameSkillScore(skill: SkillSlug, kpiScore: number | undefined, level: string | undefined, cfg = SCORING_CONFIG): GameSkillScore {
  const kpiPart = kpiScore ?? null;
  const transcriptPart = level && level in cfg.levelPoints ? cfg.levelPoints[level] : null;
  let score: number | null = null;
  let confidence: Confidence = "None";
  if (kpiPart !== null && transcriptPart !== null) {
    score = round(kpiPart * cfg.kpiShare + transcriptPart * cfg.transcriptShare);
    confidence = level === "strong" ? "High" : "Medium";
  } else if (kpiPart !== null) {
    // No transcript evidence: KPI-only, low confidence.
    score = round(kpiPart);
    confidence = "Low";
  } else if (transcriptPart !== null) {
    score = transcriptPart;
    confidence = "Medium";
  }
  return { skill, kpiPart, transcriptPart, score, level: level ?? "not_observed", confidence };
}

/** Resume score for one skill: mean of claim points (backed 100, unbacked 50). Null when no claim mentions it. */
export function resumeSkillScore(skill: SkillSlug, claims: ResumeClaimLike[], cfg = SCORING_CONFIG): number | null {
  const mine = claims.filter((c) => c.skills.includes(skill));
  if (!mine.length) return null;
  const pts = mine.map((c) => (c.backed ? cfg.backedClaimPoints : cfg.unbackedClaimPoints));
  return round(pts.reduce((a, b) => a + b, 0) / pts.length);
}

/**
 * Final score (0 to 100): employer-weighted average over target skills of
 * game x game weight + resume x resume weight. No resume means game only, with no penalty.
 * A skill with no resume claim also uses the game part alone.
 */
export function finalScore(opts: {
  targetSkills: SkillSlug[];
  game: GameSkillScore[];
  claims?: ResumeClaimLike[];
  resumeWeight?: number;
  skillWeights?: Partial<Record<SkillSlug, number>>;
  cfg?: typeof SCORING_CONFIG;
}): FinalScore {
  const cfg = opts.cfg ?? SCORING_CONFIG;
  const hasResume = !!opts.claims && opts.claims.length > 0;
  const rw = hasResume ? clampResumeWeight(opts.resumeWeight ?? cfg.resumeWeight) : 0;
  const gw = 1 - rw;
  const weights = opts.targetSkills.map((s) => Math.max(0, opts.skillWeights?.[s] ?? 1));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const breakdown: BreakdownRow[] = opts.targetSkills.map((skill, i) => {
    const g = opts.game.find((x) => x.skill === skill);
    const game = g?.score ?? null;
    const resume = hasResume ? resumeSkillScore(skill, opts.claims!, cfg) : null;
    const gameVal = game ?? 0;
    const combined = resume === null ? gameVal : gameVal * gw + resume * rw;
    return { skill, weight: weights[i] / wsum, game, resume, combined: round(combined), confidence: g?.confidence ?? "None" };
  });
  const value = round(breakdown.reduce((a, r) => a + r.combined * r.weight, 0));
  return { value, gameWeight: gw, resumeWeight: rw, hasResume, breakdown, configVersion: cfg.version };
}

/** Game scores per target skill from a card (KPIs + evidence). */
export function gameScoresFromCard(card: Pick<Card, "targetSkills" | "evidence" | "kpis">): GameSkillScore[] {
  const kpiScores = kpiScoreBySkill((card.kpis ?? []) as Kpi[]);
  return (card.targetSkills as SkillSlug[]).map((skill) =>
    gameSkillScore(skill, kpiScores[skill], card.evidence.find((e) => e.skill === skill)?.level),
  );
}

/** Final score for a card, optionally with resume claims and the employer's resume weight. */
export function scoreCard(
  card: Pick<Card, "targetSkills" | "evidence" | "kpis">,
  opts: { claims?: ResumeClaimLike[]; resumeWeight?: number; skillWeights?: Partial<Record<SkillSlug, number>> } = {},
): FinalScore {
  return finalScore({ targetSkills: card.targetSkills as SkillSlug[], game: gameScoresFromCard(card), ...opts });
}
