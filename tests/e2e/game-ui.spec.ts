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

test("every game panel fits the viewport with no clipped text at 1280x720 and on a phone (portrait and landscape)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sizes are set here");
  for (const vp of [{ width: 1280, height: 720 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
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
    if (vp.width >= 640 && vp.height >= 700) {
      const scrolls = await page.locator('[data-testid="issue-tracker"] ul').evaluate((ul) => ul.scrollHeight > ul.clientHeight + 1);
      expect(scrolls).toBe(false);
    }
  }
});

test("Escape opens and closes the pause menu once each, and focus stays inside it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard path");
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  // Toggling a setting must not throw focus back to the first control.
  await page.getByTestId("set-reduced-motion").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("set-reduced-motion")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pause-menu")).toBeHidden();
  await page.waitForTimeout(300);
  await expect(page.getByTestId("pause-menu")).toBeHidden();
});

test("first-time coach hint points at the first Go and goes away after the first action; never in the demo jump", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "same on phone; one run is enough");
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  // Quick mode (default): the title line names Tuesday.
  await expect(page.getByTestId("title-screen")).toContainText("On Tuesday, the plan breaks.");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await expect(page.getByTestId("coach")).toContainText("Press Go");
  await expect(page.locator('[data-coach="1"]')).toHaveCount(1);
  await page.getByTestId("wait").click();
  await expect(page.getByTestId("coach")).toHaveCount(0);

  await page.goto("/game/launch-week?jump=turning-point");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await page.getByTestId("cutscene-next").click({ timeout: 20_000 });
  await page.getByTestId("cutscene-done").click();
  await expect(page.getByTestId("issue-tracker")).toBeVisible();
  await expect(page.getByTestId("coach")).toHaveCount(0);
});

test("a full browser storage shows one calm in-game notice", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("tp:storage-full"));
    window.dispatchEvent(new Event("tp:storage-full"));
  });
  await expect(page.getByTestId("toast").filter({ hasText: "storage is full" })).toHaveCount(1);
});

test("QA #30: with a conversation pending under a checkpoint, typing a-d in the answer picks nothing and only one dialog shows", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  await page.goto("/game/launch-week?jump=turning-point");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await page.getByTestId("cutscene-next").click({ timeout: 20_000 });
  await page.getByTestId("cutscene-done").click();
  await page.getByTestId("go-recovery-plan").click();
  for (let i = 0; i < 12 && !(await page.getByTestId("choice-b").isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(450);
  await page.getByTestId("choice-b").click();
  const cp = page.getByTestId("checkpoint");
  await expect(cp).toBeVisible({ timeout: 10_000 });
  const count = `window.__tp.log().filter((a) => a.type === "choose").length`;
  const before = (await page.evaluate(count)) as number;
  // Force a conversation into the engine while the checkpoint is due (the race QA saw under load).
  const other = (await page.evaluate("window.__tp.openIssues()")) as string[];
  await page.evaluate(`window.__tp.act(${JSON.stringify(other[0])}, "talk")`);
  await expect(page.getByTestId("dialogue")).toHaveCount(0);
  // Answer in text; the pending conversation must not hear these keys.
  await cp.locator('label:has(input[value="text"])').click();
  await cp.getByRole("button", { name: /start answering/i }).click();
  await cp.getByTestId("answer-text").pressSequentially("abcd a b c d");
  await expect(cp.getByTestId("answer-text")).toHaveValue("abcd a b c d");
  expect(await page.evaluate(count)).toBe(before); // no option was picked by the typing
  await expect(page.getByTestId("dialogue")).toHaveCount(0);
});
