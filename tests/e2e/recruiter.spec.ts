import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import mayaFixture from "../../fixtures/attempt.json";

// Maya's anonymous ID comes from the demo fixture, so a fixture rebuild never breaks the check.
const MAYA_ANON = mayaFixture.anonId;

async function seed(page: Page) {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  // The "seeded" page renders before its effect writes the data; wait for Maya's share to be stored.
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("tp:shares") ?? "[]") as { attemptId: string }[]).some((s) => s.attemptId === "att_demo_maya"));
}
const MAYA = "att_demo_maya";
const CARD = `/recruiter/card/${MAYA}?challenge=ch_demo_energy`;

test("inbox: anonymous rows, filters, keyboard shortlist reveals the name (E2, E6.1)", async ({ page }) => {
  await seed(page);
  await page.goto("/recruiter");
  const row = page.getByTestId(`row-${MAYA}`);
  await expect(row).toContainText(MAYA_ANON);
  await expect(row).not.toContainText("Maya");
  await expect(row).toContainText("Confirmed");
  await expect(row).toContainText("Strong");

  await page.getByTestId("filter-skill").selectOption("collaboration");
  await page.getByTestId("filter-level").selectOption("strong");
  await expect(row).toBeVisible();
  await page.getByTestId("filter-witness").selectOption("false");
  await expect(row).toBeHidden();
  await page.getByTestId("filter-witness").selectOption("");

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(row).toContainText("Shortlisted");
  await expect(row).toContainText("Maya Chen");
  await expect(page.getByTestId("toast")).toContainText("Shortlisted");

  await page.getByTestId("send-ats").click();
  // The mock ATS route compiles on first use in dev, so allow it time.
  await expect(page.getByTestId("toast")).toContainText("Sent 1 shortlisted candidate", { timeout: 30_000 });
});

