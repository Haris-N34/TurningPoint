import { existsSync, readFileSync, statSync } from "node:fs";
import { expect, it } from "vitest";
import { getScenario } from "./index";

it("ships 15 illustrated scenes with small WebP variants and useful alt text (S.5)", () => {
  const manifest = JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as { key: string; alt: string }[];
  expect(manifest).toHaveLength(15);
  expect(new Set(manifest.map(a => a.key)).size).toBe(15);
  for (const art of manifest) {
    expect(art.alt.trim().length).toBeGreaterThan(20);
    for (const suffix of ["", ".small"]) {
      const file = `public/art/${art.key}${suffix}.webp`;
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file).subarray(8, 12).toString()).toBe("WEBP");
      expect(statSync(file).size).toBeLessThan(suffix ? 40_000 : 180_000);
    }
  }
  const launch = getScenario("launch-week")!;
  expect(launch.nodes.filter(n => n.art).length).toBeGreaterThanOrEqual(13);
  for (const n of launch.nodes) if (n.art) expect(manifest).toContainEqual(expect.objectContaining(n.art));
});
