import { expect, test } from "@playwright/test";

// QA night finding (night/qa tests/qa/demo-jump.spec.ts), fixed: game jumps in the demo panel do a full navigation.
// docs/pitch/demo-60s.md recovery step: Ctrl+Shift+D, Turning point, start again. A client-side Link to the
// same route never remounted the game.
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
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("cutscene")).toBeVisible({ timeout: 20_000 });
});
