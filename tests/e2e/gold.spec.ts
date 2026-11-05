import { expect, test } from "@playwright/test";

test("gold set: score by keyboard, resume where you left off, copy at the end (B.10)", async ({ page }) => {
  await page.goto("/admin/gold");
  await page.getByTestId("rater-div").click();
  await expect(page.getByTestId("gold-progress")).toHaveText("0 of 48 scored");
  await page.keyboard.press("1");
  await page.getByTestId("level-some").click();
  await expect(page.getByTestId("gold-progress")).toHaveText("2 of 48 scored");
  await page.reload();
  await page.getByTestId("rater-div").click();
  await expect(page.getByTestId("gold-progress")).toHaveText("2 of 48 scored");
  await expect(page.getByTestId("gold-item")).toContainText("Answer 3 of 48");
  for (let i = 0; i < 46; i++) await page.keyboard.press("3");
  await expect(page.getByTestId("gold-done")).toBeVisible();
  const json = JSON.parse(await page.getByTestId("gold-json").inputValue());
  expect(Object.keys(json)).toHaveLength(48);
  expect(json.g01).toBe("strong");
  expect(json.g02).toBe("some");
  // Haris's scores are separate and start empty.
  await page.reload();
  await page.getByTestId("rater-haris").click();
  await expect(page.getByTestId("gold-progress")).toHaveText("0 of 48 scored");
});
