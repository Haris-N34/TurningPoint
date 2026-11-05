import { Pixelify_Sans, Press_Start_2P } from "next/font/google";

// Game UI fonts: Pixelify Sans for readable body text, Press Start 2P for titles and HUD numbers.
export const pixelBody = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-pixel" });
export const pixelTitle = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-pixel-title" });
