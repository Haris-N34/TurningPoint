// Captures the four landing-page preview stills from a running app (best from a prod build:
// `pnpm build && pnpm start -p 3200`, then `BASE=http://localhost:3200 node scripts/landing-stills.mjs`).
// Writes 1280x720 PNGs to a temp folder; scripts/landing-stills.py converts them to small WebP in public/landing/.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const out = process.argv[2] ?? "/tmp/landing-stills";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await ctx.newPage();
await page.goto(`${BASE}/demo/seed`);
await page.getByTestId("seeded").waitFor();

// 1. The game title.
await page.goto(`${BASE}/game/launch-week?jump=turning-point`);
await page.getByTestId("game-shell").and(page.locator('[data-ready="1"]')).waitFor({ timeout: 60_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/1-title.png` });

// 2. The sponsor pulls out.
await page.keyboard.press("Enter");
await page.getByTestId("avatar-done").click();
await page.getByTestId("cutscene").waitFor({ timeout: 30_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/2-cutscene.png` });

// 3. The checkpoint quotes the choice.
await page.getByTestId("cutscene-next").click();
await page.getByTestId("cutscene-done").click();
await page.getByTestId("go-recovery-plan").click();
await page.getByTestId("dialogue").waitFor({ timeout: 15_000 });
for (let i = 0; i < 12 && !(await page.getByTestId("choice-b").isVisible()); i++) {
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
}
await page.waitForTimeout(400);
await page.getByTestId("choice-b").click();
await page.getByTestId("checkpoint").waitFor({ timeout: 15_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/3-checkpoint.png` });

// 4. The recruiter card with a quote played.
await page.goto(`${BASE}/recruiter/card/att_demo_maya?challenge=ch_demo_energy`);
await page.getByTestId("jump-prioritization").click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/4-card.png` });

await browser.close();
console.log(out);
