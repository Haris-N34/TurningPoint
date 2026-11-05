import { expect, test } from "@playwright/test";
import { startMapGame, toChoices } from "./mapHelpers";

const EDITED = "Two field techs asked for the site briefing. Nobody has taken deliveries or set-up yet.";

test("admin builds, tailors, edits, previews and publishes a map challenge (E1)", async ({ page, context }) => {
  test.setTimeout(120_000);
  const started = Date.now();
  await page.goto("/admin");
  await expect(page.getByTestId("admin-home")).toBeVisible();
  await page.getByRole("link", { name: "New challenge" }).click();
  await expect(page.getByTestId("builder")).toBeVisible();

  // Step 1: company
  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeDisabled();
  await page.getByLabel("Company name").fill("Prairie Grid Energy");
  await page.getByLabel("Role or challenge title").fill("Field Operations Analyst");
  await next.click();

  // Step 2: skills, must pick 3 or 4 (E1.1)
  for (const s of ["adaptability", "resilience"]) await page.getByTestId(`skill-${s}`).click();
  await expect(next).toBeDisabled();
  for (const s of ["prioritization", "collaboration"]) await page.getByTestId(`skill-${s}`).click();
  await expect(page.getByTestId("skill-empathy").locator("input")).toBeDisabled();
  await next.click();

  // Step 3: at least 2 templates with length and skills (E1.2); industry tailoring (E1.3)
  await expect(page.locator('[data-testid^="template-"]')).toHaveCount(await page.locator('[data-testid^="template-"]').count());
  expect(await page.locator('[data-testid^="template-"]').count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId("template-launch-week")).toContainText("minutes");
  await page.getByLabel("Industry flavour").selectOption("Energy");
  await expect(page.getByTestId("tailor-note")).toContainText("Rewritten for Energy");
  await expect(page.getByTestId("tailored-opening")).toContainText(/community energy fair/i);
  await expect(page.getByTestId("builder")).toHaveAttribute("data-format", "map");
  await next.click();

  // Step 4: inline edit of the map's dialogue and checkpoint eligibility (E1.4); validation blocks publish
  await expect(page.getByTestId("line-n-roles-0")).toContainText("site safety briefings"); // tailored map text
  await page.getByTestId("line-n-roles-0").fill(EDITED);
  const boxes = page.locator('[data-testid^="eligible-"]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).uncheck();
  await expect(page.getByTestId("builder-errors")).toContainText("at least 3 checkpoint-eligible");
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
  for (const id of ["roles", "vendor-mix", "recovery-plan"]) await page.getByTestId(`eligible-${id}`).check();
  await expect(page.getByTestId("builder-errors")).toBeHidden();

  // Preview as candidate in a sandbox (E1.5)
  const [preview] = await Promise.all([context.waitForEvent("page"), page.getByTestId("preview").click()]);
  await expect(preview.getByText("Preview as candidate")).toBeVisible();
  await expect(preview.getByTestId("title-screen")).toBeVisible();
  await preview.close();

  // Publish: link, job code, QR (E1.6)
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("public-link")).toHaveText(/\/c\/prairie-grid-energy-field-operations-[a-z2-9]{4}$/);
  await expect(page.getByTestId("job-code")).toHaveText(/^TP-[A-Z2-9]{5}$/);
  await expect(page.getByTestId("qr")).toBeVisible();

  // The tailored setting and the edited line reach candidates in the map game.
  await page.getByRole("link", { name: "Open candidate link" }).click();
  await expect(page.getByTestId("title-brief")).toContainText("Prairie Grid Energy · Field Operations Analyst");
  await expect(page.getByTestId("title-brief")).toContainText(/community energy fair/i);
  await startMapGame(page);
  await page.getByTestId("list-talk-roles").click();
  await expect(page.getByTestId("dialogue")).toBeVisible();
  await page.keyboard.press("Enter"); // skip the typewriter
  await expect(page.getByTestId("dialogue-text")).toContainText(EDITED);
  await toChoices(page);

  // E1.7 proxy: a scripted first run of the whole setup is far under 10 minutes.
  expect(Date.now() - started).toBeLessThan(10 * 60_000);
});
