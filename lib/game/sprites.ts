import type { Look } from "./schema";

// Character pixel art, drawn in code so every look (skin, hair, outfit) gets a full 4-direction
// walk cycle in the same chunky 16x16 style as the Kenney tiles. Pure: returns RGBA pixels.

export const FRAME = 16;
export const DIRS = ["down", "left", "right", "up"] as const;
export type Dir = (typeof DIRS)[number];
export const FRAMES_PER_DIR = 3; // stand, step A, step B

// Keys: . transparent  O outline  S skin  s skin shadow  H hair  h hair shadow  C top  c top shadow
//       A accent  P trousers  E eye  W glasses rim  K shoe
const BODY_DOWN = [
  "................",
  "................",
  "................",
  "................",
  "....OSSSSSSO....",
  "....OSESSESO....",
  "....OSSSSSSO....",
  ".....OssssO.....",
  "....OCCAACCO....",
  "...OSCCCCCCSO...",
  "...OSCCCCCCSO...",
  "....OcCCCCcO....",
  "....OPPPPPPO....",
];
const BODY_UP = [
  "................",
  "................",
  "................",
  "................",
  "....OHHHHHHO....",
  "....OHHHHHHO....",
  "....OhHHHHhO....",
  ".....OssssO.....",
  "....OCCCCCCO....",
  "...OSCCCCCCSO...",
  "...OSCCCCCCSO...",
  "....OcCCCCcO....",
  "....OPPPPPPO....",
];
const BODY_LEFT = [
  "................",
  "................",
  "................",
  "................",
  "....OSSSSHHO....",
  "....OESSSHHO....",
  "....OSSSShHO....",
  ".....OsssO......",
  ".....OCCACO.....",
  ".....OCSCCO.....",
  ".....OCSCCO.....",
  ".....OcCCcO.....",
  ".....OPPPPO.....",
];
const LEGS: Record<"front" | "side", string[][]> = {
  front: [
    ["....OPPOOPPO....", "....OKKOOKKO....", "....OOO..OOO...."],
    ["....OPPOOPPO....", "....OKKO.OPO....", "....OOO..OKO...."],
    ["....OPPOOPPO....", "....OPO.OKKO....", "....OKO..OOO...."],
  ],
  side: [
    [".....OPPPO......", ".....OKKKO......", ".....OOOO......."],
    [".....OPOPO......", "....OKO.OKO.....", "....OOO.OOO....."],
    [".....OPPPO......", ".....OKKO.......", ".....OOOO......."],
  ],
};
// Hair caps, rows 0..4, per facing. Bun/spiky add a top row.
const HAIR: Record<Look["hairStyle"], { front: string[]; side: string[]; back: string[] }> = {
  short: {
    front: ["................", ".....OOOOOO.....", "....OHHHHHHO....", "....OHHHHHhO....", "....OHSSSSHO...."],
    side: ["................", ".....OOOOOO.....", "....OHHHHHHO....", "....OhHHHHHO....", "....OSSSHHHO...."],
    back: ["................", ".....OOOOOO.....", "....OHHHHHHO....", "....OHHHHHHO....", "....OHHHHHHO...."],
  },
  bun: {
    front: [".......OOO......", "......OHHHO.....", "....OOHHHHOO....", "....OHHHHHHO....", "....OHSSSSHO...."],
    side: ["........OOO.....", ".......OHHHO....", ".....OOHHHHO....", "....OHHHHHHO....", "....OSSSHHHO...."],
    back: [".......OOO......", "......OHHHO.....", "....OOHHHHOO....", "....OHHHHHHO....", "....OHHHHHHO...."],
  },
  curly: {
    front: ["................", "....O.OO.OO.O...", "...OHOHHOHHOHO..", "...OHHHHHHHHO...", "...OHHSSSSHHO..."],
    side: ["................", "....O.OO.OO.O...", "...OHOHHOHHOHO..", "....OHHHHHHHHO..", "....OSSSHHHHHO.."],
    back: ["................", "....O.OO.OO.O...", "...OHOHHOHHOHO..", "...OHHHHHHHHO...", "...OHHHHHHHHO..."],
  },
  long: {
    front: ["................", ".....OOOOOO.....", "....OHHHHHHO....", "...OHHHHHHHhO...", "...OHHSSSSHHO..."],
    side: ["................", ".....OOOOOO.....", "....OHHHHHHO....", "....OHHHHHHHO...", "....OSSSHHHHO..."],
    back: ["................", ".....OOOOOO.....", "....OHHHHHHO....", "...OHHHHHHHHO...", "...OHHHHHHHHO..."],
  },
  bald: {
    front: ["................", "................", ".....OOOOOO.....", "....OSSSSSSO....", "....OSSSSSSO...."],
    side: ["................", "................", ".....OOOOOO.....", "....OSSSSSSO....", "....OSSSSSSO...."],
    back: ["................", "................", ".....OOOOOO.....", "....OSSSSSSO....", "....OsSSSSsO...."],
  },
  spiky: {
    front: ["....O.O..O.O....", "....OHOOHOHO....", "....OHHHHHHO....", "....OHHHHHhO....", "....OHSSSSHO...."],
    side: ["....O.O..O.O....", "....OHOOHOHO....", "....OHHHHHHO....", "....OhHHHHHO....", "....OSSSHHHO...."],
    back: ["....O.O..O.O....", "....OHOOHOHO....", "....OHHHHHHO....", "....OHHHHHHO....", "....OHHHHHHO...."],
  },
};

