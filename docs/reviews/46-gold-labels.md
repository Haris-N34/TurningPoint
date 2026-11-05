# Haris-side gold-set review (#46)

Independent Codex rubric review of the 48 fixed answers in `answers.json`, before reading Div's labels or Evidence Scanner output. These are agent-proposed labels for Haris to review, not a claim that a human independently scored them. Score only the named skill; spelling, grammar and dialect have no bearing on the label.

Applied PRD evidence rubric literally: Strong requires a named trade-off, a reason for the choice, and awareness of affected people or future changes. Some covers relevant reasons without that full combination. Not observed means no relevant evidence in this answer.

## Boundary cases for reconciliation

- g03: Some. A clear causal diagnosis and successful workaround, but no stated trade-off or awareness of who bears its cost.
- g15: Some. Makes a decision despite uncertainty, but does not explain the consequences or who is affected.
- g22: Some. A specific low-cost alternative and budget reason, but no trade-off identified.
- g23: Some. Claims a cheaper training method without describing it.
- g31: Strong. Chooses private instruction over group training, specifically to protect the manager from embarrassment in front of staff.
- g33: Strong. Tailors cost framing to the CFO and acknowledges the risk information omitted.
- g35: Some. Specific communication sequence and observed donor response, but no stated trade-off.
- g38: Some. Relevant explanation of a response to feedback, without evidence of reconsideration or change. This does not label the person unreceptive.
- g39: Some. Specific change after feedback and a result; getting used to the change is mentioned, but no clear competing commitment or cost is identified.
- g43: Some. Identifies sampling bias and changes the analysis, without naming a trade-off.
- g47: Some. Investigates a pattern and applies the finding, but does not name a trade-off.

The short answers g08 and g20 repeat an action/outcome without explaining reasoning for the named skill; Not observed. The remaining Not observed answers likewise contain no relevant skill evidence. Dialect examples g11 and g19 are Strong on the same evidence standard as the rest.

Do not calculate agreement with the scanner as human inter-rater agreement. B.10 remains open until both human reviewers accept independent ratings, reconcile disagreements and report the agreed procedure and kappa. This PR does not create `labels.gold.json` or tune the scanner.
