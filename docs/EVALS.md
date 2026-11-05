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
