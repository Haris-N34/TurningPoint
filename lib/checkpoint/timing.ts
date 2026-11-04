// Checkpoint timers (C4.3, C5.1, C5.2), multiplied by the candidate's accommodation (C1.4, A2).
export type CheckpointKind = "decision" | "real_life" | "follow_up";

const BASE: Record<CheckpointKind, { thinkS: number; answerS: number }> = {
  decision: { thinkS: 15, answerS: 60 },
  real_life: { thinkS: 30, answerS: 120 },
  follow_up: { thinkS: 15, answerS: 60 },
};

export function timing(kind: CheckpointKind, multiplier: 1 | 1.5 | 2 = 1) {
  const b = BASE[kind];
  return { thinkS: Math.round(b.thinkS * multiplier), answerS: Math.round(b.answerS * multiplier) };
}

/** Retakes allowed per checkpoint (C4.5). */
export const MAX_RETAKES = 1;
