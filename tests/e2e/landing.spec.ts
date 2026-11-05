import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing explains the promise and opens the demo (M0.10)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The plan breaks. Your capability shows.");
  await expect(page.getByRole("list", { name: "How Turning Point works" }).locator("li")).toHaveCount(3);
  await page.getByRole("link", { name: "Try the demo", exact: true }).click();
  await expect(page).toHaveURL(/\/candidate$/);
  await page.getByRole("link", { name: "Start the sample challenge" }).click();
  await expect(page).toHaveURL(/\/play\/sample$/);
  await expect(page.getByRole("button", { name: "I agree, start" })).toBeVisible();
});

test("employer CTA and all four persistent role routes work (M0.11)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "For employers", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  for (const role of ["candidate", "recruiter", "admin", "witness"]) {
    const picker = page.getByRole("combobox", { name: "Demo role" });
    await picker.selectOption(role);
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tp:role")!))).toBe(role);
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(role);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`landing is accessible in ${colorScheme} with keyboard navigation`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("landing and candidate pages link straight to the game", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("play-game").click();
  await expect(page).toHaveURL(/\/game\/launch-week$/);
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.goto("/candidate");
  await expect(page.getByTestId("play-game")).toHaveAttribute("href", "/game/launch-week");
  await expect(page.getByRole("link", { name: /Play the game: The Client Pivot/ })).toHaveAttribute("href", "/game/client-pivot");
});

test("landing preview: four captioned stills that loop, pause on request, and stay still under reduced motion", async ({ page }) => {
  await page.goto("/");
  const preview = page.getByTestId("hero-preview");
  await expect(preview).toContainText("See it in 10 seconds");
  for (const c of ["The plan breaks.", "You choose.", "We ask why.", "The recruiter sees evidence."]) await expect(preview).toContainText(c);
  const frame = page.getByTestId("hero-frame");
  await expect(frame).toHaveAttribute("alt", /title screen/);
  // It advances on its own...
  await expect(frame).not.toHaveAttribute("alt", /title screen/, { timeout: 6000 });
  // ...and stops when paused.
  await page.getByTestId("hero-pause").click();
  const alt = await frame.getAttribute("alt");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(3000);
  await expect(frame).toHaveAttribute("alt", alt!);
  // Steps are buttons, so anyone can move through it by hand.
  await preview.getByRole("button", { name: /The recruiter sees evidence/ }).click();
  await expect(frame).toHaveAttribute("alt", /Capability Card/);
});

test("landing preview does not move under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const frame = page.getByTestId("hero-frame");
  await expect(frame).toHaveAttribute("alt", /title screen/);
  await page.waitForTimeout(3500);
  await expect(frame).toHaveAttribute("alt", /title screen/);
});
