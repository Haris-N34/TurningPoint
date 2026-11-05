import { expect, test } from "@playwright/test";

// When localStorage is full (lib/store emits tp:storage-full), one calm notice explains it and links to reset.
test("storage full: a site-wide notice with a reset link, dismissible", async ({ page }) => {
  await page.goto("/candidate");
  await expect(page.getByTestId("storage-full")).toHaveCount(0);
  const banner = page.getByTestId("storage-full");
  // Fire once the page is hydrated and listening (a write fails only after the app is running).
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new Event("tp:storage-full")));
    await expect(banner).toBeVisible({ timeout: 500 });
  }).toPass();
  await expect(banner).toContainText("Storage is full, so this session won't be saved.");
  await expect(banner.getByRole("link", { name: "Reset demo data" })).toHaveAttribute("href", "/demo/reset");
  await banner.getByRole("button", { name: "Dismiss storage notice" }).click();
  await expect(banner).toHaveCount(0);
});
