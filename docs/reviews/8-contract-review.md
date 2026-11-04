# Contract review: issue #8

Reviewed integration commit `2fcbe91588302b7629407909cedc5a3c9d73a389`, including the fixes in `ff2b869`.

## Findings

The two findings from the review of `2019753` are fixed:

- `verifyEvidence` removes both the source and sentence when a quote or choice fails verification. Source-free evidence cannot retain an AI sentence. Source-free strong/some evidence becomes not observed; invalid strong evidence requires human review. Regression tests cover invented and near-match quotes, all four source-free levels, and valid and invalid choice sources.
- `CardSchema.review` and the local store's `ReviewSchema` share the nonblank pass-reason predicate. Missing and whitespace-only reasons are rejected. Hold and shortlist remain possible without a reason. Card and store regression tests cover these boundaries.

The scenario contract supports the five node types, graph validation, seeded disruptions, art alt text and checkpoint fallback questions. The sample card parses against the shared contract and its evidence verifies. The local-only store replaces the database under the agreed demo scope.

Consumers of the card must use `verifyEvidence` before displaying AI evidence. `CardSchema` validates shape; it does not establish that an evidence source is true. Card UI and extraction work remain separate tasks.

## Validation

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 49 passed across 6 files.
- `pnpm e2e --workers=1`: 26 passed on desktop and 375 px phone (2.2 minutes).
- Default parallel `pnpm e2e`: 24 passed, 2 desktop media-start timeouts at `tests/e2e/helpers.ts:47` (still in think phase after 5 seconds). All media flows passed serially. Parallel media startup remains a test reliability follow-up for Div.

Checks used pnpm 10.20.0 through a temporary Corepack shim, temporary Playwright Chromium binaries and a per-process file limit of 10240. The sandboxed dev server still hit EMFILE; browser checks ran outside the filesystem sandbox. No test or production implementation was changed to obtain a pass.

## Decision

Approved for M0.4. Both requested contract fixes are verified. This sign-off covers the contracts, not acceptance of later candidate screens. No implementation PR existed to approve formally. The review record and progress update are submitted separately for Div to review.
