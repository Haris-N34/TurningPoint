# AI evals

Generated 2026-11-05 by `pnpm evals:report` (lib/ai/evals). Scanner: `evidence-scanner@1.0.0+0.7.1`, local rules. These run in CI with the unit tests; a drop below the bars fails the build.

| Eval | Bar | Result | Status |
| --- | --- | --- | --- |
| Counterfactual bias (6 names × 3 dialects × 3 schools) | identical levels | enforced by `lib/ai/bias.test.ts` | blocks CI on any difference |
| Hallucination (20 Not observed answers) | 19+ correct | 20/20 | pass |
| Gold set accuracy | 80%+, none off by two | waiting for human labels (0 of 48) | pending (B.10) |

## Gold set

- Items: 48; labelled: 0; disputed: 0. Target 40+ (B.10, both team members).
- Inter-rater kappa (Div vs Haris): not yet (needs items with both labels).
- Scanner vs human kappa: not yet.

## Hallucination misses

None.

## AI cross-check of the gold set (not human validation)

Claude scored all 48 gold answers against the evidence rubric before reading the scanner's output (`lib/ai/evals/gold/crosscheck.claude.json`). This is an AI cross-check, not B.10: it is never used as ground truth or in kappa, and B.10 stays open until both team members score by hand on `/admin/gold`. `lib/ai/evals/crosscheck.test.ts` holds the floor: agreement may not drop and the scanner may never rate higher than the cross-check.

| Check | Scanner 0.2.0 | Scanner 0.3.0 (Strong needs specificity) | Scanner 0.4.0 (one quote per skill) | Scanner 0.7.0 (collaboration needs a people action; sentence summaries) |
|---|---|---|---|---|
| Exact agreement, scanner vs cross-check | 36 of 48 (75%) | 36 of 48 (75%), same items | 36 of 48 (75%), same items | 36 of 48 (75%), same items |
| Off by two levels | 3 (g09, g35, g45) | 3 (g09, g35, g45) | 3 (g09, g35, g45) | 3 (g09, g35, g45) |
| Scanner higher than the cross-check | 0 | 0 | 0 | 0 |

0.3.0: Strong also needs the answer to be specific to its decision (it names something from the question, the option picked or the issue), or to hold a concrete detail (a number, an amount, a day) or 8+ concrete words. Generic trade-off talk ("the team needed it first, but it cost us time") now caps at Some (`lib/ai/specificity.test.ts`). Capital letters and spelling are never used (F1).

0.4.0: one quote backs at most one skill per card. The best-fitting skill keeps it; another skill uses its next-best quote or reads Not observed. The Evidence Scanner enforces the same rule on any provider's output (`onePerQuote`, `lib/ai/onequote.test.ts`). Gold items are single-skill, so agreement is unchanged.

Reading: the local scanner is conservative. It misses strong evidence phrased without its keywords, most in resilience, communication, curiosity, analytical and empathy. Do not tune it to this AI file; tune after the human labels land, then re-run B.10.

0.7.0: Collaboration needs a person or team action in the answer (asked, paired, called in, worked with, told the team, delegated, set up a stand-up...); the word "team" alone, or the decision's design, is not enough. Summaries are one plain sentence per skill and level, no keyword lists (`lib/ai/summary.test.ts`). 0.6.0: a quote in the skill's own words beats one picked only from the decision's design.
