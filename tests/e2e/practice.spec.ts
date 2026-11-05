import { expect, test } from "@playwright/test";
import { installFakeSpeech, playToEnd } from "./helpers";

// C8.1 practice mode and C8.2 practice feedback.

test("a practice run plays like the real thing, shares nothing and shows private feedback (C8.1, C8.2)", async ({ page }) => {
  await installFakeSpeech(page);
  await page.goto("/practice");
  await expect(page.getByTestId("practice-banner")).toContainText("nothing is shared");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await expect(page.getByTestId("game")).toBeVisible();
  const answered = await playToEnd(page, "text");
  expect(answered).toBeGreaterThan(0);

  const stored = await page.evaluate(() => ({
    runs: Object.keys(localStorage).filter((k) => k.startsWith("tp:run:")).map((k) => JSON.parse(localStorage.getItem(k)!)),
    shares: JSON.parse(localStorage.getItem("tp:shares") ?? "[]"),
  }));
  expect(stored.runs).toHaveLength(1);
  expect(stored.runs[0].practice).toBe(true);
  expect(stored.shares).toEqual([]);

  await page.getByTestId("see-results").click();
  await expect(page.getByTestId("practice-results")).toBeVisible();
  await expect(page.getByTestId("practice-privacy")).toContainText("Nothing from this run was shared");
  // No employer card, no share controls, no levels.
  await expect(page.getByTestId("results")).toHaveCount(0);
  await expect(page.getByText(/share with/i)).toHaveCount(0);
  // C8.2: notes on clarity and specificity for every answer, never a score or level.
  const answers = page.locator('[data-testid^="practice-answer-"]');
  await expect(answers).toHaveCount(answered);
  await expect(page.locator('[data-testid^="clarity-"]')).toHaveCount(answered);
  await expect(page.locator('[data-testid^="specificity-"]')).toHaveCount(answered);
  const text = await page.getByTestId("practice-results").innerText();
  expect(text).not.toMatch(/\b(\d+\s*\/\s*\d+|\d+%|strong|some evidence|not observed|level|rating|grade)\b/i);

  await page.getByTestId("practice-delete").click();
  await expect(page).toHaveURL(/\/candidate$/);
  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:run:") || k.startsWith("tp:card:")));
  expect(left).toEqual([]);
});

test("practice data older than 24 hours is gone on the next page load (C8.1)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const started = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const fresh = new Date(Date.now() - 3600 * 1000).toISOString();
    const run = (id: string, at: string) => ({ attemptId: id, challengeId: "practice:sample", scenarioId: "sample", seed: id, state: {}, extra: {}, status: "finished", startedAt: at, updatedAt: at, practice: true });
    localStorage.setItem("tp:run:att_old", JSON.stringify(run("att_old", started)));
    localStorage.setItem("tp:run:att_new", JSON.stringify(run("att_new", fresh)));
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:run:")).sort()))
    .toEqual(["tp:run:att_new"]);
});
