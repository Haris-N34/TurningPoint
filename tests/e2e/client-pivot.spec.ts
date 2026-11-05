import { expect, test, type Page } from "@playwright/test";

// The Client Pivot (PRD v2 A12, criterion A.8): the second map scenario, played keyboard-only in list view.

const tp = <T,>(page: Page, fn: (tp: { getState: () => { discoveries: string[]; ended: boolean } }) => T) =>
  page.evaluate(`(${fn.toString()})(window.__tp)`) as Promise<T>;

async function press(page: Page, testId: string) {
  await page.getByTestId(testId).first().focus();
  await page.keyboard.press("Enter");
}

/** Clear whatever overlay is up, with the keyboard. Returns false when nothing was open. */
async function clearOverlay(page: Page): Promise<boolean> {
  for (const id of ["cutscene-next", "cutscene-done", "recap-next", "pause-resume"]) {
    if (await page.getByTestId(id).isVisible()) {
      await press(page, id);
      return true;
    }
  }
  if (await page.getByTestId("order-pick").isVisible()) {
    const ranks = page.locator('[data-testid^="rank-"]:not([data-testid="rank-done"])');
    for (let i = 0; i < Math.min(2, await ranks.count()); i++) {
      await ranks.nth(i).focus();
      await page.keyboard.press("Enter");
    }
    await press(page, "rank-done");
    return true;
  }
  if (await page.getByTestId("checkpoint").isVisible()) {
    const cp = page.getByTestId("checkpoint");
    await cp.locator('input[value="text"]').focus();
    await page.keyboard.press("Space");
    await cp.getByRole("button", { name: /start answering/i }).focus();
    await page.keyboard.press("Enter");
    await cp.getByTestId("answer-text").focus();
    await page.keyboard.type("I picked this because the client needed an answer first, and it cost me time with the team.");
    await cp.getByRole("button", { name: "Done" }).focus();
    await page.keyboard.press("Enter");
    await cp.getByRole("button", { name: "Submit" }).focus();
    await page.keyboard.press("Enter");
    await expect(cp).toBeHidden({ timeout: 10_000 }).catch(() => {});
    return true;
  }
  if (await page.getByTestId("dialogue").isVisible()) {
    for (let i = 0; i < 10 && !(await page.getByTestId("choice-a").isVisible()); i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(400);
    await page.keyboard.press("Enter"); // first choice is focused
    await expect(page.getByTestId("dialogue")).toBeHidden();
    return true;
  }
  if (await page.getByTestId("reaction").isVisible()) {
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

test("The Client Pivot: a full week keyboard-only in list view, with discoveries, to the results (A.8)", async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/game/client-pivot");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("set-turn-based").focus();
  await page.keyboard.press("Space");
  await page.getByTestId("set-list-view").focus();
  await page.keyboard.press("Space");
  const speed = page.getByTestId("settings").getByLabel("Text speed");
  await speed.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await expect(speed).toHaveValue("instant");
  await press(page, "start");
  await expect(page.getByTestId("avatar-creator")).toBeVisible();
  await press(page, "avatar-done");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await expect(page.getByTestId("list-view")).toBeVisible();
  await expect(page.getByTestId("list-view")).toContainText("Client Site");

  // Explore the three hidden discoveries first (cafe, client site, whiteboard room).
  for (const id of ["cafe-chat", "store-employee", "dusty-report"]) {
    while (await clearOverlay(page));
    await press(page, `list-explore-${id}`);
    while (await clearOverlay(page));
  }
  expect((await tp(page, (x) => x.getState().discoveries)).sort()).toEqual(["cafe-chat", "dusty-report", "store-employee"]);

  for (let i = 0; i < 200; i++) {
    if (await page.getByTestId("to-results").isVisible()) break;
    if (await clearOverlay(page)) continue;
    const talk = page.locator('[data-testid^="list-talk-"]').first();
    if (await talk.isVisible()) {
      await talk.focus();
      await page.keyboard.press("Enter");
    } else await press(page, "wait");
  }
  await press(page, "to-results");
  await expect(page.getByTestId("results-screen")).toBeVisible();
  await expect(page.getByTestId("kpi-discoveries")).toContainText("3 of 3");
  await expect(page.getByTestId("kpi-data-insight")).toBeVisible();
  await expect(page.getByTestId("kpi-feedback-response")).toBeVisible();
  expect(errors).toEqual([]);
});
