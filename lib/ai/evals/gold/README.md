# Gold set (PRD v2, B3 "Accurate algorithm")

`answers.json` holds 48 checkpoint answers, 4 per skill across the 12 framework skills, with mixed quality, length and dialect. The text is fixed: don't edit answers once scoring starts.

Two people score it independently against the evidence rubric in `docs/PRD.md`. Easiest way: open `/admin/gold` in the app (`pnpm dev`), pick your name, press 1, 2 or 3 for each answer, then copy the result into the file below.


- Haris: `labels.haris.json`
- Div: `labels.div.json`

Format, one entry per answer id: `{ "g01": "strong", "g02": "some", "g03": "not_observed" }`

Rules: score only the named skill. Ignore grammar, spelling, accent and dialect. "not_observed" means this answer gives no evidence for the skill, not that the person lacks it. Don't look at the other person's labels or the scanner output until both files are in.

Once both are in, disagreements are discussed and settled in `labels.gold.json`. The eval (B.7) checks the Evidence Scanner against `labels.gold.json` (80%+ exact, none off by two levels) and reports Cohen's kappa in `docs/EVALS.md`.
