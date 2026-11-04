# NPC portraits for v2

Issue #44 names seven Launch Week NPCs and six Client Pivot NPCs despite the
6 to 8 set estimate. This package covers all 13 named roles with 52 portraits.
Review the contact sheet at `docs/screens/npc-portraits-contact-sheet.png`.
Rows follow `manifest.json`; columns are neutral, worried, happy, angry.

## Consumption

Each image is an opaque 96 by 96 PNG on a dark plum background. Use
`/assets/portraits/<id>/<expression>.png`. The manifest provides IDs, scenario
membership and text alternatives. Preserve aspect ratio and use
`image-rendering: pixelated` when enlarging. Preload all four expressions for
each active NPC before opening dialogue to prevent expression pop-in.

Speaker name and dialogue remain React text. Expressions are fictional story
art, not an assessment of a candidate. Never infer candidate emotion from them.
When speaker and reaction are already exposed as text, use empty image alt text
to avoid duplicate screen-reader announcements; otherwise use the manifest alt.
The IDs are an asset contract for Div to map into the forthcoming NPC schema,
not a claim that a map or dialogue consumer already exists.

## Preparation and provenance

Built-in image_gen produced one four-expression sheet per character with the
same prompt structure and palette. Exact prompts and original sheets are kept
with the source record. `prepare-portraits.mjs` slices equal-width quarters,
fits each into 96 by 96 using nearest-neighbour scaling, and builds the contact
sheet. It adds space at the sides rather than stretching faces. Run it with a
JSON array of `{ "id": "priya", "source": "/path/to/original-sheet.png" }`.
It uses the Sharp installation supplied by Next.js. Source sheets are never
overwritten. Licence and credit details live in `public/assets/LICENSES.md`.

## Remaining review

Validation on the task branch: lint and typecheck pass; 93 unit tests pass;
`pnpm e2e --workers=2` passes 65 with one existing laptop-only check skipped on
phone. All 52 PNGs decode, total 658,644 bytes, and expressions are distinct
within every set. The asset-contract test failed before delivery and now passes.

Div's #42 and #43 currently contain no v2 schema or 14 to 18 authored issues.
Review wording, NPC voices, deadlines and trade-offs once those are posted.
Do not invent engine fields or overwrite the existing linear scenarios while
the engine contract is in progress. A.23 remains unchecked pending CI and
review; A.5 requires Div's dialogue integration.
