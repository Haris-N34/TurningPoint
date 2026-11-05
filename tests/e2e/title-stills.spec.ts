import { expect, test } from "@playwright/test";

// Regenerates the title screen stills (public/assets/title/*.jpg) from the live attract map, which draws no zone signs.
// Run with STILLS=1 pnpm exec playwright test tests/e2e/title-stills.spec.ts --project=desktop. Skipped otherwise.
for (const map of ["launch-week", "client-pivot"]) {
  for (const v of [{ suffix: "", width: 1440, height: 900 }, { suffix: "-phone", width: 430, height: 900 }]) {
    test(`title still ${map}${v.suffix}`, async ({ page }, info) => {
      test.skip(process.env.STILLS !== "1", "set STILLS=1 to regenerate title stills");
      test.skip(info.project.name !== "desktop", "one run is enough");
      await page.setViewportSize({ width: v.width, height: v.height });
      await page.goto(`/game/${map}`);
      await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
      await page.getByTestId("start").click();
      await expect(page.getByTestId("avatar-creator")).toBeVisible();
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="avatar-creator"]') as HTMLElement | null;
        if (el) el.style.display = "none";
        const nx = document.querySelector("nextjs-portal") as HTMLElement | null;
        if (nx) nx.style.display = "none";
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `public/assets/title/${map}${v.suffix}.jpg`, type: "jpeg", quality: 80 });
    });
  }
}
