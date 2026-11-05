import { expect, test } from "@playwright/test";

// QA night, accessibility. List view (the screen-reader and keyboard-first way to play) is not kept across a
// refresh: after reload and Continue the game is back on the map and Settings shows List view unticked. The
// run itself is restored (turn-based stays on in the HUD), so only the player's view preference is lost.
test.fixme("game: list view survives a refresh mid-run (owner: agent A, components/game2 settings)", async ({ page }) => {
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("set-turn-based").check();
  await page.getByTestId("set-list-view").check();
  await page.getByTestId("start").click();
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await expect(page.getByTestId("list-view")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.getByTestId("resume").click();
  await expect(page.getByTestId("list-view")).toBeVisible({ timeout: 10_000 });
});
