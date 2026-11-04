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
- [ ] M0.7 [D] CI (GitHub Actions) green on lint, typecheck, unit, e2e (workflow committed; first run pending)
- [ ] M0.8 [D] Deployed to Vercel
- [ ] M0.9 [H] Design system tokens (fonts, accent, neutrals, light and dark)
- [ ] M0.10 [H] Landing page (screen 1)
- [ ] M0.11 [H] Role picker (screen 2)
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
- [ ] S.3 [H] Launch Week written in full (15 nodes, eligible 3, 6, 9, 10, 12, 3 disruptions)
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
- [ ] G2 [D] Models never get name, email, university or video frames
- [ ] G3 [D] Prompt and model version stored with every result
- [ ] AI.2 [D] Evidence extraction per rubric (Strong, Some, Not observed); "Needs human review" fallback
- [ ] AI.3 [D] Data APIs for inbox and card
- [ ] E2.1 [H] Inbox table (anon ID, date, status, top 3 skills, witness, reused)
- [ ] E2.2 [H] Filters and sorts
- [ ] E2.3 [H] Shortcuts J/K, Enter, S
- [ ] E3.1 [H] Card header (verified, "adjusted timing" only)
- [ ] E3.2 [H] Skill evidence strip; never an overall score
- [ ] E3.3 [H] Decision path timeline with turning point and checkpoint dots
- [ ] E3.4 [D+H] Clips; click a sentence to jump to the exact second
- [ ] E3.5 [H] Real turning point section
- [ ] E3.6 [H] Integrity notes, "For context, not scored"
- [ ] E3.7 [D+H] Shortlist, Hold, Pass (pass needs a reason)
- [ ] E3.8 [H] Every AI sentence labelled "AI summary" with a source link
- [ ] E6.1 [D+H] Anonymous first review ON by default
- [ ] E6.2 [H] Transcript-first video setting
- [ ] PV3 [D] Recordings served by 1-hour signed URLs only
- Done when: finishing a run produces a card where every AI sentence links to a real timestamp, and a recruiter can shortlist from the inbox.

## M4. Employer side and portability

- [ ] E1.1 [H] Skills step: 10 skill cards, pick 3 or 4
- [ ] E1.2 [H] Scenario step: 2+ templates with thumbnail, length, skills
- [ ] E1.3 [D] AI tailoring returns schema-valid JSON or keeps the original
- [ ] E1.4 [H] Inline scene editing, mark checkpoint-eligible
- [ ] E1.5 [D+H] Preview as candidate, no data saved
- [ ] E1.6 [D] Publish creates public link, job code and QR
- [ ] E1.7 [H] Setup under 10 minutes for a first-time user
- [ ] C6.1 [H] Add up to 2 witnesses with relationship
- [ ] C6.2 [D] Witness email with one-time link, expires in 14 days
- [ ] C6.3 [H] Witness page, no account, phone, under 30 s
- [ ] C6.4 [H] Card shows "Confirmed by ..." never the witness email
- [ ] C6.5 [D] Reject witness email matching candidate email or domain alias
- [ ] C7.1 [H] Candidate sees own card exactly as a recruiter would
- [ ] C7.2 [D+H] Hide a single clip (no transcript edits)
- [ ] C7.3 [D+H] Share with another employer in one click, "Reused" badge
- [ ] C7.4 [D] Revoke share; employer sees "Candidate withdrew this card"
- [ ] C7.5 [D] Delete everything within 1 minute (`delete_my_data`)
- [ ] E8.1 [D+H] Inbox shows reused cards with covered skills
- [ ] E5.1 [D] Mock Greenhouse endpoint, success toast with payload
- [ ] E5.2 [D] Exported candidate links back to the card
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
- [ ] G4 [D] Bias test (6 names and dialect variants) fails the build if levels differ
- [ ] A1 to A5 [H] Accessibility pass (keyboard, focus, labels, captions, reduced motion, low bandwidth, axe)
- [ ] P.1 [H] Polish checklist (empty states, skeletons, toasts, favicon, themes, 375 and 1440 px)
- [ ] P.2 [D] Demo shortcuts behind a key combo; demo seed and reset script
- [ ] P.3 [H] Deck, demo script, Q&A prep, timing, backup video
- [ ] E8.2 [D] (P2) "Ask for a short add-on" mini-scenario
- Done when: axe zero serious issues, Lighthouse 85+ on the game page, bias test passes, demo runs twice in a row without a bug.

## Blockers

- M0.8 Vercel: Div imports the repo at vercel.com/new. If TurningPoint is not listed, Haris grants the Vercel GitHub app access to it.
