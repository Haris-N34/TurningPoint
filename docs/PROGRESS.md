# Progress

Every acceptance criterion from `docs/PRD.md`, grouped by milestone. Tick only when a test covers it and the full check (`pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`) is green. Owner in brackets: [D] Div, [H] Haris, [D+H] both.

**v2 (Nov 4, evening):** added M1.5 (game map), M3.5 (AI Engine) and M4 additions (integrations, scoring), see PRD "Upgrade v2".

**Scope change (Nov 4):** local-only demo. No database, no auth server, no API keys except Vercel. See CLAUDE.md, Demo scope decisions. Criteria that assumed a server are reworded to their local equivalent.

## M0. Foundations

- [x] M0.1 [D] Repo has PRD, CLAUDE.md, PROGRESS.md
- [x] M0.2 [D] Next.js 15 + TS + Tailwind scaffold; `pnpm i && pnpm dev` works on a fresh clone
- [x] M0.3 [D] Vitest, Playwright, axe-core, ESLint and `typecheck` scripts wired
- [x] M0.4 [D+H] Scenario JSON schema and card types committed; fixture verified; Haris signed off integration `2fcbe91` (#8, see `docs/reviews/8-contract-review.md`)
- [x] M0.5 [D] Local store: runs, cards, shares, reviews in localStorage; recordings in IndexedDB; delete-all
- [x] M0.6 [D] Demo profile and role storage (no auth server); picker UI is M0.11
- [x] M0.7 [D] CI (GitHub Actions) green on lint, typecheck, unit, build, e2e
- [ ] M0.8 [D] Deployed to Vercel
- [x] M0.9 [H] Design system tokens, shadcn primitives and light/dark preview; 49 unit + 30 serial e2e pass (#9, implementation complete, awaiting review)
- [x] M0.10 [H] Landing page with promise, three-step explainer and working CTAs (#10, implementation complete, awaiting review)
- [x] M0.11 [H] Header role picker, local persistence and four role entry routes; 49 unit + 38 serial e2e pass (#10, awaiting review)
- Done when: fresh clone runs with `pnpm i && pnpm dev`, CI is green, deployed URL shows landing page and role picker.

## M1. Playable game

- [x] C2.1 [D] Game loads scenario JSON and renders scene, choice, event, checkpoint, end
- [x] C2.2 [D] Choices change resources and branch; resource bar animates
- [x] C2.3 [D] Every choice logged with timestamp, node id, option id, decided_ms
- [x] C2.4 [D] Pause; progress saved locally; resumes on refresh (another device needs a server, out of demo scope)
- [ ] C2.5 [D+H] Full run 12 to 18 minutes (needs Launch Week); works at 375 px (done, e2e)
- [ ] C2.6 [D+H] Keyboard-only play (done, e2e); all art has alt text (enforced by content test, needs art)
- [x] C3.1 [D] Turning point fires between 40% and 60%, full-screen transition, mutable sound
- [x] C3.2 [D] Resets a resource sharply and unlocks new choices
- [x] C3.3 [D] Disruption picked from pool by per-candidate seed
- [x] S.1 [D] Schema rejects unreachable nodes, missing targets, no path to end, fewer than 3 eligible nodes
- [x] S.2 [D] Seed picks disruption, 2 or 3 checkpoints, number variation; replayable
- [x] S.3 [H] Launch Week written in full (15 nodes, eligible 3, 6, 9, 10, 12, 3 disruptions) (#11, merged). C2.5 timed first-user validation remains open.
- [x] S.4 [H] Client Rescue template written (#12, merged)
- [x] S.5 [H] 12 to 15 scene illustrations, one flat style, alt text
- Done when: a Playwright test plays Launch Week start to end on desktop and phone, every choice is in the database.

## M1.5. Game map and clock (v2 Part A)

Owner: Div unless marked. [H] = Haris (portraits, art direction, map authoring help).

- [x] A.1 [D] "Quiz test": no gameplay screen shows choices without a character, a scene and an animation
- [x] A.2 [D] Every decision happens through an in-world interaction (walk to someone, item, HQ laptop)
- [x] A.3 [D] Playwright screenshots of title, map, dialogue, cutscene, checkpoint and results in docs/screens; CHANGELOG records which A0 items are met
- [x] A.4 [D] Title screen, avatar creator, pause menu, loading screen and end-of-week results screen match A0
- [x] A.5 [D+H] Dialogue: portraits with expressions, typewriter text with skip and blip, A to D buttons with arrow keys, NPC emote reactions, sound
- [x] A.6 [D] Juice: floating numbers, tweened bars, shake, particles and sound on every resource change
- [x] A.7 [D] Choice-triggered video fires on explainOnPick options and quotes the option picked; cap 4 per run; seeded still guarantee 2
- [x] A.8 [D] "The Client Pivot" fully playable: own map, NPCs, data mini-view, hidden discoveries, KPIs (lib/game/clientPivot.test.ts, tests/e2e/client-pivot.spec.ts)
- [x] A.9 [D] Map loads from Tiled JSON; walk with keys, click and tap; camera follows
- [x] A.10 [D] NPCs show urgency bubbles (icon + label, not colour only); talking opens a React dialogue driven by scenario nodes
- [x] A.11 [D] Clock advances by action costs and drift, pauses in dialogue, checkpoints, pause menu and on blur; shows day, time and progress ring
- [x] A.12 [D] Turn-based mode disables drift; outcomes do not depend on drift (unit test)
- [x] A.13 [D] Issues spawn, count down, expire with consequences; Talk, Delegate, Defer with a reason, Ignore
- [x] A.14 [D] Evening recap shows the day's KPIs
- [x] A.15 [D] Turning-point sequence plays fully, changes the map, spawns new issues
- [x] A.16 [D] All A8 KPIs compute correctly from a recorded input log (unit tests with fixtures)
- [x] A.17 [D] Checkpoints trigger after eligible actions; the order question fires once and logs said-vs-did
- [x] A.18 [D] List view gives identical engine state to map view for the same inputs (unit test)
- [x] A.19 [D] Full run takes 12 to 16 minutes in a scripted Playwright run at normal pace (pace model lib/game/pace.ts over scripted runs: Launch Week 12.2 to 14.4 min, Client Pivot 13.2 to 15.7 min)
- [ ] A.20 [D] Lighthouse performance 80+ on the game page (mid-range phone profile); 50+ fps on desktop (Lighthouse mobile 86 twice on the production build, title screen is a still image and the engine starts at the avatar step. fps: needs a real GPU; this machine renders WebGL on the CPU (56 fps at 720x450, 21 at 1440x900). Check on a laptop with /game/launch-week?fps=1)
- [x] A.21 [D] Test hooks window.__tp (NEXT_PUBLIC_TEST_HOOKS=1); Playwright full run in map view (desktop, phone) and list view (keyboard only)
- [x] A.22 [D] Skill framework extended to 12 (Analytical thinking, Curiosity and discovery); custom employer skills via the Value Mapper (B.5)
- [ ] A.23 [H] 6 to 8 NPC portrait sets (4 expressions) in public/assets/portraits; LICENSES.md complete
- Done when: every A item above passes and the quiz-test screenshots show a game, not a form.

## M2. Checkpoints

- [x] C1.1 [H] Three intro screens (checkpoints, timing, formats, no face or tone scored)
- [x] C1.2 [D] Default answer mode, changeable at every checkpoint
- [x] C1.3 [D+H] Device check: camera preview, mic meter, text fallback on denied permission
- [x] C1.4 [D+H] Accommodations form (1.5x, 2x, text-only, screen reader) changes timers
- [x] C1.5 [D] Mocked university SSO sets `verified=true`
- [x] C4.1 [D] Checkpoints fire on 2 or 3 seeded `checkpointEligible` nodes
- [x] C4.2 [D] Question quotes the candidate's last choice (built locally at choice time, node fallback)
- [x] C4.3 [D] 15 s think then 60 s answer, times accommodation multiplier
- [x] C4.4 [D] Video, voice (waveform), text (paste disabled) modes
- [x] C4.5 [D] One retake per checkpoint, recorded on the card
- [x] C4.6 [D] Recording saved locally (IndexedDB) with 3 retries and a saving indicator (no upload in demo scope)
- [x] C4.7 [D] Transcript on results page within 30 s of run end
- [x] C4.8 [D] Focus loss during an answer logged as integrity note, never a penalty
- [x] C5.1 [D] Real-life checkpoint: 30 s think, up to 120 s answer, any mode
- [x] C5.2 [D] Follow-up about a specific detail, 60 s answer
- [x] C5.3 [D] Candidate writes the one-sentence story title
- [x] AI.1 [H] Fallback question for every checkpoint-eligible node; rubric examples
- [x] PV2 [D] Consent screen before recording; improvement opt-in off by default
- Done when: a test run records 3 checkpoints in each mode (fake media stream), transcripts appear within 30 s.

## M3. Capability Card

- [x] G1 [D] Exact substring quote check; unmatched quotes dropped, skill drops a level
- [x] G2 [D] Extractor never gets name, email, university or video frames
- [x] G3 [D] Extractor name and version stored with every card
- [x] AI.2 [D] Evidence extraction per rubric (local rules) (Strong, Some, Not observed); "Needs human review" fallback
- [x] AI.3 [D] Data APIs for inbox and card (lib/card/recruiter.ts, inbox.ts)
- [x] E2.1 [D] Inbox table (anon ID, date, status, top 3 skills, witness, reused)
- [x] E2.2 [D] Filters and sorts
- [x] E2.3 [D] Shortcuts J/K, Enter, S
- [x] E3.1 [D] Card header (verified, "adjusted timing" only)
- [x] E3.2 [D] Skill evidence strip; never an overall score
- [x] E3.3 [D] Decision path timeline with turning point and checkpoint dots
- [x] E3.4 [D] Clips; click a sentence or word to jump to the exact second
- [x] E3.5 [D] Real turning point section
- [x] E3.6 [D] Integrity notes, "For context, not scored"
- [x] E3.7 [D] Shortlist, Hold, Pass (pass needs a reason)
- [x] E3.8 [D] Every AI sentence labelled "AI summary" with a source link
- [x] E6.1 [D] Anonymous first review ON by default
- [x] E6.2 [D] Transcript-first video setting
- [x] PV3 [D] Recordings served by 1-hour signed URLs only (local: `tp-media:` links with an HMAC-SHA256 token and 1 h expiry, checked before IndexedDB is read; per-session random secret; lib/store/signed.test.ts)
- Done when: finishing a run produces a card where every AI sentence links to a real timestamp, and a recruiter can shortlist from the inbox.

## M3.5. AI Engine (v2 Part B)

- [x] B.1 [D] All model calls go through lib/ai with a provider interface; the mock provider passes the full e2e suite offline. Provider interface done and tested (lib/ai/providers.test.ts). Blocked on the full suite: 9 game.spec tests already fail on ba1ddfc (game WIP, #43), and "evening recap" (desktop) runs at the 60 s edge under load (passes alone in 59 s). All other 90 e2e pass offline in off and cached builds.
- [x] B.2 [D] Every B2 service exists with a Zod schema, fixtures and a fallback (lib/ai/services, registry in lib/ai/prompts/registry.ts, lib/ai/services.test.ts)
- [x] B.3 [D] Scenario Tailor and Dialogue Variants run at publish time and are cached; no live generation of game content (lib/ai/services/publish.ts, lib/ai/publish.test.ts)
- [x] B.4 [D] Consistency Checker output on the card under "Said vs did", labelled as context (lib/ai/consistency.test.ts, tests/e2e/ai.spec.ts)
- [x] B.5 [D] Value Mapper shows mappings with confidence; admin can accept, change or reject each (components/admin/ValueMapper.tsx, lib/ai/valueMapper.test.ts, tests/e2e/ai.spec.ts)
- [x] B.6 [D] Recruiter Copilot answers only with citations; refuses protected-trait and hire/no-hire questions (tests: lib/ai/copilot.test.ts, tests/e2e/ai.spec.ts)
- [x] B.7 [D] Counterfactual bias test, hallucination eval and gold-set accuracy eval run in CI and block merge on failure (lib/ai/bias.test.ts, lib/ai/evals; `pnpm evals` step in CI; gold accuracy skips with a message until B.10 labels exist; merge blocking also needs branch protection on main)
- [x] B.8 [D] ai_calls telemetry on an admin "AI health" page: calls, latency p50/p95, cost, validation failures (/admin/ai-health, lib/ai/telemetry.ts)
- [x] B.9 [D] AI_MODE=cached lets the whole demo run without network access to the model provider (lib/ai/cached.test.ts with fetch disabled, `pnpm ai:record`, e2e "B.9" in tests/e2e/ai.spec.ts; full suite in a cached build has only the game.spec failures already on ba1ddfc)
- [ ] B.10 [D+H] Gold set of 40+ hand-scored answers (both team members); kappa in docs/EVALS.md
- Done when: all B items pass in CI.

## M4. Employer side and portability

- [x] E1.1 [D] Skills step: 10 skill cards, pick 3 or 4
- [x] E1.2 [D] Scenario step: 2+ templates with length and skills
- [x] E1.3 [D] Tailoring (local word swaps per industry) returns schema-valid JSON or keeps the original
- [x] E1.4 [D] Inline scene editing, mark checkpoint-eligible
- [x] E1.5 [D] Preview as candidate, no data saved
- [x] E1.6 [D] Publish creates public link, job code and QR
- [x] E1.7 [D] Setup under 10 minutes (scripted e2e; human timing in rehearsal)
- [x] C6.1 [H] Add up to 2 witnesses with relationship: slot count, list with relationship and status in words (tests/e2e/witness.spec.ts, desktop and phone)
- [x] C6.2 [D] Witness one-time link, expires in 14 days (shown to send, not emailed: demo scope)
- [x] C6.3 [H] Witness page, no account, phone, under 30 s: names the relationship, skill counter, headed done/used/invalid/expired states (tests/e2e/witness.spec.ts, tests/e2e/a11y.spec.ts on phone)
- [x] C6.4 [D] Card shows "Confirmed by ..." never the witness email
- [x] C6.5 [D] Reject witness email matching candidate email or domain alias
- [x] C7.1 [D] Candidate sees own card exactly as a recruiter would
- [x] C7.2 [D+H] Hide a single clip (no transcript edits) (logic + basic toggle; design H)
- [x] C7.3 [D+H] Share with another employer in one click, reused flag (logic + basic list; badge in inbox H)
- [x] C7.4 [D] Revoke share; employer sees "Candidate withdrew this card" (cardFor returns withdrawn)
- [x] C7.5 [D] Delete everything, immediately (deleteMyData: store + recordings)
- [x] E8.1 [D] Inbox shows reused cards with covered skills
- [x] E5.1 [D] Mock Greenhouse endpoint, success toast with payload
- [x] E5.2 [D] Exported candidate links back to the card
- [x] PV5 [H] "How we use AI" page linked from every screen (global header; tests/e2e/a11y.spec.ts walks every route)
- Done when: the five-step loop from the PRD Summary works end to end on the deployed site.

### M4 additions: integration layer (v2 Part C) and scoring (Part D)

- [x] C.1 [D] ATS adapter interface with mock-greenhouse and mock-workday adapters and contract tests
- [x] C.2 [D] Inbound webhook creates an invite; signature, timestamp and idempotency enforced (bad signature, replay, duplicate tests)
- [x] C.3 [D] Outbound result appears in the mock ATS with a link back; failures retry with backoff and show in the console
- [x] C.4 [D] Public API with API keys, rate limits and generated OpenAPI docs at /developers
- [x] C.5 [D] Resume Analyzer strips identity and prestige fields before any model call (fixtures with names, schools, years, addresses)
- [x] C.6 [D] Resume items labelled Claimed, game items Observed; links "Backed by game evidence" or "Not yet shown", never "false"
- [x] C.7 [D] Two-column Resume vs Evidence view on the Capability Card
- [x] C.8 [D] Counterfactual: same resume with different names and schools gives identical resume signals
- [x] C.9 [D] Open Badges 3.0 export plus /verify; a tampered file fails verification (test)
- [x] C.10 [D] Integration console shows the live webhook log and can re-send a failed delivery
- [x] C.11 [D] Second Look works end to end from a mock ATS rejection; rescued count on analytics
- [x] D.1 [D] Unit tests: formula, low confidence, no-resume candidates, 40% resume cap, employer weights
- [x] D.2 [D] No setting or query hides or rejects candidates by score (test asserts no threshold exists)
- [x] D.3 [D] "How scores work" page renders the live config and version
- [x] D.4 [D] Final score box top right with breakdown on hover; card leads with evidence

## M5. Polish and proof

- [x] E4.1 [H] Compare view (2 or 3 cards): pick in the inbox, /recruiter/compare, order as picked, no score or ranking (lib/card/compare.test.ts, tests/e2e/compare.spec.ts)
- [x] E7.1 [H] Funnel counts per challenge: table on /admin/impact (funnelByChallenge, lib/impact/fairness.test.ts, tests/e2e/fairness.spec.ts)
- [x] E7.2 [H] Completion and shortlist rate by mode and accommodation (lib/impact/fairness.test.ts)
- [x] E7.3 [D+H] Opt-in demographics, four-fifths warning; never on cards, inbox rows or evidence (lib/impact/fairness.test.ts)
- [x] E7.4 [H] Seed data: 200 fake candidates, 3 employers, deterministic generator, synthetic names; loads from the inbox or /admin/impact (lib/impact/seed.ts)
- [x] C8.1 [D] Practice mode, nothing shared, deleted after 24 h (/practice; store refuses to share practice runs and hides them from employer lists; purge on every page load; lib/practice/practice.test.ts with an injected clock, tests/e2e/practice.spec.ts)
- [x] C8.2 [D] Practice feedback on clarity and specificity, never a score (practice-feedback prompt in lib/ai/services/coach.ts, local rules behind the provider; lib/ai/practiceFeedback.test.ts, tests/e2e/practice.spec.ts)
- [x] G4 [D] Bias test (6 names and dialect variants) fails the build if levels differ (lib/ai/bias.test.ts, runs in CI)
- [x] A1 to A5 [H] Accessibility pass (keyboard, focus, labels, captions, reduced motion, low bandwidth, axe): zero serious/critical axe findings on every route in light and dark (tests/e2e/a11y.spec.ts, lib/store/accommodations.test.ts; docs/POLISH.md)
- [x] P.1 [H] Polish checklist (empty states, skeletons, toasts, favicon, themes, 375 and 1440 px): docs/POLISH.md, each item tied to a test
- [x] P.2 [D] Demo shortcuts behind a key combo; demo seed and reset script (Ctrl+Shift+D panel: roles, seed, reset, jumps; /demo/reset and `pnpm demo:reset`; lib/demo/reset.test.ts, tests/e2e/demo.spec.ts)
- [ ] P.3 [H] Deck, demo script, Q&A prep, timing, backup video (draft ready for Haris: docs/pitch/)
- [ ] G.1 [D+H] /admin/impact with seeded data (200 candidates, 3 employers): all Part G metrics
- [ ] I.1 [D+H] Demo script v2 (PRD Part I) runs twice in a row without a bug (draft ready for Haris: tests/e2e/demo-script.spec.ts passes with --repeat-each=2; Second Look, Resume vs Evidence and the demo panel steps skipped until merged)
- [x] E8.2 [D] (P2) "Ask for a short add-on" mini-scenario (recruiter one-click request on a reused card, 5-minute text mini-scenario for only the missing skills, evidence levels only; lib/addon/addon.test.ts, tests/e2e/addon.spec.ts)
- Done when: axe zero serious issues, Lighthouse 85+ on the game page, bias test passes, demo runs twice in a row without a bug.

## Blockers

- #44 portraits and map wording are merged (#48, #49). The game shell now integrates the portraits; A.5 is accepted in main. #46 independent Codex label proposals await human review in #50.

- #47 dashboard implementation awaits review in #51. It separates local/demo data, includes 200 synthetic attempts across three employers, and shows evidence/funnel/witness/fairness summaries. Current main now supplies persisted consistency context; the dashboard consumes it. G.1 remains open for the remaining telemetry/integration contracts. I.1's two rehearsals still need the complete v2 flow; see `docs/demo/V2_SCRIPT.md`.

- M0.8 Vercel: Div imports the repo at vercel.com/new. If TurningPoint is not listed, Haris grants the Vercel GitHub app access to it.

- M0 accepted by Div on Board #1 (2026-11-04): foundation PRs #32 to #34 merged into main. #25 deployment deferred until the product is done. #11 to #15 may proceed. Recruiter and employer screens #16 to #18 are delegated to Div.


- #19 results, share controls, witness layout and global AI explanation implementation is ready for review. See `docs/reviews/19-results-witness-ai.md`. Optional witness names are explicitly page-local under the existing privacy contract. Acceptance ticks await CI/review; real-device and first-user timing checks remain with #21.
