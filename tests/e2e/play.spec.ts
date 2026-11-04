import { expect, test, type Page } from "@playwright/test";

type SavedRun = { status: string; state: { log: { nodeId: string; optionId: string; decidedMs: number; at: string }[]; status: string } };

async function savedRuns(page: Page): Promise<SavedRun[]> {
  return page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("tp:run:")).map((k) => JSON.parse(localStorage.getItem(k)!)),
  );
}

/** Play to the end with the keyboard only: Enter on the focused control each step (C2.6). */
async function playToEnd(page: Page) {
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId("end").isVisible()) return;
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
    // Move once with the arrow key so we exercise roving focus on choices.
    if (await page.locator('[data-testid^="option-"]').first().isVisible()) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
  }
  throw new Error("did not reach the end");
}

test("plays the sample scenario start to end and logs every choice (M1)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("game")).toBeVisible();
  await playToEnd(page);

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
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("option-a").click();
  await page.getByTestId("option-a").click();
  await expect(page.getByTestId("turning-point")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("turning-point")).toBeVisible();
  await page.getByRole("button", { name: "Face it" }).click();
  await expect(page.getByTestId("turning-point")).toBeHidden();

  await page.getByRole("button", { name: "Pause" }).click();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await page.getByRole("dialog", { name: "Paused" }).getByRole("button", { name: "Resume" }).click();
  await expect(page.locator('[data-testid^="option-"]').first()).toBeVisible();
});

test("fits a 375 px phone without horizontal scroll (C2.5)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
