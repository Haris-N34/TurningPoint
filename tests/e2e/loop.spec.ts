import { expect, test } from "@playwright/test";
import { installFakeSpeech, playToEnd, setProfile } from "./helpers";

test("full loop: challenge link, play, witness confirms, share with a second employer, withdraw, delete (M4)", async ({ page, context }) => {
  await installFakeSpeech(page);
  await setProfile(page, { displayName: "Test Candidate", email: "test.candidate@ucalgary.ca", verified: true, university: "University of Calgary" });

  await page.goto("/demo/seed");
  await page.getByTestId("play-ch_demo_energy").click();
  await expect(page).toHaveURL(/\/c\/prairie-grid-energy/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Field Operations Analyst");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await expect(page.getByTestId("narration")).toContainText(/community energy fair/i); // tailored (E1.3)
  await playToEnd(page, "text");
  await page.getByTestId("see-results").click();
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

test("admin preview runs the game and saves nothing (E1.5)", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:run:") || k.startsWith("tp:card:")).length);
  await page.goto("/admin/preview/ch_demo_bank");
  await expect(page.getByText("Preview as candidate")).toBeVisible();
  await page.getByRole("button", { name: "I agree, start" }).click();
  await playToEnd(page, "text");
  await expect(page.getByTestId("end")).toContainText("Nothing was saved");
  const after = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:run:") || k.startsWith("tp:card:")).length);
  expect(after).toBe(before);
});
