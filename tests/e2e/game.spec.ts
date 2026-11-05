import { expect, test, type Page } from "@playwright/test";
import { setProfile } from "./helpers";

// v2 game (PRD v2, Part A). Drives the canvas through window.__tp (NEXT_PUBLIC_TEST_HOOKS=1)
// and the DOM UI with the keyboard.

type TP = {
  getState: () => { t: number; ended: boolean; dialogue?: unknown; checkpointsDue: { kind: string }[]; issues: Record<string, { status: string }>; tp: { fired: boolean; disruptionId: string }; order: { asked: boolean } };
  openIssues: () => string[];
  setClock: (t: string) => void;
  act: (issue: string, action: string, arg?: string) => void;
  moveTo: (z: string) => void;
};
const tp = <T,>(page: Page, fn: (tp: TP) => T) => page.evaluate(`(${fn.toString()})(window.__tp)`) as Promise<T>;

async function startGame(page: Page, opts: { list?: boolean; turnBased?: boolean; reducedMotion?: boolean; full?: boolean } = {}) {
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await expect(page.getByTestId("title-screen")).toBeVisible();
  if (opts.list || opts.turnBased || opts.reducedMotion || opts.full) {
    await page.getByRole("button", { name: "Settings" }).click();
    // Quick mode (Mon to Wed) is the default; the five-day week is a setting.
    if (opts.full) await page.getByTestId("set-full-week").check();
    if (opts.reducedMotion) await page.getByTestId("set-reduced-motion").check();
    if (opts.turnBased) await page.getByTestId("set-turn-based").check();
    if (opts.list) await page.getByTestId("set-list-view").check();
  }
  await page.getByTestId("start").click();
  await expect(page.getByTestId("avatar-creator")).toBeVisible();
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
}

/** Skip and advance dialogue text with Enter until the A-D choices show. */
async function toChoices(page: Page) {
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId("choice-a").isVisible()) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await expect(page.getByTestId("choice-a")).toBeVisible();
}

/** Clear whatever overlay is up, with the keyboard where possible. Returns false when nothing was open. */
async function clearOverlay(page: Page): Promise<boolean> {
  for (const [id, key] of [["cutscene-next", "click"], ["cutscene-done", "click"], ["recap-next", "click"], ["pause-resume", "click"]] as const) {
    const b = page.getByTestId(id);
    if (await b.isVisible()) {
      await b.focus();
      await page.keyboard.press("Enter");
      void key;
      return true;
    }
  }
  // The cutscene rings for a moment before its buttons show.
  if (await page.getByTestId("cutscene").isVisible()) {
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
    const cp = page.getByTestId("checkpoint");
    await cp.locator('label:has(input[value="text"])').click();
    await cp.getByRole("button", { name: /start answering/i }).click();
    await cp.getByTestId("answer-text").fill("I picked this because the team needed it first, but it cost us time with the vendors.");
    await cp.getByRole("button", { name: "Done" }).click();
    await cp.getByRole("button", { name: "Submit" }).click();
    await expect(cp).toBeHidden({ timeout: 10_000 }).catch(() => {});
    return true;
  }
  if (await page.getByTestId("dialogue").isVisible()) {
    // Keyboard: Enter skips the typewriter and advances lines; then Enter picks the focused choice.
    await toChoices(page);
    await page.keyboard.press("ArrowRight");
    // Choices ignore Enter for a moment after appearing (anti-mash guard); retry on slow machines.
    for (let i = 0; i < 4 && (await page.getByTestId("dialogue").isVisible()); i++) {
      await page.waitForTimeout(400);
      if (await page.getByTestId("dialogue").isVisible()) await page.keyboard.press("Enter");
    }
    await expect(page.getByTestId("dialogue")).toBeHidden();
    return true;
  }
  if (await page.getByTestId("reaction").isVisible()) {
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

test("title screen, avatar creator and HUD look like a game (A0, A.4)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await expect(page.getByTestId("title-map")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toContainText("PRESS ENTER");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("avatar-creator")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Skin #4a2f22" }).click();
  await page.getByRole("button", { name: "curly" }).click();
  await page.getByTestId("avatar-name").fill("Sam");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-saw-loading", "1");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  for (const id of ["resources", "clock", "issue-tracker", "map-canvas"]) await expect(page.getByTestId(id).first()).toBeVisible();
  await expect(page.getByTestId("clock-time")).toHaveText(/^Mon 09:/);
  expect(errors).toEqual([]);
});

