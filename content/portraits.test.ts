import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "public/assets/portraits");
const expressions = ["neutral", "worried", "happy", "angry"];
const cast = ["priya", "mr-okafor", "dana", "vendor-1", "vendor-2", "vendor-3", "logistics-volunteer", "developer", "analyst", "partner", "store-manager", "cfo", "former-employee"];

describe("A.23 NPC portrait delivery", () => {
  it("covers both named casts with four loadable 96px PNG expressions each", () => {
    const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
    expect(manifest.portraits.map((npc: { id: string }) => npc.id).sort()).toEqual([...cast].sort());
    const licences = readFileSync(join(root, "../LICENSES.md"), "utf8");
    for (const npc of manifest.portraits) {
      expect(Object.keys(npc.expressions).sort()).toEqual([...expressions].sort());
      expect(licences).toContain(`\`${npc.id}\``);
      expect(readdirSync(join(root, npc.id)).sort()).toEqual(expressions.map(e => `${e}.png`).sort());
      for (const expression of expressions) {
        const asset = npc.expressions[expression];
        expect(asset.src).toBe(`/assets/portraits/${npc.id}/${expression}.png`);
        expect(asset.alt).toContain(expression);
        const png = readFileSync(join(process.cwd(), "public", asset.src));
        expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([96, 96]);
      }
    }
  });
});