test("Enter opens the selected card (E2.3)", async ({ page }) => {
  await seed(page);
  await page.goto("/recruiter");
  await expect(page.getByTestId(`row-${MAYA}`)).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/recruiter/card/${MAYA}`));
});

test("card: evidence with sources, decision path, real story, integrity, actions (E3)", async ({ page }) => {
  await seed(page);
  await page.goto(CARD);
  const card = page.getByTestId("capability-card");
  await expect(page.getByTestId("card-name")).toHaveText(MAYA_ANON);
  await expect(card).toContainText("Verified student");
  // v2 D.4 adds a Final score box at the top right; the evidence itself still carries levels, never numbers.
  await expect(card.getByTestId("evidence")).not.toContainText(/score\s*[:=]?\s*\d/i);
  await expect(card.getByTestId("evidence")).not.toContainText(/\d+\/100/);
  const jumps = card.locator('[data-testid^="jump-"]');
  expect(await jumps.count()).toBe(4);
  expect(await card.getByText("AI summary").count()).toBe(4);
  await expect(page.getByTestId("turning-point-marker")).toBeVisible();
  await expect(page.getByTestId("witness-line")).toHaveText("Confirmed by 1 community partner");
  await expect(page.getByTestId("integrity")).toContainText("For context, not scored");

  await page.getByTestId("jump-prioritization").click();
  await expect(page.getByTestId("tab-cp2")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("dot-cp1").click();
  await expect(page.getByTestId("tab-cp1")).toHaveAttribute("aria-selected", "true");

  // Pass needs a reason (E3.7).
  await page.getByRole("button", { name: "Pass", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm pass" })).toBeDisabled();
  await page.getByLabel("Reason (required)").selectOption("Position filled");
  await page.getByRole("button", { name: "Confirm pass" }).click();
  await expect(page.getByTestId("decision")).toContainText("pass");
  await expect(page.getByTestId("card-name")).toHaveText(MAYA_ANON);

  await page.getByRole("button", { name: "Shortlist" }).click();
  await expect(page.getByTestId("decision")).toContainText("Shortlisted");
  await expect(page.getByTestId("card-name")).toHaveText("Maya Chen");
});

test("card fits one laptop screen and has no serious accessibility issues (E3, A5)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "laptop layout only");
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  await page.goto(CARD);
  await expect(page.getByTestId("capability-card")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900);
  for (const url of [CARD, "/recruiter"]) {
    await page.goto(url);
    await page.waitForTimeout(300);
    const a = await new AxeBuilder({ page }).analyze();
    expect(a.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id)).toEqual([]);
  }
});

test("reused and withdrawn cards (E8.1, C7.4)", async ({ page }) => {
  await seed(page);
  await page.evaluate((id) => {
    const shares = JSON.parse(localStorage.getItem("tp:shares") ?? "[]");
    shares.push({ id: `sh_${id}_ch_demo_bank`, attemptId: id, challengeId: "ch_demo_bank", reused: true, createdAt: new Date().toISOString() });
    localStorage.setItem("tp:shares", JSON.stringify(shares));
  }, MAYA);
  await page.goto("/recruiter?challenge=ch_demo_bank");
  await expect(page.getByTestId(`reused-${MAYA}`)).toContainText("Resilience");
  await page.goto(`/recruiter/card/${MAYA}?challenge=ch_demo_bank`);
  await expect(page.getByTestId("reused-badge")).toContainText("Reused from a previous challenge");

  await page.evaluate((id) => {
    const shares = JSON.parse(localStorage.getItem("tp:shares") ?? "[]");
    for (const s of shares) if (s.attemptId === id && s.challengeId === "ch_demo_bank") s.revokedAt = new Date().toISOString();
    localStorage.setItem("tp:shares", JSON.stringify(shares));
  }, MAYA);
  await page.reload();
  await expect(page.getByTestId("withdrawn")).toContainText("Candidate withdrew this card");
  await page.goto("/recruiter?challenge=ch_demo_bank");
  await expect(page.getByTestId(`row-${MAYA}`)).toContainText("Candidate withdrew this card");
});

test("transcript-first hides video until revealed (E6.2)", async ({ page }) => {
  await seed(page);
  await page.goto("/recruiter");
  // Wait for the client inbox to render (hydrated) before toggling.
  await expect(page.getByTestId(`row-${MAYA}`)).toBeVisible();
  await page.getByTestId("transcript-first-toggle").check();
  await expect(page.getByTestId("transcript-first-toggle")).toBeChecked();
  await page.goto(CARD);
  await page.getByTestId("tab-cp2").click();
  await expect(page.getByRole("button", { name: "Reveal video" })).toBeVisible();
});

test("demo inbox reads like a real list: Maya first, synthetic peers labelled, quote jump is visible on the card", async ({ page }) => {
  await seed(page);
  await page.goto("/recruiter");
  const rows = page.locator('[data-testid^="row-"]');
  await expect(rows.first()).toHaveAttribute("data-testid", `row-${MAYA}`);
  expect(await rows.count()).toBeGreaterThan(4);
  await expect(page.getByTestId("row-att_demo_peer_01")).toContainText("Synthetic");
  await expect(page.getByTestId(`row-${MAYA}`)).not.toContainText("Synthetic");

  await page.goto(CARD);
  await page.getByTestId("jump-prioritization").click();
  await expect(page.getByTestId("jump-banner")).toContainText("Prioritization");
  // The Copilot trigger sits in the toolbar, not over the answer.
  const ask = await page.getByTestId("copilot-open").boundingBox();
  const answers = await page.getByTestId("answers").boundingBox();
  expect(ask!.y + ask!.height).toBeLessThanOrEqual(answers!.y);
});

test("employers never see accommodation status: card, inbox and compare (privacy)", async ({ page }) => {
  await seed(page);
  // Maya and a peer both used an accommodation (extra time or turn-based play).
  await page.evaluate(() => {
    for (const id of ["att_demo_maya", "att_demo_peer_01"]) {
      const key = `tp:card:${id}`;
      const card = JSON.parse(localStorage.getItem(key)!);
      localStorage.setItem(key, JSON.stringify({ ...card, adjustedTiming: true }));
    }
  });
  const hidden = /adjusted timing|accommodation|extra time|turn-based/i;
  await page.goto("/recruiter");
  await expect(page.getByTestId(`row-${MAYA}`)).toBeVisible();
  await expect(page.getByTestId("inbox")).not.toContainText(hidden);
  await page.goto(CARD);
  await expect(page.getByTestId("capability-card")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(hidden);
  await page.goto(`/recruiter/compare?challenge=ch_demo_energy&ids=${MAYA},att_demo_peer_01`);
  await expect(page.getByTestId("compare")).toBeVisible();
  await expect(page.getByTestId("compare")).not.toContainText(hidden);
});

test("decision path keeps the turning point in view, with arrows when the path scrolls", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "checked at laptop sizes");
  await seed(page);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(CARD);
    const path = page.getByTestId("decision-path");
    await expect(page.getByTestId("turning-point-marker")).toBeVisible();
    const m = (await page.getByTestId("turning-point-marker").boundingBox())!;
    const p = (await path.boundingBox())!;
    expect(m.x).toBeGreaterThanOrEqual(p.x);
    expect(m.x + m.width).toBeLessThanOrEqual(p.x + p.width);
    if (await path.evaluate((el) => el.scrollWidth > el.clientWidth)) {
      await expect(page.getByTestId("path-right")).toBeVisible();
      await page.getByTestId("path-right").click();
      await expect.poll(() => path.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
  }
});
