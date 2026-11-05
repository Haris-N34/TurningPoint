import { expect, test } from "@playwright/test";
import { installFakeSpeech, setProfile } from "./helpers";
import { clearOverlay, finishRealLife, startMapGame, tp } from "./mapHelpers";

type St = { events: { kind: string }[] };
const handledCount = (page: Parameters<typeof tp>[0]) =>
  tp(page, (x) => (x.getState() as unknown as St).events.filter((e) => ["resolved", "delegated", "deferred"].includes(e.kind)).length);

// Judge note: a Quick first run showed "2 choices" on the card after what felt like 3 talks. Every problem the
// engine logged as handled (choice, delegation or deferral) must be a step in the card's decision path.
test("Quick run from a challenge link: the card's decision path has every handled problem", async ({ page }) => {
  test.setTimeout(240_000);
  await installFakeSpeech(page);
  await setProfile(page, { displayName: "Path Tester", email: "path.tester@ucalgary.ca", verified: true, university: "University of Calgary" });
  await page.goto("/demo/seed");
  await page.getByTestId("play-ch_demo_energy").click();
  await startMapGame(page);
  // Play every problem that comes up (recovery pick and its checkpoint included), waiting for the next one.
  for (let i = 0; i < 150; i++) {
    if (await page.getByTestId("to-results").isVisible()) break;
    if (await clearOverlay(page)) continue;
    const talk = page.locator('[data-testid^="list-talk-"]').first();
    if (await talk.isVisible()) {
      await talk.click();
      await expect(page.getByTestId("dialogue").or(page.getByTestId("checkpoint")).or(page.getByTestId("cutscene")).first()).toBeVisible({ timeout: 15_000 });
    } else await page.getByTestId("wait").first().click({ timeout: 3_000 }).catch(() => {}); // a checkpoint can pop mid-click
  }
  const handled = await handledCount(page);
  expect(handled).toBeGreaterThanOrEqual(5);
  await page.getByTestId("to-results").click();
  await page.getByTestId("results-continue").click();
  await finishRealLife(page);
  await expect(page).toHaveURL(/\/results\//, { timeout: 20_000 });
  await expect(page.getByTestId("decision-path").locator("li")).toHaveCount(handled);
  await expect(page.getByText(`${handled} choices`)).toBeVisible();
});

// Judge 13:55: a full-week run in list view with 3 talks and the order pick logged 2 steps. Talk to exactly
// three problems (answering the order question and any checkpoint), then let the week run out.
test("full week in list view: 3 talks plus the order pick give 3 decision-path steps and '3 choices'", async ({ page }) => {
  test.setTimeout(240_000);
  await installFakeSpeech(page);
  await setProfile(page, { displayName: "Path Tester", email: "path.tester@ucalgary.ca", verified: true, university: "University of Calgary" });
  await page.goto("/demo/seed");
  await page.getByTestId("play-ch_demo_energy").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("set-full-week").check();
  await page.getByTestId("set-turn-based").check();
  await page.getByTestId("set-list-view").check();
  await page.getByTestId("start").click();
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("list-view")).toBeVisible({ timeout: 20_000 });
  let talks = 0;
  let orderPicked = false;
  for (let i = 0; i < 200; i++) {
    if (await page.getByTestId("to-results").isVisible()) break;
    if (await page.getByTestId("order-pick").isVisible()) orderPicked = true;
    if (await clearOverlay(page)) continue;
    const talk = page.locator('[data-testid^="list-talk-"]').first();
    if (talks < 3 && (await talk.isVisible())) {
      await talk.click();
      talks++;
    } else await page.getByTestId("wait").first().click();
  }
  const handled = await handledCount(page);
  expect(orderPicked).toBe(true);
  expect(handled).toBe(3);
  await page.getByTestId("to-results").click();
  await page.getByTestId("results-continue").click();
  await finishRealLife(page);
  await expect(page).toHaveURL(/\/results\//, { timeout: 20_000 });
  await expect(page.getByTestId("decision-path").locator("li")).toHaveCount(3);
  await expect(page.getByText("3 choices")).toBeVisible();
});
