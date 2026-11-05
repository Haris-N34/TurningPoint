# Asset sources and licence status

## NPC portraits

Original synthetic artwork generated for Turning Point on 2026-11-04 using the
built-in OpenAI image_gen tool. No downloaded portrait pack, real-person photo,
logo, branded character or third-party reference image was supplied.

Source prompts: `docs/content/npc-portrait-prompts.json`. Original generated
sheets and SHA-256 hashes: `docs/content/portrait-sources.json` and
`docs/art/portraits/`. Runtime exports: `public/assets/portraits/`.

Licence status: AI-generated project assets, supplied for use in Turning Point.
These are not Kenney assets and are not labelled CC0 or as a third-party licence.
No separate external portrait licence file was supplied by the generation tool.
This provenance record does not assert exclusive copyright or grant an invented
licence. Attribution credit: "NPC portraits generated with OpenAI image_gen for
Turning Point; prepared by Haris's Codex."

Every row includes `neutral.png`, `worried.png`, `happy.png`, `angry.png`:

| Directory | Character | Source | Licence status |
| --- | --- | --- | --- |
| `priya` | Volunteer lead | Original image_gen output | AI-generated project asset |
| `mr-okafor` | Sponsor representative | Original image_gen output | AI-generated project asset |
| `dana` | Non-profit lead | Original image_gen output | AI-generated project asset |
| `vendor-1` | Baker | Original image_gen output | AI-generated project asset |
| `vendor-2` | Grower | Original image_gen output | AI-generated project asset |
| `vendor-3` | Craft seller | Original image_gen output | AI-generated project asset |
| `logistics-volunteer` | Logistics volunteer | Original image_gen output | AI-generated project asset |
| `developer` | Client Pivot developer | Original image_gen output | AI-generated project asset |
| `analyst` | Client Pivot data analyst | Original image_gen output | AI-generated project asset |
| `partner` | Client Pivot consulting partner | Original image_gen output | AI-generated project asset |
| `store-manager` | Client Pivot store manager | Original image_gen output | AI-generated project asset |
| `cfo` | Client Pivot CFO | Original image_gen output | AI-generated project asset |
| `former-employee` | Client Pivot former employee | Original image_gen output | AI-generated project asset |

## Tiles, map sprites, audio and UI packs

All Kenney packs are CC0 1.0 (public domain, no attribution required). Credit given anyway. Each pack's own licence file sits next to it.

| Pack | Source | Licence | Included paths |
|---|---|---|---|
| Tiny Town | https://kenney.nl/assets/tiny-town | CC0 1.0 (`public/assets/kenney_tiny-town-License.txt`) | `public/assets/tiles/kenney-tiny-town.png` |
| Tiny Dungeon | https://kenney.nl/assets/tiny-dungeon | CC0 1.0 (`public/assets/kenney_tiny-dungeon-License.txt`) | `public/assets/tiles/kenney-tiny-dungeon.png` |
| Interface Sounds | https://kenney.nl/assets/interface-sounds | CC0 1.0 (`public/assets/kenney_interface-sounds-License.txt`) | `public/assets/sfx/back_002.ogg`, `click_002.ogg`, `confirmation_002.ogg` |
| Impact Sounds | https://kenney.nl/assets/impact-sounds | CC0 1.0 (`public/assets/kenney_impact-sounds-License.txt`) | `public/assets/sfx/base-impact.ogg` |

The tile sheets were taken from a public mirror carrying Kenney's licence file, because kenney.nl blocks automated downloads. They are byte copies of the official packs.

Not from a pack (made in code, no licence needed): character sprites (`lib/game/sprites.ts`, generated pixel by pixel), music and most sound effects (`lib/game/sound.ts`, WebAudio synthesis), the map layout (`scripts/build-map.py` writes `public/maps/*.json` in Tiled format).

## Fonts

| Font | Source | Licence | Included paths |
|---|---|---|---|
| Pixelify Sans 400, 600 (latin) | Fontsource 5.3.0 (https://fontsource.org/fonts/pixelify-sans) | SIL OFL 1.1 (`components/game2/fonts/OFL-pixelify-sans.txt`) | `components/game2/fonts/pixelify-sans-latin-*.woff2` |
| Press Start 2P 400 (latin) | Fontsource 5.3.0 (https://fontsource.org/fonts/press-start-2p) | SIL OFL 1.1 (`components/game2/fonts/OFL-press-start-2p.txt`) | `components/game2/fonts/press-start-2p-latin-400-normal.woff2` |

Self-hosted so the build never fetches from Google Fonts. The site fonts in `app/layout.tsx` (Geist, Geist Mono, Lora) still load through `next/font/google`.
