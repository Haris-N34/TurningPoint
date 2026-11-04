# Scene illustration package

Generated with the built-in imagegen tool. Fifteen original illustrations, no real people, brands or logos. Full prompts are in `scene-art-prompts.json`; each uses the style prefix below.

> Single wide 3:2 landscape illustration. Flat editorial geometric illustration with subtle paper texture, warm cream background, burnt orange, muted sage, charcoal palette. Calm inclusive thoughtful fictional student community project, simple rounded silhouettes and clear composition at thumbnail size. No real people, brands, logos, words, numbers, watermark or readable text.

Assets: `public/art/<key>.webp` (960 × 640) and `public/art/<key>.small.webp` (384 × 256). `public/art/manifest.json` records alt text. Launch Week stores the same key and alt in each node's scenario JSON. Its last three scenes reuse the debrief illustration.

Client Rescue is awaiting integration in PR #36. Apply the following mapping after it lands, retaining the manifest's matching alt text:

| Nodes | Key |
| --- | --- |
| n1, n2, n4, n6 | client-review |
| n3, n5 | team-roles |
| n7 | outreach |
| n8 | plan-breaks |
| n9, n10, n11, n12 | client-reset |
| n13, n14, n15 | debrief |

The existing Game component reads the full-size WebP path. Low-bandwidth image selection still needs Div's approval or implementation in that component: choose `.small.webp` when `profile.accommodations.lowBandwidth` is true. That ownership request is on Board #1. This package does not claim the low-bandwidth toggle already changes images.
