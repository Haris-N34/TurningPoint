# Progress

Every acceptance criterion from `docs/PRD.md`, grouped by milestone. Tick only when a test covers it and the full check (`pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`) is green. Owner in brackets: [D] Div, [H] Haris, [D+H] both.

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
- [x] S.3 [H] Launch Week written in full (15 nodes, eligible 3, 6, 9, 10, 12, 3 disruptions); 87 unit + 44 serial e2e pass (#11, awaiting review). C2.5 timed first-user validation remains open.
- [ ] S.4 [H] Client Rescue template written
- [ ] S.5 [H] 12 to 15 scene illustrations, one flat style, alt text
- Done when: a Playwright test plays Launch Week start to end on desktop and phone, every choice is in the database.

## M2. Checkpoints

- [ ] C1.1 [H] Three intro screens (checkpoints, timing, formats, no face or tone scored)
- [x] C1.2 [D] Default answer mode, changeable at every checkpoint
- [ ] C1.3 [D+H] Device check: camera preview, mic meter, text fallback on denied permission (fallback inside checkpoints done, D; device check screen pending, H)
- [ ] C1.4 [D+H] Accommodations form (1.5x, 2x, text-only, screen reader) changes timers (timers and text-only wired and tested, D; form UI pending, H)
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
- [ ] AI.1 [H] Fallback question for every checkpoint-eligible node; rubric examples
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
- [ ] PV3 [D] Recordings served by 1-hour signed URLs only
- Done when: finishing a run produces a card where every AI sentence links to a real timestamp, and a recruiter can shortlist from the inbox.

## M4. Employer side and portability

- [ ] E1.1 [H] Skills step: 10 skill cards, pick 3 or 4
- [ ] E1.2 [H] Scenario step: 2+ templates with thumbnail, length, skills
- [x] E1.3 [D] Tailoring (local word swaps per industry) returns schema-valid JSON or keeps the original
- [ ] E1.4 [H] Inline scene editing, mark checkpoint-eligible
- [ ] E1.5 [D+H] Preview as candidate, no data saved (sandbox route /admin/preview/<id> done and tested, D; button in builder, H)
- [x] E1.6 [D] Publish creates public link, job code and QR (logic; builder UI shows them, H)
- [ ] E1.7 [H] Setup under 10 minutes for a first-time user
- [ ] C6.1 [H] Add up to 2 witnesses with relationship (functional form on results by D; design H)
- [x] C6.2 [D] Witness one-time link, expires in 14 days (shown to send, not emailed: demo scope)
- [ ] C6.3 [H] Witness page, no account, phone, under 30 s (functional /witness/<token> by D, e2e on phone; design H)
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
- [ ] PV5 [H] "How we use AI" page linked from every screen
- Done when: the five-step loop from the PRD Summary works end to end on the deployed site.

## M5. Polish and proof

- [ ] E4.1 [H] Compare view (2 or 3 cards)
- [ ] E7.1 [H] Funnel counts per challenge
- [ ] E7.2 [H] Completion and shortlist rate by mode and accommodation
- [ ] E7.3 [D+H] Opt-in demographics, four-fifths warning
- [ ] E7.4 [H] Seed data: 200 fake candidates
- [ ] C8.1 [D] Practice mode, nothing shared, deleted after 24 h
- [ ] C8.2 [D] Practice feedback on clarity and specificity, never a score
- [x] G4 [D] Bias test (6 names and dialect variants) fails the build if levels differ (lib/ai/bias.test.ts, runs in CI)
- [ ] A1 to A5 [H] Accessibility pass (keyboard, focus, labels, captions, reduced motion, low bandwidth, axe)
- [ ] P.1 [H] Polish checklist (empty states, skeletons, toasts, favicon, themes, 375 and 1440 px)
- [ ] P.2 [D] Demo shortcuts behind a key combo; demo seed and reset script
- [ ] P.3 [H] Deck, demo script, Q&A prep, timing, backup video
- [ ] E8.2 [D] (P2) "Ask for a short add-on" mini-scenario
- Done when: axe zero serious issues, Lighthouse 85+ on the game page, bias test passes, demo runs twice in a row without a bug.

## Blockers

- M0.8 Vercel: Div imports the repo at vercel.com/new. If TurningPoint is not listed, Haris grants the Vercel GitHub app access to it.

- M0 accepted by Div on Board #1 (2026-11-04): foundation PRs #32 to #34 merged into main. #25 deployment deferred until the product is done. #11 to #15 may proceed. Recruiter and employer screens #16 to #18 are delegated to Div.
