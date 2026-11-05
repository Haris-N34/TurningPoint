# Gold set (B.10)

Hand-scored answers for the Evidence Scanner accuracy eval. Each item is one answer and one skill.

- `labels`: one entry per rater (`div`, `haris`). Set each to `strong`, `some` or `not_observed` using the rubric in `docs/PRD.md`. Score alone, then compare.
- An item counts once both labels agree, or when only one person labelled it. Disagreements are listed as disputed until you settle them.
- Target: 40+ labelled items across all 12 skills. Add files freely; every `*.json` here is read.
- Run `pnpm evals` to check, `pnpm evals:report` to rewrite `docs/EVALS.md`.
- Pass bar: scanner matches the human level on 80%+ of items, and no item is off by two levels. CI fails below it.

Never put a real candidate's answer or name here.
