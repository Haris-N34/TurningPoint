# Recruiter comparison (#20)

Select two or three shared cards in the inbox. `/recruiter/compare` applies `cardFor` and `verifyEvidence` before rendering, preserving anonymous review, withdrawn access, hidden recordings and source verification. Skill profiles use the challenge's target skills. Answers are grouped by decision, real-life and follow-up type; questions may differ across runs and are shown alongside each answer. Clip-source links scroll directly to the associated transcript and show the exact quote and time.

There is no ranking, overall score or hiring action in this view. Individual review remains on the full evidence card. With fewer than two accessible selections, the comparison shows a recovery path instead of exposing the remaining card.

The phone regression exposed an existing table layout issue: the screen-reader-only Actions label escaped the overflow container and expanded the mobile layout viewport. Positioning that container keeps it clipped correctly. Tests compare document width to the configured viewport, exercise real checkbox clicks, cap selection at three, verify anonymous identities, remove revoked access, and run axe on desktop and 375 px.

The fairness dashboard, funnel, mode/timing/opt-in groups and 200-candidate cohort are implemented separately in PR #51 under #47. Do not duplicate those files here. Review/integrate #51 and this PR to accept all of #20. Physical-phone validation remains #21.
