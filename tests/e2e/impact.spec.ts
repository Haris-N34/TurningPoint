import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("impact report separates synthetic data, filters employers and shows measurement limits", async ({ page }) => {
  await page.goto("/admin/impact");
  await expect(page.getByTestId("impact-started")).toHaveText("0");
  await expect(page.getByText("Recruiter minutes per candidate", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load 200 fictional candidates" }).click();
  await expect(page.getByTestId("impact-started")).toHaveText("200");
  await expect(page.getByTestId("impact-finished")).toHaveText("160");
  await expect(page.getByRole("status")).toContainText("Fictional cohort loaded");
  await expect(page.getByText("Review: below four-fifths").first()).toBeVisible();
  await page.getByLabel("Employer challenge").selectOption("ch_impact_energy");
  await expect(page.getByTestId("impact-started")).toHaveText("67");
  await page.getByLabel("Employer challenge").selectOption("");
  await page.getByLabel("Data source").selectOption("live");
  await expect(page.getByTestId("impact-started")).toHaveText("0");
  await page.getByLabel("Data source").selectOption("demo");
  await page.reload();
  // Refresh defaults to local activity; fictional data never silently becomes live data.
  await expect(page.getByTestId("impact-started")).toHaveText("0");
  await page.getByLabel("Data source").selectOption("demo");
  await expect(page.getByTestId("impact-started")).toHaveText("200");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const axe = await new AxeBuilder({page}).analyze();
  expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("tp-impact.png"), fullPage: true });
});
