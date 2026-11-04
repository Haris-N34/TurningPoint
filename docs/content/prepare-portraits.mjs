// Mechanical sprite-sheet slicing only. No generated facial pixels are redrawn.
// Usage: node docs/content/prepare-portraits.mjs /tmp/portrait-sources.json
// Input: [{ id, source }], paths to the original built-in image_gen sheets.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const projectRequire = createRequire(import.meta.url);
const sharp = createRequire(projectRequire.resolve("next/package.json"))("sharp");

async function main() {
  const sources = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
  const expressions = ["neutral", "worried", "happy", "angry"];
  const output = "public/assets/portraits";
  await fs.mkdir("docs/screens", { recursive: true });
  const tiles = [];
  for (const { id, source } of sources) {
    const { width, height } = await sharp(source).metadata();
    await fs.mkdir(path.join(output, id), { recursive: true });
    for (const [index, expression] of expressions.entries()) {
      const left = Math.round(index * width / 4);
      const right = Math.round((index + 1) * width / 4);
      const png = await sharp(source)
        .extract({ left, top: 0, width: right - left, height })
        .resize(96, 96, { fit: "contain", kernel: "nearest", background: "#241f30" })
        .png().toBuffer();
      await fs.writeFile(path.join(output, id, `${expression}.png`), png);
      tiles.push({ input: png, left: index * 96, top: sources.findIndex(s => s.id === id) * 96 });
    }
  }
  await sharp({ create: { width: 384, height: sources.length * 96, channels: 3, background: "#241f30" } })
    .composite(tiles).png().toFile("docs/screens/npc-portraits-contact-sheet.png");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
