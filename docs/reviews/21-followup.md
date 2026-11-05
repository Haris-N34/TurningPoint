# #21 follow-up review

Reviewed main `60f25f5` and Div's accessibility handoff. Existing contrast, focus, witness status, skeleton and favicon changes are already integrated. Do not reimplement them.

The witness skill fieldset has a legend inside a layout div. Move the legend to a direct child of the fieldset so assistive technology can name the checkbox group. The browser regression locates checkboxes through the named group rather than finding ungrouped checkboxes globally.

Automated viewport tests and scripted witness completion do not establish physical-phone, screen-reader user or first-time human timing acceptance. Those checks remain open. This review does not certify WCAG conformance.

Other queue findings:

- #20 has an existing PR #53 with green CI. Main also contains Div's separate compare implementation. Review and reconcile that PR rather than opening a duplicate implementation.
- #46 needs Haris's own blind labels. Codex proposals in #50 are not human ratings.
- #47 is merged from #51. Div is wiring the remaining metrics; avoid overlapping metric code.
- #22 has updated pitch drafts on `claude/v2-pitch-2`. The title is now a still image, despite the script asking for an animated title map. Human rehearsals, source verification and backup recording remain outstanding. Do not mark P.3 or I.1 complete from browser automation alone.

Review findings outside this patch:

- Full-suite checkpoint axe scan on main reports color contrast on `.leading-relaxed`. Div's `claude/v2-a11y` branch includes a settled-animation scan change and checkpoint token fixes not yet present in this main snapshot. Div should integrate and rerun those changes.
- The Client Pivot keyboard full-week test expects instant text speed but reads normal. This is outside the witness markup patch and needs game/test-owner investigation.

Validation on this branch: lint and typecheck pass; unit tests: 426 passed, 3 skipped. Full browser run (`pnpm e2e --workers=2`): 188 passed, 21 skipped, 3 failed. Failures: desktop checkpoint axe contrast (`.leading-relaxed`), desktop Client Pivot keyboard text-speed expectation (`normal` instead of `instant`), phone AI explanation axe (`document-title` after client navigation). Both desktop and phone witness tests pass, including the named-group regression. The pre-fix regression timed out finding that named group, with the snapshot showing an unnamed fieldset. Initial sandbox browser startup failed with EMFILE; full run used an elevated file limit outside the sandbox. Physical-phone and human timing checks were not performed.
