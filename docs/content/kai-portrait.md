# Kai portrait follow-up (#44)

Requested by Div on Board #1, 2026-11-05. Built-in image_gen, generated 2026-11-04 local time. Style reference: the project's synthetic `developer/neutral.png`. This is a new fictional character, not a real-person likeness.

Prompt:

> Use case: stylized-concept. Create a production pixel-art game portrait sheet for Turning Point. Reference image is style only: match its chunky low-resolution pixel edges, warm muted palette, dark plum outlines and flat dark plum background. New character Kai, a fictional young adult store employee with short straight dark hair, warm medium skin, teal work polo and plain cream apron, no logos. Four equal square cells in exactly a 2 by 2 grid, no gutters: top left neutral, top right worried, bottom left happy, bottom right angry. Same person, same shoulders-up centered framing, hair and costume across all four cells. Each head fully inside its cell with consistent generous margin, no cropping. Intended each cell downsampled to 96x96 pixels. No text, no labels, no numbers, no watermark. Only this single character in all four expressions.

Source: `docs/art/portraits/store-employee.png`; hash in `portrait-sources.json`. Exports crop each quadrant inward by 2 source pixels to remove the sheet divider, then resize with nearest-neighbour sampling to 96x96. Paths and alt text are in the existing portrait manifest. Uses `store-employee`, already referenced by Kai in the map generator. No game code or map mechanics changed. Licence status follows `public/assets/LICENSES.md`; no CC0 claim.
