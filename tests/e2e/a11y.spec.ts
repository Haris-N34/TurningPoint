import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installFakeSpeech, playToCheckpoint } from "./helpers";

// A1 to A5, PV5, P.1: every route has zero serious/critical axe findings, links "How we use AI",
// and fits the viewport (desktop project 1440 px, phone project 375 px) with no horizontal scroll.

const MAYA = "att_demo_maya";

async function seed(page: Page) {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
}

async function witnessLink(page: Page) {
  await page.goto(`/results/${MAYA}`);
  await page.getByLabel("Witness email", { exact: true }).fill("jordan@example.org");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const href = await page.getByTestId("witness-link").locator("a").getAttribute("href");
  return href!;
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations
    .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

// Compare with the device viewport, not innerWidth: mobile browsers widen the layout viewport to fit wide content.
async function noHorizontalScroll(page: Page) {
  const width = page.viewportSize()!.width;
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  return scroll <= width ? true : `${scroll} > ${width}`;
}

async function check(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  expect.soft(await axe(page), `${label} axe`).toEqual([]);
  await expect.soft(page.getByRole("link", { name: "How we use AI" }).first(), `${label} AI link`).toBeAttached();
  expect.soft(await noHorizontalScroll(page), `${label} horizontal scroll`).toBe(true);
}

const STATIC = [
  "/",
  "/candidate",
  "/candidate/intro",
  "/candidate/verify",
  "/recruiter",
  `/recruiter/card/${MAYA}?challenge=ch_demo_energy`,
  `/results/${MAYA}`,
  "/admin",
  "/admin/new",
  "/admin/ai-health",
  "/admin/impact",
  "/witness",
  "/how-we-use-ai",
  "/results/missing-card",
  "/play/sample",
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });
    test(`every static route: axe, AI link, no horizontal scroll (A1-A5, PV5, P.1, ${colorScheme})`, async ({ page }) => {
      test.setTimeout(180_000);
      await seed(page);
      for (const path of STATIC) {
        await page.goto(path);
        await expect(page.locator("main, h1, [data-testid=game]").first()).toBeVisible();
        await check(page, path);
      }
    });
  });
}

test("witness page: axe, AI link, phone fit, confirm in under 30 s (C6.3, A5)", async ({ page }) => {
  await seed(page);
  const link = await witnessLink(page);
  const started = Date.now();
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await check(page, "witness token");
  const skills = page.getByRole("checkbox");
  for (let i = 0; i < 2; i++) { await skills.nth(i).focus(); await skills.nth(i).press("Space"); }
  await page.getByRole("button", { name: "Yes, this happened" }).click();
  await expect(page.getByTestId("witness-done")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(30_000);
  await check(page, "witness done");
});

test("checkpoint and challenge link: axe and AI link (A1-A5)", async ({ page }) => {
  await installFakeSpeech(page);
  await seed(page);
  await page.locator('[data-testid^="play-"]').first().click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await check(page, "challenge link");
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await check(page, "play");
  await playToCheckpoint(page);
  await check(page, "checkpoint");
  // A1: every checkpoint can be answered without a camera.
  await expect(page.getByTestId("checkpoint").locator('input[value="text"]')).toBeEnabled();
});

test("game title and play screens: axe and AI link (A1-A5, PV5)", async ({ page }) => {
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await check(page, "game title");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("avatar-creator")).toBeVisible();
  await check(page, "avatar");
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await check(page, "game play");
});

test("keyboard: skip link first, every tab stop shows a visible focus ring (A3)", async ({ page }) => {
  for (const path of ["/", "/how-we-use-ai", "/candidate/intro"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => {});
    // Pages that move focus to their heading on load (onboarding steps) skip the skip link on purpose.
    const pageMovedFocus = await page.evaluate(() => document.activeElement !== document.body);
    await page.keyboard.press("Tab");
    if (!pageMovedFocus) await expect(page.locator(":focus")).toHaveText("Skip to content");
    for (let i = 0; i < 12; i++) {
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return "end"; // dev overlay
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow && s.boxShadow !== "none";
        return outline || shadow ? "ok" : `${el.tagName} ${el.textContent?.slice(0, 30)}`;
      });
      if (ring === "end" && i > 0) break; // ran out of tab stops
      expect(ring, `${path} tab ${i}`).toBe("ok");
      await page.keyboard.press("Tab");
    }
  }
});

test("reduced motion: animations and transitions are switched off (A3)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const longest = await page.evaluate(() => {
    let max = 0;
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const s = getComputedStyle(el);
      for (const d of [...s.animationDuration.split(","), ...s.transitionDuration.split(",")]) max = Math.max(max, parseFloat(d) || 0);
    }
    return max;
  });
  expect(longest).toBeLessThanOrEqual(0.01);
});

test("reduced motion: the game turns on its reduced-motion setting from the OS preference (A3)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("Reduced motion")).toBeChecked();
});

test("low bandwidth: the setting moves a video default to voice (A4)", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("tp:profile")) localStorage.setItem("tp:profile", JSON.stringify({ defaultMode: "video" }));
  });
  await page.goto("/candidate/intro");
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Low bandwidth").check();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tp:profile")!));
  expect(saved.accommodations.lowBandwidth).toBe(true);
  expect(saved.defaultMode).toBe("voice");
});

test("low bandwidth: text mode works, no video autoplays, art loads lazily (A4)", async ({ page }) => {
  await installFakeSpeech(page);
  await seed(page);
  await page.goto(`/recruiter/card/${MAYA}?challenge=ch_demo_energy`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const autoplay = await page.evaluate(() => Array.from(document.querySelectorAll("video")).filter((v) => v.autoplay || !v.paused).length);
  expect(autoplay).toBe(0);
  // Every video on the card has a text transcript next to it (captions alternative).
  const videos = await page.locator("video").count();
  expect(await page.getByLabel("Transcript", { exact: true }).count()).toBeGreaterThanOrEqual(Math.max(1, videos));
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  const eager = await page.evaluate(() =>
    Array.from(document.images).filter((i) => i.loading !== "lazy" && !i.closest("[data-above-fold]") && i.getBoundingClientRect().top > innerHeight).length,
  );
  expect(eager).toBe(0);
});

test("branded favicon is linked and served (P.1)", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel~="icon"]').first().getAttribute("href");
  expect(href).toContain("icon.svg");
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("#a63e20");
});

test("toasts: exporting the shortlist confirms in a live region (P.1)", async ({ page }) => {
  await seed(page);
  await page.goto("/recruiter");
  await expect(page.getByTestId(`row-${MAYA}`)).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(page.getByTestId(`row-${MAYA}`)).toContainText("Shortlisted");
  await page.getByRole("button", { name: /Send shortlist to ATS/ }).click();
  const toast = page.getByTestId("toast");
  await expect(toast).toHaveAttribute("role", "status");
  await expect(toast).toContainText("Greenhouse");
  await toast.getByRole("button", { name: "Dismiss" }).click();
  await expect(toast).toBeHidden();
});

test("empty states explain what to do next (P.1)", async ({ page }) => {
  await page.goto("/recruiter");
  await expect(page.getByRole("heading", { name: "Your inbox is empty" })).toBeVisible();
  await check(page, "empty inbox");
  await page.goto("/admin");
  await expect(page.getByText("No challenges yet.")).toBeVisible();
  await check(page, "empty admin");
  await page.goto("/results/missing-card");
  await expect(page.getByRole("heading", { name: "Your card is not on this device" })).toBeVisible();
});
