import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("compare two or three shared candidates without exposing anonymous names or hidden recordings", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem("tp:card:att_demo_maya")!);
    const shares = JSON.parse(localStorage.getItem("tp:shares")!);
    for (let i = 2; i <= 4; i++) {
      const card = structuredClone(base);
      card.attemptId = `att_compare_${i}`; card.anonId = `Candidate ${i}`; card.candidate.displayName = `Private name ${i}`;
      card.checkpoints = card.checkpoints.map((c: object) => ({ ...c, hidden: true, media: "private-recording" }));
      localStorage.setItem(`tp:card:${card.attemptId}`, JSON.stringify(card));
      shares.push({ id: `sh_compare_${i}`, attemptId: card.attemptId, challengeId: "ch_demo_energy", reused: false, createdAt: base.finishedAt });
    }
    localStorage.setItem("tp:shares", JSON.stringify(shares));
  });
  await page.goto("/recruiter?challenge=ch_demo_energy");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const compare = page.getByRole("button", { name: /Compare selected/ });
  await expect(compare).toBeDisabled();
  await page.getByLabel("Compare Candidate 2", { exact: true }).check();
  await expect(compare).toBeDisabled();
  await page.getByLabel("Compare Candidate 3", { exact: true }).check();
  await expect(compare).toBeEnabled();
  await page.getByLabel("Compare Candidate 4", { exact: true }).check();
  await expect(page.getByLabel("Compare Candidate 4F7K", { exact: true })).toBeDisabled();
  await compare.click();
  await expect(page.getByTestId("compare-card")).toHaveCount(3);
  await expect(page.getByTestId("compare")).not.toContainText("Private name");
  await expect(page.locator("video, audio")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Decision checkpoints", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const axe = await new AxeBuilder({page}).analyze();
  expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("tp-compare.png"), fullPage: true });
  await page.goto("/recruiter/compare?challenge=ch_demo_energy&ids=att_compare_2,att_compare_3");
  await expect(page.getByTestId("compare-card")).toHaveCount(2);
  await page.evaluate(() => {
    const shares = JSON.parse(localStorage.getItem("tp:shares")!);
    localStorage.setItem("tp:shares", JSON.stringify(shares.map((s: {attemptId: string}) => s.attemptId === "att_compare_2" ? {...s, revokedAt: new Date().toISOString()} : s)));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose two or three shared cards" })).toBeVisible();
  await expect(page.getByText("Private name", {exact: false})).toHaveCount(0);
});
