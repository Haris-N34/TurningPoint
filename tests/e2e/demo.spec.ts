import { expect, test } from "@playwright/test";

// P.2 demo shortcuts and reset.

const tpKeys = (page: import("@playwright/test").Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:")).sort());

test("Ctrl+Shift+D opens hidden demo shortcuts; reset clears everything and reseeds (P.2)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("demo-panel")).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.setItem("tp:run:att_junk", "{}");
    localStorage.setItem("tp:profile", JSON.stringify({ displayName: "Junk" }));
  });

  await page.keyboard.press("Control+Shift+D");
  const panel = page.getByTestId("demo-panel");
  await expect(panel).toBeVisible();
  await page.getByTestId("demo-reset").click();
  await expect(page.getByTestId("demo-msg")).toContainText("Reset done");

  const keys = await tpKeys(page);
  expect(keys).not.toContain("tp:run:att_junk");
  expect(keys).not.toContain("tp:profile");
  expect(keys).toContain("tp:card:att_demo_maya");

  // Jump to the recruiter card from the panel.
  await panel.getByRole("link", { name: "Recruiter card" }).click();
  await expect(page).toHaveURL(/\/recruiter\/card\/att_demo_maya/);
  await expect(page.getByTestId("demo-panel")).toHaveCount(0);

  // Switch role from the panel.
  await page.keyboard.press("Control+Shift+D");
  await page.getByTestId("demo-role-admin").click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(await page.evaluate(() => localStorage.getItem("tp:role"))).toBe('"admin"');
});

test("/demo/reset wipes local data and reloads the seed (P.2)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("tp:run:att_junk", "{}"));
  await page.goto("/demo/reset");
  await expect(page.getByTestId("demo-reset-done")).toBeVisible();
  const keys = await tpKeys(page);
  expect(keys).not.toContain("tp:run:att_junk");
  expect(keys).toContain("tp:card:att_demo_maya");
  await page.getByRole("link", { name: "Admin impact" }).click();
  await expect(page).toHaveURL(/\/admin\/impact$/);
});
