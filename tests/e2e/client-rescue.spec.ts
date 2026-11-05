import { expect, test } from "@playwright/test";
import { playToEnd } from "./helpers";

test("Client Rescue completes the consulting story with saved decisions and real-life evidence (S.4)", async ({ page }) => {
  await page.goto("/play/client-rescue");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await expect(page.getByTestId("game")).toContainText("Client Rescue");
  expect(await playToEnd(page, "text")).toBeGreaterThanOrEqual(4);
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