test("the clock drifts on the map and pauses in dialogue, pause menu and turn-based mode (A.11)", async ({ page }) => {
  await startGame(page);
  const t0 = await tp(page, (x) => x.getState().t);
  await page.waitForTimeout(2600);
  const t1 = await tp(page, (x) => x.getState().t);
  expect(t1).toBeGreaterThan(t0);
  await page.getByTestId("pause").click();
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  const p0 = await tp(page, (x) => x.getState().t);
  await page.waitForTimeout(2200);
  expect(await tp(page, (x) => x.getState().t)).toBe(p0);
  await page.getByTestId("pause-resume").click();
  await page.getByTestId("go-roles").click();
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
  const d0 = await tp(page, (x) => x.getState().t);
  await page.waitForTimeout(2200);
  expect(await tp(page, (x) => x.getState().t)).toBe(d0);
});

test("turn-based mode shows in the HUD and never drifts (A.12)", async ({ page }) => {
  await startGame(page, { turnBased: true });
  await expect(page.getByTestId("turn-based")).toBeVisible();
  const t0 = await tp(page, (x) => x.getState().t);
  await page.waitForTimeout(2500);
  expect(await tp(page, (x) => x.getState().t)).toBe(t0);
});

test("extra-time accommodation turns on turn-based mode automatically (A5)", async ({ page }) => {
  await setProfile(page, { accommodations: { timeMultiplier: 1.5 } });
  await startGame(page);
  await expect(page.getByTestId("turn-based")).toBeVisible();
});

test("talking: portrait, typewriter, A-D choices by keyboard, reaction and juice (A.5, A.6, A.10)", async ({ page }) => {
  await startGame(page, { turnBased: true });
  await page.getByTestId("go-roles").click();
  const box = page.getByTestId("dialogue");
  await expect(box).toBeVisible({ timeout: 15_000 });
  await expect(box.locator("img[data-expression]")).toBeVisible();
  await toChoices(page); // Enter skips the typewriter and advances lines
  await page.waitForTimeout(400);
  await expect(page.getByTestId("choice-a")).toContainText("A");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("choice-b")).toBeFocused();
  await page.keyboard.press("Enter");
  // The reaction popup lasts 1.5 s; on a loaded machine it can close between polls, so check the marker it leaves.
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-last-reaction", /:happy$/);
  await expect(page.getByTestId("floater").first()).toBeVisible();
  expect(await tp(page, (x) => x.getState().issues.roles.status)).toBe("resolved");
});

test("delegate and defer from the issue tracker (A.13)", async ({ page }) => {
  await startGame(page, { turnBased: true });
  await page.getByTestId("delegate-roles").click();
  await page.getByTestId("delegate-to-priya").click();
  await expect.poll(() => tp(page, (x) => x.getState().issues.roles.status)).toBe("delegated");
  while (await clearOverlay(page)); // a seeded checkpoint may follow the delegation
  await page.getByTestId("wait").click(); // vendor mix spawns at 10:00
  while (await clearOverlay(page));
  await page.getByTestId("defer-vendor-mix").click();
  await page.getByTestId("defer-reason").first().click();
  await expect.poll(() => tp(page, (x) => x.getState().issues["vendor-mix"].status)).toBe("deferred");
});

