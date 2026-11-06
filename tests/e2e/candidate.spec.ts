import { expect, test } from "@playwright/test";

const profile = (page: import("@playwright/test").Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("tp:profile") ?? "{}"));

test("mocked school sign-in sets verified=true and names no real school (C1.5)", async ({ page }) => {
  await page.goto("/candidate/verify?next=/play/sample");
  await expect(page.locator("main")).not.toContainText(/University|Calgary|Mount Royal|SAIT|Bow Valley/);
  await page.getByRole("button", { name: /Sign in with your school account/ }).click();
  await expect(page.getByTestId("mock-sso")).toBeVisible();
  await page.getByLabel("Full name").fill("Maya Chen");
  await page.getByLabel("Campus username").fill("maya.chen");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("verified")).toBeVisible();
  const p = await profile(page);
  expect(p).toMatchObject({ verified: true, university: "", email: "maya.chen@school.edu" });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/play\/sample$/);
});

test("starting records consent; the improvement opt-in stays off unless ticked (PV2)", async ({ page }) => {
  await page.goto("/play/sample");
  await expect(page.getByTestId("consent")).toContainText("never scored");
  await expect(page.getByTestId("improve-opt-in")).not.toBeChecked();
  await page.getByRole("button", { name: "I agree, start" }).click();
  expect(await profile(page)).toMatchObject({ consentedToRecording: true, improvementOptIn: false });
});

test("candidate home: one primary action, your own card listed, synthetic inbox peers never shown as yours", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto("/candidate");
  await expect(page.getByTestId("play-game")).toBeVisible();
  const yours = page.getByTestId("your-cards");
  await expect(yours.getByRole("link")).toHaveCount(1);
  await expect(yours.getByRole("link")).toHaveAttribute("href", "/results/att_demo_maya");
});
