# Changelog

One entry per milestone. Screens live in `docs/screens/`.

## M3.5 to M5 merges, Nov 5 (evening)

Ticked: B.1 to B.9, C.1 to C.11, D.1 to D.4, C8.1, C8.2, PV3, P.2, E8.2, E4.1, E7.1 to E7.4, A1 to A5, P.1, PV5, C6.1, C6.3, A.1, A.2, A.9, A.19, A.21, A.23, C2.5, C2.6.

- AI engine behind lib/ai providers (off, cached, live; key only from env), evals in CI, AI health page, Copilot, Value Mapper, said vs did.
- Integrations: mock Greenhouse and Workday, signed webhooks, outbound with retries, public API, Open Badges with /verify, Resume Analyzer (identity stripped first), Second Look.
- Scoring (PRD v2 Part D): a Final score that only sorts, always shows its breakdown, and has no threshold anywhere.
- Practice mode (never shared, deleted after 24 h), practice feedback without a score, 1-hour signed playback links, demo panel (Ctrl+Shift+D) and reset.
- Recruiter compare view, funnel and fairness analytics with a four-fifths warning, 200 synthetic candidates.
- Accessibility pass (axe on every route, light and dark), polish checklist (docs/POLISH.md), "How we use AI" linked everywhere.
- Game: each disruption has its own recovery and follow-ups; map-view tests for walking, click and tap; full week in map view; pace model (12 to 16 min game, 14 to 18 min with the real-life checkpoint).
- Speed: the title screen shows a still of the map and the engine starts at the avatar step. Lighthouse mobile went from 49 to 86.
- /admin/gold: score the gold set by hand.

Still open: M0.8 Vercel (deferred), A.20 fps on a real GPU (use /game/launch-week?fps=1), B.10 human gold labels, G.1 impact dashboard on real data (in progress), P.3 and I.1 (pitch drafts for Haris), challenge links playing the map game with builder edits (in progress).

## M1.5 game (v2 Part A), Nov 5

Ticked: A.3, A.4, A.5, A.6, A.7, A.8, A.10, A.11, A.12, A.13, A.14, A.15, A.16, A.17, A.18, A.22.

- Top-down Phaser map (Kenney Tiny Town), generated 4-direction characters, HUD, clock, issue tracker, list view.
- Dialogue with portraits, typewriter, A to D choices by keyboard, reactions and juice.
- Turning-point cutscene, evening recaps, choice-triggered checkpoints, order question, end-of-week results.
- The Client Pivot map (A.8): data mini-view, hidden discoveries, pitches.
- Fixes: dialogue waits behind cutscene and recap (they stole focus); camera pan ease crashed the page; dialogue name tag said "You" under the NPC's portrait; game fonts self-hosted.

Screens (desktop, `SCREENS=1 pnpm exec playwright test -g screenshots`):
`game-title`, `game-avatar`, `game-map`, `game-dialogue`, `game-checkpoint`, `game-cutscene`, `game-results`. Phone has the same set.

Open in M1.5: A.1 and A.2 (quiz test review), A.9 (map-view full run), A.19 (12 to 16 minute timing), A.20 (Lighthouse and fps), A.21 (map-view full runs), A.23 (portrait sets, Haris).
