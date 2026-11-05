import { expect, test, type Page } from "@playwright/test";

// QA night, keyboard only. Pause dialogs are aria-modal, but Tab walks out of them into the page
// behind (skip link, header, issue tracker), and Escape does not close them.

async function tabStaysInDialog(page: Page) {
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"][aria-modal="true"]'));
    expect(inside, `Tab #${i + 1} left the modal dialog`).toBe(true);
  }
}

test.fixme("play: Tab stays inside the Paused dialog and Escape resumes (owner: agent A, components/game/Game.tsx)", async ({ page }) => {
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  const dialog = page.getByRole("dialog", { name: "Paused" });
  await expect(dialog).toBeVisible();
  await tabStaysInDialog(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test.fixme("game: Tab stays inside the pause menu (owner: agent A, components/game2)", async ({ page }) => {
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await page.getByTestId("pause").click();
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible();
  await tabStaysInDialog(page);
});

test.fixme("game: Tab stays inside the checkpoint dialog (owner: agent C, components/checkpoint/Checkpoint.tsx)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "same path as the stage demo");
  await page.goto("/demo/seed");
  await page.goto("/game/launch-week?jump=turning-point");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("cutscene")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("cutscene-next").click();
  await page.getByTestId("cutscene-done").click();
  await page.getByTestId("go-recovery-plan").click();
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 10 && !(await page.getByTestId("choice-b").isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
  await page.getByTestId("choice-b").click();
  await expect(page.getByTestId("checkpoint")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("checkpoint").click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[data-testid="checkpoint"]'));
    expect(inside, `Tab #${i + 1} left the checkpoint`).toBe(true);
  }
});
