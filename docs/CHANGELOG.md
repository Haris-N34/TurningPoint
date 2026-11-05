# Changelog

One entry per milestone. Screens live in `docs/screens/`.

## M1.5 game (v2 Part A), Nov 5

Ticked: A.3, A.4, A.5, A.6, A.7, A.8, A.10, A.11, A.12, A.13, A.14, A.15, A.16, A.17, A.18, A.22.

- Top-down Phaser map (Kenney Tiny Town), generated 4-direction characters, HUD, clock, issue tracker, list view.
- Dialogue with portraits, typewriter, A to D choices by keyboard, reactions and juice.
- Turning-point cutscene, evening recaps, choice-triggered checkpoints, order question, end-of-week results.
- The Client Pivot map (A.8): data mini-view, hidden discoveries, pitches.
- Fixes: dialogue waits behind cutscene and recap (they stole focus); camera pan ease crashed the page; dialogue name tag said "You" under the NPC's portrait; game fonts self-hosted.

Screens (desktop, `SCREENS=1 pnpm exec playwright test -g screenshots`):
`game-title`, `game-avatar`, `game-map`, `game-dialogue`, `game-checkpoint`, `game-cutscene`, `game-results`. Phone has all but results (the phone run timed out on a loaded machine; rerun to refresh).

Open in M1.5: A.1 and A.2 (quiz test review), A.9 (map-view full run), A.19 (12 to 16 minute timing), A.20 (Lighthouse and fps), A.21 (map-view full runs), A.23 (portrait sets, Haris).
