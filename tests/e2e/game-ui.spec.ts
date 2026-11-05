import { expect, test } from "@playwright/test";

// Game UI rules (night/game-ui): the demo path works with the keyboard alone and reduced motion,
// the cutscene is the only thing on screen while it plays, and panels step aside while talking.
test("keyboard-only demo path with reduced motion: cutscene alone on screen, tracker steps aside in dialogue", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "stage demo runs on a laptop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/game/launch-week?jump=turning-point");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("avatar-creator")).toBeVisible();
  await expect(page.getByTestId("avatar-done")).toBeFocused();
  await page.keyboard.press("Enter");

  // Cutscene: no HUD, no tracker, no toasts behind the letterbox.
  await expect(page.getByTestId("cutscene-next")).toBeFocused({ timeout: 20_000 });
  await expect(page.getByTestId("hud")).toHaveCount(0);
  await expect(page.getByTestId("issue-tracker")).toHaveCount(0);
  await expect(page.getByTestId("toast")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cutscene-done")).toBeFocused();
  await page.keyboard.press("Enter");

  // Back on the map: the HUD returns and the held news shows as one line.
  await expect(page.getByTestId("hud")).toBeVisible();
  await expect(page.getByTestId("toast")).toHaveCount(1);
  await expect(page.getByTestId("toast")).toContainText(/new issues/i);

  // Tab to the recovery plan's Go button.
  const go = page.getByTestId("go-recovery-plan");
  for (let i = 0; i < 40 && !(await go.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(go).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("issue-tracker")).toHaveCount(0);
  for (let i = 0; i < 12 && !(await page.getByTestId("choice-b").isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(450);
  await page.keyboard.press("b");

  // The checkpoint shows the whole question at once (reduced motion) and is answerable in text.
  const cp = page.getByTestId("checkpoint");
  await expect(cp).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", /Walk us through why\.$/);
  await expect(page.getByTestId("checkpoint-question")).toContainText("Walk us through why.");
  await expect(cp.locator('label:has(input[value="text"])')).toBeVisible();
});

test("every game panel fits the viewport with no clipped text at 1280x720 and on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sizes are set here");
  for (const vp of [{ width: 1280, height: 720 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(vp);
    await page.goto("/game/launch-week?jump=turning-point");
    await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
    await page.keyboard.press("Enter");
    await page.getByTestId("avatar-done").click();
    await page.getByTestId("cutscene-next").click({ timeout: 20_000 });
    await page.getByTestId("cutscene-done").click();
    await expect(page.getByTestId("issue-tracker")).toBeVisible();
    // Nothing on the play screen sticks out of the viewport, and the tracker list does not need to scroll on desktop.
    const out = await page.evaluate(() => {
      const bad: string[] = [];
      for (const id of ["hud", "issue-tracker", "resources", "clock"]) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(id);
      }
      return bad;
    });
    expect(out).toEqual([]);
    if (vp.width >= 640) {
      const scrolls = await page.locator('[data-testid="issue-tracker"] ul').evaluate((ul) => ul.scrollHeight > ul.clientHeight + 1);
      expect(scrolls).toBe(false);
    }
  }
});
