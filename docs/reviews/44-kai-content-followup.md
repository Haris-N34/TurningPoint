# #44 follow-up: Kai and v2 wording review

Reviewed The Client Pivot cast, chart values, pitch options, partner feedback and Launch Week's five new recovery dialogues on main `60f25f5`.

- Kai now has four original synthetic portraits under the existing `store-employee` manifest ID. The game already references this ID.
- Client Pivot's CFO pitch claimed a nine-month payback with no cost, savings or payback data visible to the player. Replaced that unsupported number with a proposal to explain costs and assumptions.
- The credibility dialogue called 4%, 4%, 5% waste flat. It now quotes the displayed endpoints and the 19-stockout small-store figure. No chart data changed.
- The cast names and distinct roles are clear. The blunt "unreadable" feedback targets the deck, gives a concrete fault and offers a constructive response. Retained it.
- Launch Week venue recovery, cover, vendor move, handover and lost-lead dialogues match their disruption and distinguish trade-offs. Retained them. Postponement choices still lead to a fixed Friday end; a future mechanics change could acknowledge that outcome explicitly.

Generator and generated JSON stay in sync. All option IDs, effects, schedules, costs, eligibility flags and KPI markers match main. No game code changed.

Validation: lint and typecheck pass; 426 unit tests pass, 3 skipped. The portrait cast test failed before Kai was added. All four PNGs decode at 96x96 and were visually inspected. Full `pnpm e2e --workers=2`: 187 passed, 21 skipped, 4 failed. Both desktop static-route theme scans aborted navigation to `/candidate/verify`; desktop Client Pivot keyboard setup read text speed `normal` instead of `instant`; the phone list-view full week timed out waiting for `to-results` at 180 seconds. No game implementation was changed to work around those failures. Initial browser setup failed because Turbopack rejects cross-worktree node_modules symlinks; a local frozen-lockfile install resolved startup. This remains awaiting review with full-suite acceptance open.
