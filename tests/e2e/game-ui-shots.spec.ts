import { expect, test, type Page } from "@playwright/test";

// Game UI review shots at every demo screen size (night/game-ui). Run with SCREENS=1; skipped otherwise.
// SHOTS_DIR picks the output folder, e.g. SHOTS_DIR=docs/screens/night/game-ui/r1.
const SIZES = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "375x812", width: 375, height: 812 },
];

async function untilVisible(page: Page, id: string) {
  for (let i = 0; i < 12 && !(await page.getByTestId(id).isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
  }
}

for (const size of SIZES) {
  test(`game UI shots ${size.name}`, async ({ page }, info) => {
    test.skip(process.env.SCREENS !== "1", "set SCREENS=1 to take review shots");
    test.skip(info.project.name !== "desktop", "sizes are set per test");
    test.setTimeout(120_000);
    const dir = process.env.SHOTS_DIR ?? "docs/screens/night/game-ui/latest";
    await page.setViewportSize({ width: size.width, height: size.height });
    // The Next.js dev badge is not part of the game; keep it out of review shots.
    const shot = (n: string) => page.screenshot({ path: `${dir}/${n}-${size.name}.png`, style: "nextjs-portal { display: none !important; }" });

    await page.goto("/game/launch-week?jump=turning-point");
    await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
    await page.waitForTimeout(1200);
    await shot("01-title");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("avatar-creator")).toBeVisible();
    await page.waitForTimeout(600);
    await shot("02-avatar");
    await page.getByTestId("avatar-done").click();
    await expect(page.getByTestId("cutscene")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await shot("03-cutscene-ring");
    await expect(page.getByTestId("cutscene-next")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(300);
    await shot("04-cutscene-call");
    await page.getByTestId("cutscene-next").click();
    await page.waitForTimeout(2800);
    await shot("05-cutscene-drain");
    await page.getByTestId("cutscene-done").click();
    await page.waitForTimeout(1500);
    await shot("06-map");
    await page.getByTestId("go-recovery-plan").click();
    await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(300);
    await shot("07-dialogue");
    await untilVisible(page, "choice-b");
    await page.waitForTimeout(500);
    await shot("08-choices");
    await page.getByTestId("choice-b").click();
    await expect(page.getByTestId("checkpoint")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    await shot("09-checkpoint");
    const cp = page.getByTestId("checkpoint");
    await cp.locator('label:has(input[value="text"])').click();
    await cp.getByRole("button", { name: /start answering/i }).click();
    await cp.getByTestId("answer-text").pressSequentially("Saturday and Sunday keep the vendors whole. Promotion and the stage are nice to have.", { delay: 5 });
    await shot("09b-checkpoint-answer");
    await cp.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(300);
    await shot("09c-checkpoint-review");
  });
}

// No camera or microphone permission: the checkpoint must open calmly in text mode.
test("game UI shot: checkpoint without media permission", async ({ browser }, info) => {
  test.skip(process.env.SCREENS !== "1", "set SCREENS=1 to take review shots");
  test.skip(info.project.name !== "desktop", "one size is enough");
  test.setTimeout(120_000);
  const dir = process.env.SHOTS_DIR ?? "docs/screens/night/game-ui/latest";
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, permissions: [] });
  const page = await ctx.newPage();
  await page.goto("/game/launch-week?jump=turning-point");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await page.getByTestId("cutscene-next").click({ timeout: 20_000 });
  await page.getByTestId("cutscene-done").click();
  await page.getByTestId("go-recovery-plan").click();
  await untilVisible(page, "choice-b");
  await page.waitForTimeout(500);
  await page.getByTestId("choice-b").click();
  await expect(page.getByTestId("checkpoint")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("checkpoint").locator('input[value="text"]')).toBeChecked();
  await expect(page.getByTestId("checkpoint")).not.toContainText(/couldn't/i);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/10-checkpoint-no-media-1280x720.png`, style: "nextjs-portal { display: none !important; }" });
  await ctx.close();
});

// Pause menu, list view and the second map, at the smallest desktop and the phone.
for (const size of [SIZES[0], SIZES[4]]) {
  test(`game UI extras ${size.name}`, async ({ page }, info) => {
    test.skip(process.env.SCREENS !== "1", "set SCREENS=1 to take review shots");
    test.skip(info.project.name !== "desktop", "sizes are set per test");
    test.setTimeout(120_000);
    const dir = process.env.SHOTS_DIR ?? "docs/screens/night/game-ui/latest";
    await page.setViewportSize({ width: size.width, height: size.height });
    const shot = (n: string) => page.screenshot({ path: `${dir}/${n}-${size.name}.png`, style: "nextjs-portal { display: none !important; }" });
    await page.goto("/game/client-pivot");
    await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
    await page.waitForTimeout(1000);
    await shot("11-pivot-title");
    await page.getByTestId("start").click();
    await page.getByTestId("avatar-done").click();
    await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
    await page.waitForTimeout(1500);
    await shot("12-pivot-map");
    await page.getByTestId("pause").click();
    await expect(page.getByTestId("pause-menu")).toBeVisible();
    await shot("13-pause");
    await page.getByTestId("pause-resume").click();
    await page.getByTestId("toggle-view").click();
    await page.waitForTimeout(800);
    await shot("14-list-view");
  });
}
