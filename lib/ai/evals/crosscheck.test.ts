import { describe, expect, it } from "vitest";
import answers from "./gold/answers.json";
import cross from "./gold/crosscheck.claude.json";
import { joinGold, scanLevel } from "./gold";

// The AI cross-check (docs/EVALS.md) as a floor: scanner changes must not agree less with it, and must never
// rate an answer higher than the cross-check did. Not human validation; B.10 still needs the team's labels.
const RANK = { strong: 2, some: 1, not_observed: 0 } as const;
type L = keyof typeof RANK;

describe("AI cross-check floor", () => {
  const labels = (cross as { labels: Record<string, L> }).labels;
  const rows = joinGold(answers, {}).map((i) => ({ id: i.id, ai: scanLevel(i, { log: () => {} }) as L, x: labels[i.id] }));
  it("agrees on 36 of 48 or more", () => {
    expect(rows.filter((r) => r.ai === r.x).length).toBeGreaterThanOrEqual(36);
  });
  it("never over-credits", () => {
    expect(rows.filter((r) => RANK[r.ai] > RANK[r.x]).map((r) => r.id)).toEqual([]);
  });
});
