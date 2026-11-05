import localFont from "next/font/local";

// Game UI fonts, self-hosted so builds never depend on a network fetch (SIL OFL 1.1, see public/assets/LICENSES.md).
// Pixelify Sans for readable body text, Press Start 2P for titles and HUD numbers.
export const pixelBody = localFont({
  src: [
    { path: "./fonts/pixelify-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/pixelify-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-pixel",
  display: "swap",
});
export const pixelTitle = localFont({
  src: [{ path: "./fonts/press-start-2p-latin-400-normal.woff2", weight: "400", style: "normal" }],
  variable: "--font-pixel-title",
  display: "swap",
});
