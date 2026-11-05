import { expect, test } from "@playwright/test";

// E8.2: recruiter asks for a short add-on on a reused card; candidate answers the mini-scenario.

test("ask for a short add-on covers only the missing skills, candidate answers, recruiter sees evidence (E8.2)", async ({ page }) => {
  await page.goto("/demo/reset");
  await expect(page.getByTestId("demo-reset-done")).toBeVisible();
  // Maya reuses her card with the bank (wants resilience, communication, empathy).
  await page.evaluate(() => {
    const shares = JSON.parse(localStorage.getItem("tp:shares") ?? "[]");
    shares.push({ id: "sh_att_demo_maya_ch_demo_bank", attemptId: "att_demo_maya", challengeId: "ch_demo_bank", reused: true, createdAt: new Date().toISOString() });
    localStorage.setItem("tp:shares", JSON.stringify(shares));
  });

  await page.goto("/recruiter/card/att_demo_maya?challenge=ch_demo_bank");
  const box = page.getByTestId("addon");
  await expect(box).toContainText("Communication");
  await expect(box).toContainText("Empathy");
  await expect(box).not.toContainText("Resilience");
  await page.getByTestId("addon-request").click();
  await expect(page.getByTestId("addon-status")).toContainText("requested");

  await page.goto("/candidate");
  await page.getByTestId("addon-list").getByRole("link", { name: "Start the add-on" }).click();
  await expect(page.getByTestId("addon-run")).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(/^[45]:\d\d$/);
  await page.getByLabel(/two or three sentences/).fill("I would tell my manager the file is wrong and explain we will send a smaller report by 5 because the totals cannot be trusted yet.");
  await page.getByLabel(/sick teammate/).fill("I would message them that it is fine and they should rest, because they feel stressed about letting us down.");
  await page.getByTestId("addon-submit").click();
  await expect(page.getByTestId("addon-sent")).toBeVisible();

  await page.goto("/recruiter/card/att_demo_maya?challenge=ch_demo_bank");
  const done = page.getByTestId("addon-done");
  await expect(done).toContainText("no score");
  await expect(done).toContainText("totals cannot be trusted");
  await expect(done).not.toContainText(/\d+\s*\/\s*\d+|\d+%/);
});

test("no add-on offer when the reused card covers every skill, or the card is not reused (E8.2)", async ({ page }) => {
  await page.goto("/demo/reset");
  await expect(page.getByTestId("demo-reset-done")).toBeVisible();
  await page.goto("/recruiter/card/att_demo_maya?challenge=ch_demo_energy");
  await expect(page.getByTestId("review-actions")).toBeVisible();
  await expect(page.getByTestId("addon")).toHaveCount(0);
});
