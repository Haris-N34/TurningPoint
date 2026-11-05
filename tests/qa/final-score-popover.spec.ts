import { expect, test } from "@playwright/test";

// QA night. demo-60s step 0:40: "Point at the Final score. Click Shortlist." The breakdown popover opens on
// hover and stays open on focus, and it sits right on top of Shortlist, Hold and Pass, so the click lands on
// the popover. Screenshot: docs/qa/final-score-covers-shortlist.png.
test.fixme("recruiter card: Shortlist still clickable after looking at the Final score (owner: agent C, components/recruiter or components/card)", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto("/recruiter/card/att_demo_maya?challenge=ch_demo_energy");
  await page.getByTestId("final-score").getByRole("button").first().click();
  await page.getByRole("button", { name: "Shortlist", exact: true }).click({ timeout: 3_000 });
  await expect(page.getByTestId("card-name")).toHaveText("Maya Chen");
});

test.fixme("recruiter card: hovering the Final score does not hide the review actions (owner: agent C)", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto("/recruiter/card/att_demo_maya?challenge=ch_demo_energy");
  await page.getByTestId("final-score").hover();
  const actions = page.getByTestId("review-actions").getByRole("button", { name: "Shortlist", exact: true });
  const box = (await actions.boundingBox())!;
  const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="review-actions"]') !== null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(top).toBe(true);
});