function hex(c: string): [number, number, number] {
  const m = c.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((x) => x + x).join("") : m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const shade = (c: [number, number, number], f: number): [number, number, number] => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))) as [number, number, number];

export function palette(look: Look): Record<string, [number, number, number]> {
  const skin = hex(look.skin), hair = hex(look.hair), top = hex(look.outfit);
  const accent = hex(look.accent ?? "#f1e4c3");
  return {
    O: [46, 34, 47],
    S: skin,
    s: shade(skin, 0.82),
    H: hair,
    h: shade(hair, 0.75),
    C: top,
    c: shade(top, 0.78),
    A: accent,
    P: [59, 59, 88],
    E: [33, 24, 35],
    W: [230, 236, 240],
    K: [74, 52, 46],
  };
}

/** Rows (16 strings of 16 chars) for one frame. */
export function frameRows(look: Look, dir: Dir, frame: number): string[] {
  const facing = dir === "up" ? "back" : dir === "down" ? "front" : "side";
  const hair = HAIR[look.hairStyle][facing];
  let body = dir === "down" ? BODY_DOWN : dir === "up" ? BODY_UP : BODY_LEFT;
  body = body.map((r) => r);
  const legs = LEGS[dir === "down" || dir === "up" ? "front" : "side"][frame % FRAMES_PER_DIR];
  // Long hair falls over the shoulders when seen from the front or back.
  if (look.hairStyle === "long" && dir !== "left" && dir !== "right") {
    body = body.map((r, i) => (i >= 5 && i <= 9 ? r.slice(0, 3) + "H" + r.slice(4, 12) + "H" + r.slice(13) : r));
  }
  if (look.extra === "glasses" && dir === "down") body = body.map((r, i) => (i === 5 ? "....OWEWWEWO...." : r));
  if (look.extra === "glasses" && dir === "left") body = body.map((r, i) => (i === 5 ? "....OWEWSHHO...." : r));
  if (look.extra === "apron" && dir === "down") body = body.map((r, i) => (i >= 9 && i <= 11 ? r.replace(/CCCC/, "AAAA") : r));
  if (look.extra === "vest" && dir !== "up") body = body.map((r, i) => (i >= 8 && i <= 11 ? r.replace(/C(C+)C/, (m) => "A" + m.slice(1, -1) + "A") : r));
  const rows = [...hair, ...body.slice(5), ...legs];
  // Gentle bob on step frames.
  const out = frame === 0 ? rows : ["................", ...rows.slice(0, 15)];
  return out.slice(0, 16).map((r) => r.padEnd(16, ".").slice(0, 16));
}

/** RGBA pixels for a full sheet: columns = frames (3), rows = directions (down, left, right, up). */
export function characterSheet(look: Look): { width: number; height: number; data: Uint8ClampedArray } {
  const width = FRAME * FRAMES_PER_DIR, height = FRAME * DIRS.length;
  const data = new Uint8ClampedArray(width * height * 4);
  const pal = palette(look);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      const rows = frameRows(look, dir === "right" ? "left" : dir, f);
      for (let y = 0; y < FRAME; y++)
        for (let x = 0; x < FRAME; x++) {
          const sx = dir === "right" ? FRAME - 1 - x : x; // right = mirrored left
          const ch = rows[y][sx];
          if (ch === ".") continue;
          const c = pal[ch];
          if (!c) continue;
          const i = ((row * FRAME + y) * width + f * FRAME + x) * 4;
          data[i] = c[0];
          data[i + 1] = c[1];
          data[i + 2] = c[2];
          data[i + 3] = 255;
        }
    }
  });
  return { width, height, data };
}

/** Avatar creator options (A0): inclusive skin tones, hair styles and colours, outfits. */
export const AVATAR_OPTIONS = {
  skin: ["#f6d7c3", "#eec19f", "#d9a17a", "#b97c55", "#8d5a3b", "#6b4430", "#4a2f22"],
  hairStyle: ["short", "bun", "curly", "long", "bald", "spiky"] as Look["hairStyle"][],
  hair: ["#1f1720", "#3a2418", "#6b3e22", "#b3762e", "#e3c06a", "#c4462a", "#9a9a9a", "#4a6fb0"],
  outfit: ["#2f7f73", "#a6482a", "#283a5c", "#6b4fa0", "#3f6b3a", "#c47a2c", "#7a2e3a", "#384048"],
  extra: ["none", "glasses", "vest", "apron"] as Look["extra"][],
};

export const DEFAULT_AVATAR: Look = { skin: "#b97c55", hair: "#1f1720", hairStyle: "short", outfit: "#a63e20", accent: "#f1e4c3", extra: "none" };
