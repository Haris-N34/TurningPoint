import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const id = (n: number) => `att_impact_demo_${String(n).padStart(3, "0")}`;

// E4.1: pick 2 or 3 cards in the inbox and see them side by side, evidence first, no score, no ranking.
test("compare view: pick 2 or 3 cards, evidence and answers side by side in the order picked", async ({ page }) => {
  await page.goto("/recruiter");
  await page.getByRole("button", { name: "Load 200 fictional candidates" }).click();
  await page.goto("/recruiter?challenge=ch_impact_energy");
  const open = page.getByTestId("compare-open");
  await expect(open).toBeDisabled();
  await page.getByTestId(`pick-${id(10)}`).check();
  await expect(open).toBeDisabled();
  await page.getByTestId(`pick-${id(4)}`).check();
  await expect(open).toBeEnabled();
  await page.getByTestId(`pick-${id(7)}`).check();
  await expect(open).toHaveText(/Compare \(3\)/);
  await expect(page.getByTestId(`pick-${id(13)}`)).toBeDisabled();
  await open.click();

  await expect(page).toHaveURL(/\/recruiter\/compare\?challenge=ch_impact_energy&ids=/);
  const compare = page.getByTestId("compare");
  const cols = compare.locator('[data-testid^="compare-col-"]');
  await expect(cols).toHaveCount(3);
  expect(await cols.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))).toEqual([id(10), id(4), id(7)].map((x) => `compare-col-${x}`));
  await expect(cols.first()).toContainText("Candidate D010");
  await expect(compare).toContainText("no overall score and no ranking");
  await expect(compare).not.toContainText(/score\s*[:=]?\s*\d|rank(ed)?\s*#?\d/i);
  await expect(compare.getByTestId("compare-skill-collaboration")).toBeVisible();
  await expect(compare.getByTestId("compare-row-decision-0")).toContainText("transcript");
  await expect(compare.getByTestId("compare-row-real_life-0")).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
});

test("compare view refuses fewer than 2 cards", async ({ page }) => {
  await page.goto("/recruiter");
  await page.getByRole("button", { name: "Load 200 fictional candidates" }).click();
  await page.goto(`/recruiter/compare?challenge=ch_impact_energy&ids=${id(4)}`);
  await expect(page.getByTestId("compare-error")).toContainText("Pick 2 or 3");
});
