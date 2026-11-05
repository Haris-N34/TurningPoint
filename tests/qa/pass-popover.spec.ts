import { expect, test } from "@playwright/test";

// QA night. On the recruiter card, Pass opens the reason form as a popover over the Answers tabs and the
// player (docs/qa/pass-form-covers-tabs.png). Neither Escape nor a click outside closes it, so a recruiter who
// wants to re-check the real-life answer before passing has to find the Pass button again.
test.fixme("recruiter card: the Pass reason popover closes on Escape and on an outside click (owner: agent C, components/recruiter/RecruiterCard.tsx)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop layout puts the popover over the tabs");
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto("/recruiter/card/att_demo_maya?challenge=ch_demo_energy");
  const pass = page.getByRole("button", { name: "Pass", exact: true });
  await pass.click();
  await expect(page.locator("#pass-note")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pass-note")).toBeHidden();
  await pass.click();
  await page.mouse.click(300, 700);
  await expect(page.locator("#pass-note")).toBeHidden();
  await page.getByTestId("tab-rl").click({ timeout: 3_000 });
});
