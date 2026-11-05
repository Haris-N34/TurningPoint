import type { Evidence } from "@/lib/card/types";

// Agreement metrics for the AI evals (PRD v2 B3). Levels are ordinal: not observed < some < strong.

export type Level = "strong" | "some" | "not_observed";
export const ORD: Record<Level, number> = { not_observed: 0, some: 1, strong: 2 };
const LEVELS: Level[] = ["not_observed", "some", "strong"];

/** "Needs human review" is not a level the scanner asserts; it counts as a disagreement by one. */
export const asLevel = (l: Evidence["level"]): Level => (l === "needs_review" ? "some" : l);

/** Cohen's kappa for two raters over the same items. 1 = perfect, 0 = chance. */
export function cohensKappa(a: Level[], b: Level[]): number {
  if (a.length !== b.length || !a.length) return 0;
  const n = a.length;
  const po = a.filter((x, i) => x === b[i]).length / n;
  const pe = LEVELS.reduce((s, l) => s + (a.filter((x) => x === l).length / n) * (b.filter((x) => x === l).length / n), 0);
  return pe === 1 ? 1 : +((po - pe) / (1 - pe)).toFixed(3);
}

export function agreement(ai: Level[], human: Level[]) {
  const n = ai.length;
  const exact = ai.filter((x, i) => x === human[i]).length;
  const offByTwo = ai.filter((x, i) => Math.abs(ORD[x] - ORD[human[i]]) >= 2).length;
  return { n, accuracy: n ? +(exact / n).toFixed(3) : 0, offByTwo, kappa: cohensKappa(ai, human) };
}
