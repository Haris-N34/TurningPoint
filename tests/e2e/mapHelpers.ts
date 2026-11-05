import { expect, type Page } from "@playwright/test";

// Helpers for playing a v2 map game from a challenge link quickly: list view, turn-based mode,
// and the window.__tp test hooks (NEXT_PUBLIC_TEST_HOOKS=1).

type TP = { getState: () => { ended: boolean }; setClock: (t: string) => void };
export const tp = <T,>(page: Page, fn: (tp: TP) => T) => page.evaluate(`(${fn.toString()})(window.__tp)`) as Promise<T>;

/** From the title screen: list view and turn-based mode on, then start the week. */
export async function startMapGame(page: Page) {
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("set-turn-based").check();
  await page.getByTestId("set-list-view").check();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("avatar-creator")).toBeVisible();
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await expect(page.getByTestId("list-view")).toBeVisible();
}

/** Skip the typewriter and advance lines until the A-D choices show. */
export async function toChoices(page: Page) {
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId("choice-a").isVisible()) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await expect(page.getByTestId("choice-a")).toBeVisible();
}

/** Answer a checkpoint in text mode. */
async function answerText(page: Page) {
  const cp = page.getByTestId("checkpoint");
  await cp.locator('label:has(input[value="text"])').click();
  await cp.getByRole("button", { name: /start answering/i }).click();
  await cp.getByTestId("answer-text").fill("I picked this because the team needed it first, but it cost us time with the suppliers.");
  await cp.getByRole("button", { name: "Done" }).click();
  await cp.getByRole("button", { name: "Submit" }).click();
}

/** Clear whatever overlay is up. Returns false when nothing was open. */
export async function clearOverlay(page: Page): Promise<boolean> {
  for (const id of ["cutscene-next", "cutscene-done", "recap-next", "pause-resume"]) {
    const b = page.getByTestId(id);
    if (await b.isVisible()) {
      await b.click();
      return true;
    }
  }
  // The cutscene rings for a moment before its buttons show.
  if ((await page.getByTestId("cutscene").isVisible()) || (await page.getByTestId("recap").isVisible())) {
    await page.waitForTimeout(400);
    return true;
  }
  if (await page.getByTestId("order-pick").isVisible()) {
    const ranks = page.locator('[data-testid^="rank-"]:not([data-testid="rank-done"])');
    for (let i = 0; i < Math.min(2, await ranks.count()); i++) await ranks.nth(i).click();
    await page.getByTestId("rank-done").click();
    return true;
  }
  if (await page.getByTestId("checkpoint").isVisible()) {
    const q = await page.getByTestId("checkpoint-question").getAttribute("aria-label");
    await answerText(page);
    await expect
      .poll(async () => !(await page.getByTestId("checkpoint").isVisible()) || (await page.getByTestId("checkpoint-question").getAttribute("aria-label").catch(() => q)) !== q, { timeout: 10_000 })
      .toBe(true);
    return true;
  }
  if (await page.getByTestId("dialogue").isVisible()) {
    await toChoices(page);
    await page.waitForTimeout(400); // choices ignore input for a moment after appearing
    await page.getByTestId("choice-a").click();
    await expect(page.getByTestId("dialogue")).toBeHidden();
    return true;
  }
  if (await page.getByTestId("reaction").isVisible()) {
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

/** Play a few issues for real (answering checkpoints in text), then fast-forward the clock to the end of the week. */
export async function playMapWeek(page: Page, talks = 3) {
  let talked = 0;
  for (let i = 0; i < 120; i++) {
    if (await clearOverlay(page)) continue;
    if (await page.getByTestId("to-results").isVisible()) break;
    const talk = page.locator('[data-testid^="list-talk-"]').first();
    if (talked < talks && (await talk.isVisible())) {
      await talk.click();
      talked++;
      await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
    } else await tp(page, (x) => x.setClock("Sat 09:00"));
  }
  await page.getByTestId("to-results").click();
  await expect(page.getByTestId("results-screen")).toBeVisible();
  await page.getByTestId("results-continue").click();
  await expect(page.getByTestId("real-life-intro")).toBeVisible();
}

/** The real-life step after the week: one text answer, any follow-up, and a title. */
export async function finishRealLife(page: Page, title = "The summer our garden lost its funding") {
  await page.getByTestId("real-life-intro").getByRole("button", { name: "Start" }).click();
  for (let i = 0; i < 6; i++) {
    const cp = page.getByTestId("checkpoint");
    const name = page.getByTestId("story-title");
    await expect(cp.or(name).first()).toBeVisible();
    if (await name.isVisible()) {
      await name.fill(title);
      await page.getByRole("button", { name: "Finish" }).click();
      return;
    }
    const q = await page.getByTestId("checkpoint-question").getAttribute("aria-label");
    await answerText(page);
    await expect
      .poll(async () => (await name.isVisible()) || (await page.getByTestId("checkpoint-question").getAttribute("aria-label", { timeout: 300 }).catch(() => q)) !== q)
      .toBe(true);
  }
  throw new Error("real-life step did not finish");
}
