# Impact data contract (#47)

`impactReport(store, challengeId?, source?)` aggregates browser-local runs, cards, active shares and latest reviews. It counts each attempt once across reused cards. The funnel's finished count means a finished Capability Card exists. Practice runs are excluded. Evidence and witness rates use finished cards and cards with a real-life story respectively.

Data source defaults to local activity. Demo IDs begin `att_impact_demo_`; the fictional cohort is always labelled, and is excluded from local activity. The deterministic, idempotent seeder adds 200 attempts, 160 finished cards and three fictional employers without replacing existing records. All illustrative transcripts derive from the existing demo fixture; these are not 200 independently authored answers or measured outcomes. Deleting candidate data removes the seeded runs/cards/reviews/shares through the existing delete-all flow.

Participation metadata may live in a saved run's `extra.impactParticipation`: `{ mode: "text" | "voice" | "video", adjustedTiming: boolean, optInGroup?: string }`. Group is optional and must reflect explicit consent. This PR only populates synthetic groups. It does not collect demographic data from candidates. When metadata is absent, mode uses actual checkpoint modes (or Mixed modes), and timing uses the existing adjustedTiming card flag. Unknown values remain unknown.

Fairness tables show completion rate (finished / started) and shortlist rate (shortlisted / finished). Shortlist comparison requires ten completed candidates per group. A rate strictly below 80% of the highest eligible rate in the same table prompts review. No protected trait is inferred, no causal claim is made and no candidate can be filtered or rejected by the report.

## Part G sources (G.1)

All computed by pure functions in `lib/impact` (metrics.ts, partG.ts), unit tested in `lib/impact/partG.test.ts`.

| Metric | Source | Demo cohort |
| --- | --- | --- |
| Recruiter minutes per candidate | `x:review_sessions`: visible time on `/recruiter/card`, paused when hidden, capped at 30 min per view, bounces under 1 s dropped. Median of per-candidate totals. | Synthetic reading times |
| Second Look rescues | Live: integration server `GET second-look`. Demo: `x:impact_demo_second_look`. | Synthetic ATS rejects; the Strong-in-2 rule runs on the stored cards |
| Said vs did | `card.consistency` | Synthetic order checks |
| Resume claims backed | `card.resume.claims[].backed` | Fictional resumes through the real analyzer |
| AI vs human agreement | `evaluateGold` on `lib/ai/evals/gold` | Same. Shows "No labels yet" until B.10 labels exist; import label files in `aiEvalImpact` |
| No invented evidence | Hallucination eval, run live with the local scanner | Same |
| AI calls passing checks | `x:ai_calls` telemetry on this device | Device only, not the cohort |
| Learning survey (1 to 5) | `x:learning_survey`, optional question on the results page, never shown to employers | Synthetic answers |
| Coach usage | Live: Candidate Coach calls in telemetry plus practice runs on the device. Demo: `run.extra.impactDemo.practicedFirst` | Synthetic |

Review sessions, survey answers and demo Second Look entries are removed by delete-attempt and delete-all. Synthetic extras use a second PRNG stream, so the original cohort (modes, groups, decisions) is unchanged.

Limits shown on the dashboard: reading time outside Turning Point is not seen; live Second Look resets with the server; Coach calls are not linked to a later attempt; the survey is self-report.
