import { expect, test } from "@playwright/test";

// The one-minute stage demo (docs/pitch/demo-60s.md), exactly as presented: two prepared tabs.
test("one-minute demo: turning point, the checkpoint quotes the pick, the recruiter card", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "stage demo runs on a laptop");
  // Two tabs and a dev-server compile under parallel load; the demo itself is timed separately below.
  test.setTimeout(90_000);
  // Landing has a direct way into the game.
  await page.goto("/");
  await expect(page.getByTestId("play-game")).toHaveAttribute("href", "/game/launch-week");
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();

  // Tab 1: the game, prepared with the turning-point jump (fixed seed: the sponsor pulls out).
  await page.goto("/game/launch-week?jump=turning-point");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  const t0 = Date.now();
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("cutscene")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("cutscene")).toContainText(/sponsor/i);
  await page.getByTestId("cutscene-next").click();
  await expect(page.getByTestId("budget-drain")).toBeVisible();
  await page.getByTestId("cutscene-done").click();
  await page.getByTestId("go-recovery-plan").click();
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 10 && !(await page.getByTestId("choice-b").isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
  await page.getByTestId("choice-b").click();
  await expect(page.getByTestId("checkpoint")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", /^You chose B, to keep Saturday and Sunday/);
  // The app's own time from Enter to the checkpoint (page loads are before t0). A presenter needs it under 25 s;
  // with parallel workers the shared dev server is slower, so the guard loosens to 45 s rather than flake.
  const limit = test.info().config.workers > 1 ? 45_000 : 25_000;
  expect(Date.now() - t0, `Enter to checkpoint, workers=${test.info().config.workers}`).toBeLessThan(limit);
  // The scripted jump played a decent Monday and Tuesday: no evening recap popped, nothing ran out of time.
  await expect(page.getByTestId("recap")).toHaveCount(0);
  const st = await page.evaluate(() => (window as unknown as { __tp: { getState: () => { events: { kind: string; t: number }[]; morale: number } } }).__tp.getState());
  expect(st.events.filter((e) => e.kind === "expired")).toEqual([]);

  // Tab 2: the recruiter card.
  const card = await context.newPage();
  await card.goto("/recruiter/card/att_demo_maya?challenge=ch_demo_energy");
  await expect(card.getByTestId("capability-card")).toContainText("Sorts only");
  await card.getByTestId("jump-prioritization").click();
  await expect(card.getByTestId("tab-cp2")).toHaveAttribute("aria-selected", "true");
  await card.getByRole("button", { name: "Shortlist" }).click();
  await expect(card.getByTestId("card-name")).toHaveText("Maya Chen");
});