test("choice-triggered video checkpoint quotes the option picked (A.7)", async ({ page }) => {
  // Full week: Quick mode keeps its one decision checkpoint for the recovery pick.
  await startGame(page, { turnBased: true, full: true });
  await page.getByTestId("go-roles").click();
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
  await toChoices(page);
  await page.waitForTimeout(400);
  await page.getByTestId("choice-c").click();
  await expect(page.getByTestId("checkpoint")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", "You chose C, to take logistics myself so the team stays happy. Walk us through why.");
});

test("turning point plays as a cutscene, drains the budget and spawns issues (A.15)", async ({ page }) => {
  // Quick mode (the default): the plan breaks Tuesday morning.
  await startGame(page, { turnBased: true });
  await tp(page, (x) => x.setClock("Tue 09:00"));
  for (let i = 0; i < 12 && !(await page.getByTestId("cutscene").isVisible()); i++) {
    await clearOverlay(page);
    await tp(page, (x) => x.setClock("Tue 09:00"));
    if (!(await tp(page, (x) => x.getState().tp.fired))) await page.getByTestId("wait").click();
  }
  await expect(page.getByTestId("cutscene")).toBeVisible();
  await page.getByTestId("cutscene-next").click();
  await expect(page.getByTestId("budget-drain")).toBeVisible();
  await page.getByTestId("cutscene-done").click();
  // Each disruption spawns its own recovery issue.
  const recovery = { "sponsor-pulls-out": "recovery-plan", "venue-cancels": "recovery-venue", "lead-volunteer-quits": "recovery-cover" } as Record<string, string>;
  const fired = await tp(page, (x) => x.getState().tp.disruptionId);
  expect(await tp(page, (x) => x.getState().issues)).toHaveProperty([recovery[fired], "status"], "open");
});

test("evening recap shows the day's numbers (A.14)", async ({ page }) => {
  // Full week: Quick mode shows a short "Monday done" note instead of the recap.
  await startGame(page, { turnBased: true, full: true });
  for (let i = 0; i < 10 && !(await page.getByTestId("recap").isVisible()); i++) {
    if (!(await clearOverlay(page))) await page.getByTestId("wait").click();
  }
  await expect(page.getByTestId("recap")).toContainText("Monday is done");
  await expect(page.getByTestId("recap")).toContainText("Budget");
});

test("list view: a full week with the keyboard, then results and real-life (A.10, A.21)", async ({ page }) => {
  test.setTimeout(180_000);
  await startGame(page, { list: true, turnBased: true });
  await expect(page.getByTestId("list-view")).toBeVisible();
  for (let i = 0; i < 160; i++) {
    if (await page.getByTestId("to-results").isVisible()) break;
    if (await clearOverlay(page)) continue;
    const talk = page.locator('[data-testid^="list-talk-"]').first();
    if (await talk.isVisible()) {
      await talk.focus();
      await page.keyboard.press("Enter");
    } else {
      await page.getByTestId("wait").first().focus();
      await page.keyboard.press("Enter");
    }
  }
  await page.getByTestId("to-results").click();
  await expect(page.getByTestId("results-screen")).toBeVisible();
  await expect(page.getByTestId("kpi-critical-handled")).toBeVisible();
  await expect(page.getByTestId("kpi-feedback-response")).toBeVisible();
  await page.getByTestId("results-continue").click();
  await expect(page.getByTestId("real-life-intro")).toBeVisible();
});

test("phone: map view with the tracker at the bottom (A.21)", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone layout");
  await startGame(page, { turnBased: true });
  await expect(page.getByTestId("map-canvas")).toBeVisible();
  await expect(page.getByTestId("issue-tracker").last()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// A.3: screenshots of every game screen into docs/screens. Run with SCREENS=1 (skipped in CI).
test("screenshots: title, map, dialogue, checkpoint, cutscene, results (A.3)", async ({ page }, info) => {
  test.skip(process.env.SCREENS !== "1", "set SCREENS=1 to refresh docs/screens");
  test.setTimeout(300_000);
  const shot = (name: string) => page.screenshot({ path: `docs/screens/game-${name}-${info.project.name}.png` });
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/game/launch-week?week=full");
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.waitForTimeout(1500);
  await shot("title");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("set-turn-based").check();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("avatar-creator")).toBeVisible();
  await shot("avatar");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await shot("map");
  await page.getByTestId("go-roles").click();
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
  await toChoices(page);
  await page.waitForTimeout(400);
  await shot("dialogue");
  await page.getByTestId("choice-c").click();
  await expect(page.getByTestId("checkpoint")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await shot("checkpoint");
  await clearOverlay(page);
  for (let i = 0; i < 40 && !(await page.getByTestId("cutscene").isVisible()); i++) {
    if (!(await clearOverlay(page))) await page.getByTestId("wait").first().click({ timeout: 3000 }).catch(() => {});
  }
  await expect(page.getByTestId("cutscene")).toBeVisible();
  await page.waitForTimeout(800);
  await shot("cutscene");
  for (let i = 0; i < 200 && !(await page.getByTestId("to-results").isVisible()); i++) {
    if (!(await clearOverlay(page))) await page.getByTestId("wait").first().click({ timeout: 3000 }).catch(() => {});
  }
  await page.getByTestId("to-results").click();
  await expect(page.getByTestId("results-screen")).toBeVisible();
  await page.waitForTimeout(2500);
  await shot("results");
  expect(errors).toEqual([]);
});

type SceneProbe = { px: number; py: number; camX: number; camY: number; wvX: number; wvY: number; zoom: number; scale: number; tilemap: boolean; fps: number };
const probe = (page: Page) =>
  page.evaluate(`(() => {
    const s = window.__phaser.scene.scenes[0];
    const cam = s.cameras.main;
    return { px: s.player.x, py: s.player.y, camX: cam.scrollX, camY: cam.scrollY, wvX: cam.worldView.x, wvY: cam.worldView.y, zoom: cam.zoom, scale: s.scale.width, tilemap: s.cache.tilemap.entries.size > 0, fps: window.__phaser.loop.actualFps };
  })()`) as Promise<SceneProbe>;

test("map from Tiled JSON; walk with keys and click or tap; camera follows (A.9)", async ({ page }, info) => {
  await startGame(page, { turnBased: true });
  await expect.poll(() => page.evaluate("!!window.__phaser?.scene?.scenes?.[0]?.player")).toBe(true);
  const a = await probe(page);
  expect(a.tilemap).toBe(true);
  // Keys: hold an arrow, the player moves and the camera follows.
  await page.locator("body").focus();
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowLeft");
  const b = await probe(page);
  expect(b.px).toBeLessThan(a.px - 4);
  await expect.poll(async () => (await probe(page)).camX).toBeLessThan(a.camX);
  // Click (desktop) or tap (phone) on the map: the player walks there.
  // Try a few spots around the player (some tiles are buildings or water).
  let moved = 0;
  for (const [dx, dy] of [[0, 3], [3, 0], [0, -3], [-3, 0], [2, 2], [-2, -2]]) {
    const c0 = await probe(page);
    const box = (await page.getByTestId("map-canvas").boundingBox())!;
    const k = (box.width / c0.scale) * c0.zoom; // world px -> CSS px
    const x = box.x + (c0.px + dx * 16 - c0.wvX) * k, y = box.y + (c0.py + dy * 16 - c0.wvY) * k;
    if (info.project.name === "phone") await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await page.waitForTimeout(1200);
    const c1 = await probe(page);
    moved = Math.hypot(c1.px - c0.px, c1.py - c0.py);
    if (moved > 4) break;
  }
  expect(moved).toBeGreaterThan(4);
});

test("quiz test: choices only ever show with a character, a scene and an animation (A.1, A.2)", async ({ page }) => {
  await startGame(page, { turnBased: true });
  await page.getByTestId("go-roles").click();
  const box = page.getByTestId("dialogue");
  await expect(box).toBeVisible({ timeout: 15_000 });
  await toChoices(page);
  // Character: a portrait with an expression. Scene: the map canvas behind it. Animation: the scene keeps rendering.
  await expect(box.locator("[data-expression], [role=img]").first()).toBeVisible();
  await expect(page.getByTestId("map-canvas")).toBeVisible();
  const f1 = await page.evaluate("window.__phaser.loop.frame");
  await page.waitForTimeout(500);
  expect(await page.evaluate("window.__phaser.loop.frame")).toBeGreaterThan(f1 as number);
  // In-world: the dialogue opened by walking to the person (the player now stands next to Priya).
  const near = await page.evaluate(`(() => { const s = window.__phaser.scene.scenes[0]; const n = s.npcs.get("priya").sprite; return Math.hypot(n.x - s.player.x, n.y - s.player.y); })()`);
  expect(near as number).toBeLessThan(40);
});

test("Quick mode is the default: Mon to Wed, the plan breaks Tuesday; Full week in Settings switches to five days", async ({ page }) => {
  await startGame(page, { turnBased: true });
  expect(await tp(page, (x) => (x.getState() as unknown as { length: string }).length)).toBe("quick");
  await tp(page, (x) => x.setClock("Tue 09:00"));
  expect(await tp(page, (x) => x.getState().tp.fired)).toBe(true);
  // No order question and no recap modal in Quick mode.
  expect(await tp(page, (x) => x.getState().order.asked)).toBe(false);
  await expect(page.getByTestId("cutscene")).toBeVisible();
  while (await clearOverlay(page));
  await expect(page.getByTestId("recap")).toHaveCount(0);
  await startGame(page, { full: true });
  expect(await tp(page, (x) => (x.getState() as unknown as { length: string }).length)).toBe("full");
});

test("map view: a full week through the issue tracker, then results (A.21)", async ({ page }) => {
  // Reduced motion skips the walk animation (walking itself is covered by the A.9 test), so a full week fits CI.
  test.setTimeout(420_000);
  await startGame(page, { turnBased: true, reducedMotion: true, full: true });
  await expect(page.getByTestId("map-canvas")).toBeVisible();
  expect(await tp(page, (x) => (x.getState() as unknown as { length: string }).length)).toBe("full");
  for (let i = 0; i < 200; i++) {
    if (await page.getByTestId("to-results").isVisible()) break;
    if (await clearOverlay(page)) continue;
    const go = page.locator('[data-testid^="go-"]').first();
    if (await go.isVisible()) {
      // A cutscene or recap can open between checks; don't wait on a covered button.
      if (!(await go.click({ timeout: 3000 }).then(() => true, () => false))) continue;
      await expect(page.getByTestId("dialogue").or(page.getByTestId("checkpoint"))).toBeVisible({ timeout: 15_000 }).catch(() => {});
    } else await page.getByTestId("wait").first().click({ timeout: 3000 }).catch(() => {});
  }
  await page.getByTestId("to-results").click();
  await expect(page.getByTestId("results-screen")).toBeVisible();
  expect(await tp(page, (x) => x.getState().ended)).toBe(true);
});
