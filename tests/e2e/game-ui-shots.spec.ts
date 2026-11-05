import { expect, test, type Page } from "@playwright/test";

// Game UI review shots at every demo screen size (night/game-ui). Run with SCREENS=1; skipped otherwise.
// SHOTS_DIR picks the output folder, e.g. SHOTS_DIR=docs/screens/night/game-ui/r1.
const SIZES = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "375x812", width: 375, height: 812 },
  { name: "812x375", width: 812, height: 375 },
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
    await page.waitForTimeout(450);
    await shot("08b-after-pick");
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

// Camera refused (agent E's flow): one calm line, Voice takes over, Text is one tap away, and the think timer waits.
test("game UI shot: checkpoint with the camera refused", async ({ page }, info) => {
  test.skip(process.env.SCREENS !== "1", "set SCREENS=1 to take review shots");
  test.skip(info.project.name !== "desktop", "one size is enough");
  test.setTimeout(120_000);
  const dir = process.env.SHOTS_DIR ?? "docs/screens/night/game-ui/latest";
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = (c?: MediaStreamConstraints) => (c?.video ? Promise.reject(new DOMException("denied", "NotAllowedError")) : real(c));
  });
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
  const cp = page.getByTestId("checkpoint");
  await expect(cp).toBeVisible({ timeout: 10_000 });
  await expect(cp).toHaveAttribute("data-mode", "voice", { timeout: 15_000 });
  const note = cp.getByTestId("device-note");
  await expect(note).toContainText("didn't allow the camera");
  await expect(note).toContainText("The timer waits for you.");
  await expect(cp.locator('label:has(input[value="text"])')).toBeVisible();
  // Timer held: the think label does not move while they choose.
  const before = await cp.getByTestId("timer-label").textContent();
  await page.waitForTimeout(1500);
  expect(await cp.getByTestId("timer-label").textContent()).toBe(before);
  await page.screenshot({ path: `${dir}/10-checkpoint-camera-refused-1280x720.png`, style: "nextjs-portal { display: none !important; }" });
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

// The second map's turning point (different caller and disruption).
for (const size of [SIZES[0], SIZES[4]]) {
  test(`game UI pivot cutscene ${size.name}`, async ({ page }, info) => {
    test.skip(process.env.SCREENS !== "1", "set SCREENS=1 to take review shots");
    test.skip(info.project.name !== "desktop", "sizes are set per test");
    test.setTimeout(120_000);
    const dir = process.env.SHOTS_DIR ?? "docs/screens/night/game-ui/latest";
    await page.setViewportSize({ width: size.width, height: size.height });
    const shot = (n: string) => page.screenshot({ path: `${dir}/${n}-${size.name}.png`, style: "nextjs-portal { display: none !important; }" });
    await page.goto("/game/client-pivot?jump=turning-point");
    await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
    await page.keyboard.press("Enter");
    await page.getByTestId("avatar-done").click();
    await expect(page.getByTestId("cutscene-next")).toBeVisible({ timeout: 20_000 });
    await shot("15-pivot-cutscene");
    await page.getByTestId("cutscene-next").click();
    await page.getByTestId("cutscene-done").click();
    await page.waitForTimeout(800);
    // The order question may follow the turning point on this map; shoot whichever screen is up.
    if (await page.getByTestId("order-pick").isVisible()) {
      await page.locator('[data-testid^="rank-"]:not([data-testid="rank-done"])').nth(1).click();
      await shot("16-pivot-order");
    } else await shot("16-pivot-map");
  });
}
