import { expect, test } from "@playwright/test";

// E7.1 to E7.4: the 200-candidate synthetic cohort feeds the inbox and the fairness analytics.
test("synthetic cohort feeds funnel, mode and timing rates, opt-in four-fifths check, and the inbox", async ({ page }) => {
  await page.goto("/recruiter");
  await page.getByRole("button", { name: "Load 200 fictional candidates" }).click();
  await page.goto("/recruiter?challenge=ch_impact_energy");
  await expect(page.getByTestId("inbox")).toBeVisible();
  await expect(page.getByTestId("row-att_impact_demo_004")).toBeVisible();
  await expect(page.getByTestId("inbox")).not.toContainText(/opt-in group/i);

  await page.goto("/admin/impact");
  await page.getByLabel("Data source").selectOption("demo");
  await expect(page.getByTestId("impact-started")).toHaveText("200");
  const funnel = page.getByTestId("funnel-by-challenge");
  await expect(funnel.getByTestId("funnel-ch_impact_energy")).toContainText("Prairie Grid Energy (fictional)");
  await expect(funnel.getByTestId("funnel-ch_impact_energy").locator("td").first()).toHaveText("67");
  await expect(funnel.locator("tbody tr")).toHaveCount(3);

  const mode = page.locator("section", { has: page.getByRole("heading", { name: "Fair access / Answer mode" }) });
  await expect(mode.getByRole("row", { name: /video/ })).toContainText("Review: below four-fifths");
  const timing = page.locator("section", { has: page.getByRole("heading", { name: "Fair access / Timing" }) });
  await expect(timing.getByRole("row", { name: /Adjusted timing/ })).toBeVisible();
  const groups = page.locator("section", { has: page.getByRole("heading", { name: "Fair access / Opt-in groups" }) });
  await expect(groups.getByRole("row", { name: /Opt-in group C/ })).toContainText("Review: below four-fifths");
  await expect(groups.getByRole("row", { name: /Opt-in group B/ })).not.toContainText("four-fifths");

  // Demographics never reach an individual card.
  await page.goto("/recruiter/card/att_impact_demo_004?challenge=ch_impact_energy");
  await expect(page.getByTestId("capability-card")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/opt-in group/i);
});
