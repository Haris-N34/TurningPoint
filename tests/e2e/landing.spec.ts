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
