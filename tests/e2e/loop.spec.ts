import { expect, test } from "@playwright/test";
import { installFakeSpeech, setProfile } from "./helpers";
import { finishRealLife, playMapWeek, startMapGame } from "./mapHelpers";

test("full loop: challenge link, play, witness confirms, share with a second employer, withdraw, delete (M4)", async ({ page, context }) => {
  test.setTimeout(120_000);
  await installFakeSpeech(page);
  await setProfile(page, { displayName: "Test Candidate", email: "test.candidate@ucalgary.ca", verified: true, university: "University of Calgary" });

  await page.goto("/demo/seed");
  await page.getByTestId("play-ch_demo_energy").click();
  await expect(page).toHaveURL(/\/c\/prairie-grid-energy/);
  // Launch Week challenges play the v2 map game, tailored for the employer's industry (E1.3).
  await expect(page.getByTestId("title-brief")).toContainText("Field Operations Analyst");
  await expect(page.getByTestId("title-brief")).toContainText(/community energy fair/i);
  await startMapGame(page);
  await playMapWeek(page);
  await finishRealLife(page);
  await expect(page).toHaveURL(/\/results\//, { timeout: 20_000 });
  await expect(page.getByTestId("results")).toContainText("Prairie Grid Energy");

  // Own email (alias) is rejected, a real witness gets a one-time link (C6.1, C6.5).
  const form = page.getByTestId("witness-form");
  await form.getByPlaceholder("their@email.com").fill("test.candidate+ref@ucalgary.ca");
  await form.getByRole("button", { name: "Add" }).click();
  await expect(form.getByRole("alert")).toContainText("someone else");
  await form.getByPlaceholder("their@email.com").fill("lead@gardenproject.org");
  await form.getByLabel("Relationship").selectOption("community_partner");
  await form.getByRole("button", { name: "Add" }).click();
  const link = await page.getByTestId("witness-link").locator("a").getAttribute("href");

  // Witness confirms in one tap (Flow C). Same browser storage in the demo.
  const w = await context.newPage();
  await w.goto(link!);
  await w.getByText("Resilience (failing forward)").click();
  await w.getByLabel("One sentence (optional)").fill("They kept every volunteer in the loop.");
  await w.getByRole("button", { name: "Yes, this happened" }).click();
  await expect(w.getByTestId("witness-done")).toBeVisible();
  await w.goto(link!);
  await expect(w.getByText("already been used")).toBeVisible();
  await w.close();

  await page.reload();
  await expect(page.getByTestId("witness-form")).toContainText("Confirmed by 1 community partner");
  await expect(page.getByTestId("results")).not.toContainText("gardenproject");

  // Share the same card with the second employer, no replay (C7.3), then withdraw it (C7.4).
  await page.getByTestId("share-ch_demo_bank").click();
  await expect(page.getByTestId("share")).toContainText("reused");
  const shares = await page.evaluate(() => JSON.parse(localStorage.getItem("tp:shares")!));
  expect(shares.find((x: { challengeId: string }) => x.challengeId === "ch_demo_bank")).toMatchObject({ reused: true });
  await page.getByTestId("revoke-ch_demo_bank").click();
  await expect(page.getByTestId("share")).toContainText("withdrawn");

  // Delete everything (C7.5). Employer challenges stay.
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("delete-all").click();
  await expect(page).toHaveURL(/\/$/);
  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:")));
  expect(left.some((k) => k.startsWith("tp:card:") || k.startsWith("tp:run:") || k === "tp:profile" || k === "tp:shares")).toBe(false);
  expect(left).toContain("tp:x:challenges");
});

test("admin preview runs the map game and saves nothing (E1.5)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:run:") || k.startsWith("tp:card:")).length);
  await page.goto("/admin/preview/ch_demo_bank");
  await expect(page.getByText("Preview as candidate")).toBeVisible();
  await startMapGame(page);
  await playMapWeek(page);
  await finishRealLife(page);
  // A sandbox run goes back to the admin home instead of saving a card.
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  const after = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:run:") || k.startsWith("tp:card:")).length);
  expect(after).toBe(before);
});

test("a published Launch Week challenge link opens the map game title screen", async ({ page }) => {
  await page.goto("/demo/seed");
  await page.getByTestId("play-ch_demo_bank").click();
  await expect(page).toHaveURL(/\/c\/bow-river/);
  await expect(page.getByTestId("game-shell")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toContainText("Launch Week");
  await expect(page.getByTestId("title-brief")).toContainText("Member Experience Associate");
  await expect(page.getByTestId("title-brief")).toContainText(/financial literacy week/i);
});
