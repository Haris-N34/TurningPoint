import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("results controls and witness confirmation are accessible, with a copyable local demo link", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto("/results/att_demo_maya");
  await page.getByLabel("Witness name (optional, for this link)").fill("Jordan");
  await page.getByLabel("Witness email", { exact: true }).fill("jordan@example.org");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByTestId("witness-link")).toContainText("for Jordan");
  await expect(page.getByRole("status")).toContainText("No email was sent");
  const link = await page.getByTestId("witness-link").locator("a").getAttribute("href");
  await page.getByTestId("share-ch_demo_bank").click();
  await expect(page.getByRole("status")).toContainText("Card shared");
  await page.getByTestId("revoke-ch_demo_bank").click();
  await expect(page.getByRole("status")).toContainText("Share withdrawn");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const resultsAxe = await new AxeBuilder({page}).analyze();
  expect(resultsAxe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: `/private/tmp/tp-results-${test.info().project.name}.png`, fullPage: true });
  await page.goto(link!);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const skills = page.getByRole("checkbox");
  for (let i = 0; i < 3; i++) { await skills.nth(i).focus(); await skills.nth(i).press("Space"); }
  await expect(skills.nth(3)).toBeDisabled();
  const witnessAxe = await new AxeBuilder({page}).analyze();
  expect(witnessAxe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: `/private/tmp/tp-witness-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "I can't confirm this" }).click();
  await expect(page.getByTestId("witness-done")).toContainText("can't confirm");
});

test("AI explanation is linked globally and missing results have a recovery path", async ({ page }) => {
  await page.goto("/results/missing-card");
  await expect(page.getByRole("heading", { name: "Your card is not on this device" })).toBeVisible();
  await page.getByRole("link", { name: "How we use AI", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How we use AI.");
  await expect(page.getByText(/No automatic rejection/)).toBeVisible();
  const axe = await new AxeBuilder({page}).analyze();
  expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
});
