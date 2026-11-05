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
| 9 | Copilot model input leaked identity: blindCard stripped transcript text but passed raw word timings (name included), evidence quotes, and the recruiter's question ("Where did Maya...") unblinded. Breaks G2 once a live model is on. | S1 | Fixed in lib/ai/services/copilot.ts (blinded words, quotes, question) | tests/qa/copilot-blind.test.ts | QA (lib/ai) |
| 10 | Generic answers scored Strong: "the team needed it first, but it cost us time" got Prioritization and Collaboration Strong. | S1 | Fixed: scanner 0.3.0, Strong needs specificity to the decision (or a number, amount, day, or 8+ concrete words). Cross-check agreement 36/48 before and after, never over-credits | lib/ai/specificity.test.ts, lib/ai/evals/crosscheck.test.ts | QA (lib/ai) |
| 11 | Recruiter card: Final score popover covers Shortlist/Hold/Pass on hover and after a click (demo step 0:40). | S1 | Open, sent to parent | tests/qa/final-score-popover.spec.ts (2 fixme) | agent C (components/card/FinalScoreBox.tsx) |
| 12 | Demo story contradicted itself: Tab 1 picks recovery plan B (keep both days, cut promotion, decorations and the stage) but Maya's card said "I cut the second weekend" with a classic-engine decision path (team vote, garden soil). | S1 | Fixed: fixtures/attempt.json is now a real Launch Week run built by buildMapCard (sponsor pulls out, recovery plan B, cp2 asks the exact explain-on-pick question). Silent clips re-cut to the new lengths. Impact cohort variants for cp1/cp2 rewritten to match | tests/qa/maya-fixture.test.ts (WRITE_MAYA=1 rebuilds it) | QA (fixtures, lib/impact) |
| 13 | Integration console webhook log printed raw applicant emails and full resume text (emails are masked everywhere else). | S2 | Fixed in lib/integrations/webhooks.ts (logSafe) | tests/qa/webhook-log-pii.test.ts | QA (lib/integrations) |
| 14 | Phone, recruiter card: the open Copilot panel (up to 70vh) covers the answer tabs, so tabs and the cited clip can't be used without closing it. Shows now that Maya's real run has KPIs (answers gain KPI citations). Existing tests/e2e/ai.spec.ts B.6 [phone] fails on it. Screenshot docs/qa/copilot-covers-tabs-phone.png | S2 | Open, sent to parent | tests/e2e/ai.spec.ts:57 [phone] | agent C (components/recruiter/Copilot.tsx) |
| 15 | Recruiter card decision path clips its last label ("TURNIN…") once a run has 12+ steps (real map runs have 12 to 16). docs/qa/recruiter-card-real-run-1440.png | S3 | Open, sent to parent | none yet | agent C |
| 16 | One quote backed two skills (Maya's Adaptability and Resilience shared a cp2 quote; generic answers backed Prioritization and Collaboration with one sentence). | S2 | Fixed: scanner 0.4.0, one quote per skill per card, enforced for any provider. Cross-check 36/48 before and after | lib/ai/onequote.test.ts | QA (lib/ai) |
| 17 | Accommodation status reached employers: recruiter card and compare view carried adjustedTiming ("Adjusted timing" badge). | S1 | Fixed in lib: cardFor and compareFor drop it; one badge line removed from components/recruiter/Compare.tsx to keep the build green (agent C fixing the card UI). Inbox, export, ATS result and API summary verified clean | tests/qa/accommodation-privacy.test.ts | QA (lib/card) + agent C |
| 2 | Withdrawn card rows in the inbox still carry name and university (if shortlisted before), skill levels, witness status and the Final score; the skill filter still matches them. C7.4 says nothing is shown. | S2 | Fixed in lib/card/inbox.ts | tests/qa/withdrawn-row.test.ts | QA (lib/card) |

## Risks to note

- Issuer key is random per server process unless `TP_ISSUER_ED25519_KEY` is set. On Vercel, a badge issued by one function instance fails `/verify` on another, and every badge fails after a redeploy. Set the env var before the demo.

## Runs

- Round 1: crawl of 40 routes x 4 viewports x light/dark, seeded and cleared storage: no console errors, no hydration warnings, no asset 404s, no horizontal overflow. Click-everything pass on every route: no page errors.
- Refresh mid-game on /game/launch-week (3 runs, one with a checkpoint open): Continue restores the clock and the same checkpoint question. OK.
- Demo panel opens on every route incl. the game; reset, seed, role switch and every jump from `/` work.
- demo-60s on the production build, 10 in a row: 10/10 green (24 to 28 s each).
- Round 3 (new Maya card, production build with test hooks as CI builds it): demo-60s 10/10 green (12 to 21 s), forged-badge e2e 10/10.
- Quick mode (night/game-flow 1b88ac5, production build): default length is quick; no order question, no recap modal, one checkpoint (the exact recovery-B question); refresh mid-checkpoint restores the clock and question exactly; results and card build with no console errors, consistency has no order note. Full week: refresh mid-checkpoint on Monday restores exactly.

