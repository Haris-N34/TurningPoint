import { expect, test } from "@playwright/test";

// QA night. docs/pitch/demo-60s.md, "If something goes wrong": "Cutscene already gone: press Ctrl+Shift+D,
// click Turning point, then start again." From inside the game the jump is a client-side Link to the same
// route, so the game never remounts: it stays on the map and the title screen never comes back.
test("demo panel: Turning point jump from inside the game goes back to the title and replays the cutscene", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "stage demo runs on a laptop");
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto("/game/launch-week?jump=turning-point");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("cutscene")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("cutscene-next").click();
  await page.getByTestId("cutscene-done").click();
  await expect(page.getByTestId("cutscene")).toBeHidden();

  await page.keyboard.press("Control+Shift+D");
  await page.getByTestId("demo-panel").getByRole("link", { name: "Turning point", exact: true }).click();
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 10_000 });
  // A full reload: wait for the game to be ready again, as at the start.
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("cutscene")).toBeVisible({ timeout: 20_000 });
});
