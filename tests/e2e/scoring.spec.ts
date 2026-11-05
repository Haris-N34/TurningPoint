import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SCORING_CONFIG } from "../../lib/scoring/config";

const MAYA = "att_demo_maya";

test("how scores work shows the live config and version (D.3)", async ({ page }) => {
  await page.goto("/how-scores-work");
  await expect(page.getByTestId("how-scores-work")).toContainText(SCORING_CONFIG.version);
  await expect(page.getByTestId("max-resume-weight")).toHaveText("40%");
  await expect(page.getByTestId("game-weight")).toHaveText("75%");
  await expect(page.getByTestId("strong-points")).toHaveText(String(SCORING_CONFIG.levelPoints.strong));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
});

test("Final score box sits top right with its breakdown on focus; evidence leads (D.4)", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto(`/recruiter/card/${MAYA}?challenge=ch_demo_energy`);
  const box = page.getByTestId("final-score");
  await expect(box).toBeVisible();
  await expect(page.getByTestId("final-score-value")).toHaveText(/^\d{1,3}\/100$/);
  const breakdown = page.getByTestId("final-score-breakdown");
  await expect(breakdown).toBeHidden();
  await box.getByRole("button").focus();
  await expect(breakdown).toBeVisible();
  await expect(breakdown).toContainText(SCORING_CONFIG.version);
  await expect(breakdown).toContainText("Game only");

  // The evidence section comes first in reading order; the score box is on the right.
  const ev = await page.getByTestId("evidence").boundingBox();
  const b = await box.boundingBox();
  expect(b!.x).toBeGreaterThan(ev!.x);
});
