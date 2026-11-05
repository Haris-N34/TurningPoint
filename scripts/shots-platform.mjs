// Screenshots of every platform route (not the game) at the demo sizes.
// Usage: dev server on PORT (default 3100), then `node scripts/shots-platform.mjs [outDir] [filter]`.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = `http://localhost:${process.env.PORT ?? 3100}`;
const out = process.argv[2] ?? "docs/screens/night/platform";
const filter = process.argv[3];
mkdirSync(out, { recursive: true });

const routes = [
  ["landing", "/"],
  ["candidate", "/candidate"],
  ["results", "/results/att_demo_maya"],
  ["recruiter", "/recruiter"],
  ["card", "/recruiter/card/att_demo_maya?challenge=ch_demo_energy"],
  ["compare", "/recruiter/compare?challenge=ch_demo_energy"],
  ["admin", "/admin"],
  ["witness", "/witness"],
  ["how-we-use-ai", "/how-we-use-ai"],
  ["how-scores-work", "/how-scores-work"],
  ["practice", "/practice"],
  ["verify", "/verify"],
  ["impact", "/admin/impact"],
  ["builder", "/admin/new"],
  ["ai-health", "/admin/ai-health"],
  ["gold", "/admin/gold"],
  ["intro", "/candidate/intro"],
  ["developers", "/developers"],
  ["compare-3", "/recruiter/compare?challenge=ch_demo_energy&ids=att_demo_maya,att_demo_peer_01,att_demo_peer_02"],
];
const sizes = (process.env.SIZES ?? "1280x720,375x812").split(",").map(s => s.split("x").map(Number));
const dark = process.env.DARK === "1";

const browser = await chromium.launch();
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: dark ? "dark" : "light" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo/seed`);
  await page.getByTestId("seeded").waitFor({ timeout: 60_000 });
  for (const [name, path] of routes) {
    if (filter && !name.includes(filter)) continue;
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(600);
    const file = `${out}/${name}-${w}${dark ? "-dark" : ""}.png`;
    await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
    console.log(file);
  }
  await ctx.close();
}
await browser.close();
