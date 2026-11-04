import { expect, test } from "@playwright/test";

test("app boots with no console errors (M0.2)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Turning Point/);
  expect(errors).toEqual([]);
});
