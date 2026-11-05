import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const colorScheme of ["light", "dark"] as const) {
  test(`design tokens and primitives work in ${colorScheme} (M0.9)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/design-system");
    await expect(page.getByRole("heading", { name: "A little structure. Room to adapt." })).toBeVisible();
    const colors = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return { background: s.getPropertyValue("--background").trim(), primary: s.getPropertyValue("--primary").trim() };
    });
    expect(colors.background).toBe(colorScheme === "light" ? "#faf8f4" : "#191815");
    expect(colors.primary).toBe(colorScheme === "light" ? "#a63e20" : "#ffad8f");
    await page.getByLabel("Challenge title").fill("Launch Week");
    await expect(page.getByLabel("Challenge title")).toHaveValue("Launch Week");
    await page.getByRole("button", { name: "Primary action" }).focus();
    await expect(page.getByRole("button", { name: "Primary action" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  });
}
