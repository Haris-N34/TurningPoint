# QA night (Nov 5)

Production build (`pnpm build && pnpm start`), crawled and clicked. Severity: S1 breaks the demo or a hard rule, S2 a user-visible bug, S3 polish.

| # | Bug | Sev | Status | Test | Owner |
|---|---|---|---|---|---|
| 1 | `/verify` says "Valid. Signed by Turning Point (an earlier issuer key)" for a badge anyone self-signs with their own Ed25519 key. Forged Strong levels pass. | S1 | Fixed: unknown issuer key is now invalid | tests/qa/credential-forgery.test.ts | QA (lib/integrations) |
| 3 | Demo recovery path broken: inside the game, Ctrl+Shift+D then **Turning point** does nothing. Client-side Link to the same route, game never remounts, stays on the map (docs/qa/demo-jump-stays-on-map.png). Reloading the URL works. | S1 | Open, sent to parent | tests/qa/demo-jump.spec.ts (fixme) | agent C (components/demo) or B (lib/demo) |
| 4 | Accented names (José, Zoë, Ánh) were not stripped before the Evidence Scanner, Copilot and Coach saw transcripts: `\b` treats accented letters as non-word. Breaks G2. | S1 | Fixed in lib/ai/questions.ts (Unicode word edges) | tests/qa/blind-names.test.ts | QA (lib/ai) |
| 5 | The same person could fill both witness slots (same address, Gmail dots, +tags, googlemail): reads as "Confirmed by 2 supervisors". | S2 | Fixed in lib/witness/witness.ts | tests/qa/witness-duplicate.test.ts | QA (lib/witness) |
| 6 | Keyboard: Tab walks out of aria-modal dialogs into the page behind; Escape does not close Pause. Hit on /play Pause (components/game/Game.tsx), game pause menu (components/game2) and the checkpoint dialog (components/checkpoint). | S2 | Open, sent to parent. Fix ready: `useFocusTrap(ref, open, onEscape)` in lib/a11y/focusTrap.ts, verified on /play Pause | tests/qa/focus-trap.spec.ts (3 fixme) | agent A (game, game2), agent C (checkpoint) |
| 7 | Resume redaction let prestige through: UCalgary, McGill, SAIT, U of T, "Harvard Business School" survived (only long forms were caught). Breaks the blind-resume rule. | S1 | Fixed in lib/integrations/resume/redact.ts (shares the AI guard's school list) | tests/qa/resume-schools.test.ts | QA (lib/integrations) |
| 8 | Public link slugs split accented names: "Café Québec" became `caf-qu-bec`; a name with no Latin letters gave a slug starting with "-". | S3 | Fixed in lib/challenge/challenge.ts | tests/qa/slug.test.ts | QA (lib/challenge) |
| 2 | Withdrawn card rows in the inbox still carry name and university (if shortlisted before), skill levels, witness status and the Final score; the skill filter still matches them. C7.4 says nothing is shown. | S2 | Fixed in lib/card/inbox.ts | tests/qa/withdrawn-row.test.ts | QA (lib/card) |

## Risks to note

- Issuer key is random per server process unless `TP_ISSUER_ED25519_KEY` is set. On Vercel, a badge issued by one function instance fails `/verify` on another, and every badge fails after a redeploy. Set the env var before the demo.

## Runs

- Round 1: crawl of 40 routes x 4 viewports x light/dark, seeded and cleared storage: no console errors, no hydration warnings, no asset 404s, no horizontal overflow. Click-everything pass on every route: no page errors.
- Refresh mid-game on /game/launch-week (3 runs, one with a checkpoint open): Continue restores the clock and the same checkpoint question. OK.
- Demo panel opens on every route incl. the game; reset, seed, role switch and every jump from `/` work.
- demo-60s on the production build, 10 in a row: 10/10 green (24 to 28 s each).
