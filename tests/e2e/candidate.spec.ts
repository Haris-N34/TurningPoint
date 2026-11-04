import { expect, test } from "@playwright/test";

const profile = (page: import("@playwright/test").Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("tp:profile") ?? "{}"));

test("mocked university sign-in sets verified=true (C1.5)", async ({ page }) => {
  await page.goto("/candidate/verify?next=/play/sample");
  await page.getByRole("button", { name: /Sign in with University of Calgary/ }).click();
  await expect(page.getByTestId("mock-sso")).toBeVisible();
  await page.getByLabel("Full name").fill("Maya Chen");
  await page.getByLabel("Campus username").fill("maya.chen");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("verified")).toBeVisible();
  const p = await profile(page);
  expect(p).toMatchObject({ verified: true, university: "University of Calgary", email: "maya.chen@ucalgary.ca" });
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
