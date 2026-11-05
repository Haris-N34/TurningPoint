// Scoring formula and weights (PRD v2, Part D). Versioned: every Final score records the version it used.
// Shown publicly on /how-scores-work. Changing anything here means bumping `version`.

export const SCORING_CONFIG = {
  version: "2026-11-05.1",
  /** Game (observed) vs resume (claimed). The resume weight can move between 0 and 40%, never higher. */
  gameWeight: 0.75,
  resumeWeight: 0.25,
  maxResumeWeight: 0.4,
  /** Per-skill game score: KPI part and transcript (Evidence Scanner) part. */
  kpiShare: 0.5,
  transcriptShare: 0.5,
  /** Transcript levels as points. Not observed and needs-human-review contribute nothing. */
  levelPoints: { strong: 90, some: 60 } as Record<string, number>,
  /** Resume claims: backed by game evidence counts in full, unbacked counts at half. */
  backedClaimPoints: 100,
  unbackedClaimPoints: 50,
} as const;

export type ScoringConfig = typeof SCORING_CONFIG;

/** Clamp an admin's resume weight to the allowed range (Part D). */
export function clampResumeWeight(w: number): number {
  if (!Number.isFinite(w)) return SCORING_CONFIG.resumeWeight;
  return Math.max(0, Math.min(SCORING_CONFIG.maxResumeWeight, w));
}
