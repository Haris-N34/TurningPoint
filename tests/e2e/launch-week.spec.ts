import { expect, test } from "@playwright/test";
import { playToEnd } from "./helpers";

test("Launch Week plays all 15 nodes, saves ten decisions and completes real-life evidence (S.3)", async ({ page }) => {
  await page.goto("/play/launch-week");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await expect(page.getByTestId("game")).toContainText("Launch Week");
  const answered = await playToEnd(page, "text");
  expect(answered).toBeGreaterThanOrEqual(4);
  const run = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith("tp:run:"))!;
    return JSON.parse(localStorage.getItem(key)!);
  });
  expect(run.status).toBe("finished");
  expect(run.state.path).toEqual(Array.from({ length: 15 }, (_, i) => `n${i + 1}`));
  expect(run.state.log).toHaveLength(10);
  expect(run.state.turningPointNodeId).toBe("n8");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByTestId("see-results").click();
  await expect(page.getByTestId("results")).toBeVisible();
});
