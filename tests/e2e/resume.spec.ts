import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const MAYA = "att_demo_maya";
const RESUME = `Maya Chen
maya.chen@example.com | (403) 555-0182
1204 Maple Street NW, Calgary, AB T2N 1N4

Education
Bachelor of Commerce, University of Calgary, Class of 2027

Experience
Volunteer Coordinator at Bow Valley Food Bank (May 2025 - Aug 2025)
- Led a team of 50 volunteers and kept every volunteer informed when funding was cut
- Negotiated donated supplies from a local store, saving $2,000`;

test("candidate adds a resume with consent; recruiter sees Resume vs Evidence, redacted (C.5, C.6, C.7)", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto(`/results/${MAYA}`);
  const intake = page.getByTestId("resume-intake");
  await intake.getByTestId("resume-text").fill(RESUME);
  await intake.getByTestId("resume-analyze").click();
  await expect(intake.getByRole("alert")).toContainText("consent");
  await intake.getByTestId("resume-consent").check();
  await intake.getByTestId("resume-analyze").click();
  await expect(intake.getByTestId("resume-added")).toContainText("2 claims");
  await expect(intake.getByTestId("resume-suggestion")).toContainText("You might talk about");

  await page.goto(`/recruiter/card/${MAYA}?challenge=ch_demo_energy`);
  const rve = page.getByTestId("resume-vs-evidence");
  await expect(rve).toBeVisible();
  await expect(rve).toContainText("Resume: basic capabilities");
  await expect(rve).toContainText("Game: evidence");
  await expect(page.getByTestId("claim-rc1")).toHaveAttribute("data-backed", "true");
  await expect(page.getByTestId("claim-rc1")).toContainText("Backed by game evidence");
  await expect(page.getByTestId("claim-rc2")).toContainText("Not yet shown");
  await expect(rve).not.toContainText(/Maya|Chen|Calgary|Bow Valley|example\.com|555|Maple|2027|false/i);
  await expect(page.getByTestId("capability-card")).not.toContainText("You might talk about");
  await page.getByTestId("final-score").getByRole("button").focus();
  await expect(page.getByTestId("final-score-breakdown")).toContainText("Resume 25%");

  const axe = await new AxeBuilder({ page }).include('[data-testid="resume-vs-evidence"]').analyze();
  expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
});
