# AI evals

Generated 2026-11-05 by `pnpm evals:report` (lib/ai/evals). Scanner: `evidence-scanner@1.0.0+0.2.0`, local rules. These run in CI with the unit tests; a drop below the bars fails the build.

| Eval | Bar | Result | Status |
| --- | --- | --- | --- |
| Counterfactual bias (6 names × 3 dialects × 3 schools) | identical levels | enforced by `lib/ai/bias.test.ts` | blocks CI on any difference |
| Hallucination (20 Not observed answers) | 19+ correct | 20/20 | pass |
| Gold set accuracy | 80%+, none off by two | waiting for human labels (0 of 12) | pending (B.10) |

## Gold set

- Items: 12; labelled: 0; disputed: 0. Target 40+ (B.10, both team members).
- Inter-rater kappa (Div vs Haris): not yet (needs items with both labels).
- Scanner vs human kappa: not yet.

## Hallucination misses

None.

## AI cross-check of the gold set (not human validation)

Claude scored all 48 gold answers against the evidence rubric before reading the scanner's output (`lib/ai/evals/gold/crosscheck.claude.json`). This is an AI cross-check, not B.10: it is never used as ground truth or in kappa, and B.10 stays open until both team members score by hand on `/admin/gold`.

| Check | Result |
|---|---|
| Exact agreement, scanner vs cross-check | 36 of 48 (75%) |
| Off by two levels | 3 (g09 resilience, g35 communication, g45 curiosity: strong answers the scanner rated not observed) |
| Direction of every disagreement | Scanner lower than the cross-check (12 of 12). It never over-credited. |

Reading: the local scanner is conservative. It misses strong evidence phrased without its keywords, most in resilience, communication, curiosity, analytical and empathy. Do not tune it to this AI file; tune after the human labels land, then re-run B.10.
