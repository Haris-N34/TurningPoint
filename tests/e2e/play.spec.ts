import { expect, test, type Page } from "@playwright/test";
import { answerCheckpoint, installFakeSpeech, nextStep, playToEnd } from "./helpers";

type SavedRun = { status: string; state: { log: { nodeId: string; optionId: string; decidedMs: number; at: string }[]; status: string } };

async function savedRuns(page: Page): Promise<SavedRun[]> {
  return page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("tp:run:")).map((k) => JSON.parse(localStorage.getItem(k)!)),
  );
}

test("plays the sample scenario start to end and logs every choice (M1)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installFakeSpeech(page);
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await expect(page.getByTestId("game")).toBeVisible();
  await playToEnd(page, "text");

  const runs = await savedRuns(page);
  expect(runs).toHaveLength(1);
  expect(runs[0].status).toBe("finished");
  const log = runs[0].state.log;
  expect(log.length).toBeGreaterThanOrEqual(4);
  for (const e of log) {
    expect(e.nodeId).toBeTruthy();
    expect(e.optionId).toBeTruthy();
    expect(e.decidedMs).toBeGreaterThan(0);
    expect(Date.parse(e.at)).not.toBeNaN();
  }
  expect(errors).toEqual([]);
});

test("shows the turning-point takeover and resumes after a refresh (C3.1, C2.4)", async ({ page }) => {
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  for (let i = 0; i < 20; i++) {
    const s = await nextStep(page);
    if (s === "checkpoint") await answerCheckpoint(page, "text");
    else if (await page.getByTestId("turning-point").isVisible()) break;
    else if (s === "choice") await page.locator('[data-testid^="option-"]').first().click();
    else await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(page.getByTestId("turning-point")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("turning-point")).toBeVisible();
  await expect(page.getByTestId("checkpoint")).toBeHidden();
  await page.getByRole("button", { name: "Face it" }).click();
  await expect(page.getByTestId("turning-point")).toBeHidden();

  await page.getByRole("button", { name: "Pause" }).click();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await page.getByRole("dialog", { name: "Paused" }).getByRole("button", { name: "Resume" }).click();
  await expect(page.locator('[data-testid^="option-"]').first()).toBeVisible();
});

test("an open checkpoint survives a refresh (C2.4)", async ({ page }) => {
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  const { playToCheckpoint } = await import("./helpers");
  await playToCheckpoint(page);
  const q = await page.getByTestId("checkpoint-question").getAttribute("aria-label");
  await page.reload();
  await expect(page.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", q!);
});

test("fits a 375 px phone without horizontal scroll (C2.5)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
