import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// C6.1 up to 2 witnesses with relationship; C6.3 witness page with no account, on a phone, under 30 s.

const MAYA = "att_demo_maya";

async function addWitness(page: Page, email: string, relationship: string) {
  const form = page.getByTestId("witness-form");
  await form.getByLabel("Witness email", { exact: true }).fill(email);
  await form.getByLabel("Relationship").selectOption({ label: relationship });
  await form.getByRole("button", { name: "Add", exact: true }).click();
}

test("C6.1 candidate adds up to two witnesses, each listed with relationship and status", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto(`/results/${MAYA}`);
  const list = page.getByTestId("witness-list");
  const before = await list.getByRole("listitem").count();
  await expect(page.getByTestId("witness-slots")).toHaveText(`${before} of 2 witnesses added`);
  for (const [i, [email, rel]] of ([["jordan@example.org", "Supervisor"], ["sam@example.net", "Community partner"]] as const).entries()) {
    if (before + i >= 2) break;
    await addWitness(page, email, rel);
    await expect(list.getByRole("listitem").nth(before + i)).toContainText(rel);
    await expect(list.getByRole("listitem").nth(before + i)).toContainText("Waiting for reply");
  }
  await expect(page.getByTestId("witness-slots")).toHaveText("2 of 2 witnesses added");
  await expect(page.getByText("Both witness slots are in use.")).toBeVisible();
  await expect(page.getByTestId("witness-form").getByLabel("Witness email", { exact: true })).toHaveCount(0);
  // Emails never show to employers; the list shows relationship and status, not the address.
  await expect(list).not.toContainText("@");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("C6.3 witness page: names the relationship, counts skills, done state has a heading; bad links explain", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto(`/results/${MAYA}`);
  await addWitness(page, "lee@example.org", "Instructor");
  const link = await page.getByTestId("witness-link").locator("a").getAttribute("href");
  const started = Date.now();
  await page.goto(link!);
  await expect(page.getByTestId("witness")).toContainText("You were asked as their instructor");
  const skills = page.getByRole("group", { name: "Which skills did you see? (optional)", exact: true }).getByRole("checkbox");
  await skills.nth(0).focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("skill-count")).toHaveText("1 of 3 selected");
  await page.getByRole("button", { name: "Yes, this happened" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Thank you" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(30_000);
  await page.goto(link!);
  await expect(page.getByRole("heading", { level: 1, name: "This link has already been used" })).toBeVisible();
  await page.goto("/witness/not-a-token");
  await expect(page.getByRole("heading", { level: 1, name: "This link is not valid" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
});
