import { expect, test, type Page } from "@playwright/test";

// M3.5 AI Engine (v2 Part B) in the browser: said vs did, Value Mapper, Copilot, AI health, publish cache.

async function seed(page: Page) {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
}
const CARD = "/recruiter/card/att_demo_maya?challenge=ch_demo_energy";

test("B.3 publishing caches dialogue variants with the challenge", async ({ page }) => {
  await seed(page);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:x:variants:")));
  expect(keys).toEqual(expect.arrayContaining(["tp:x:variants:ch_demo_energy", "tp:x:variants:ch_demo_bank"]));
  const table = await page.evaluate(() => JSON.parse(localStorage.getItem("tp:x:variants:ch_demo_energy") ?? "{}"));
  const first = Object.values(table)[0] as string[];
  expect(first).toHaveLength(3);
});

test("B.4 said vs did on the card, labelled as context", async ({ page }) => {
  await seed(page);
  await page.goto(CARD);
  const svd = page.getByTestId("said-vs-did");
  await expect(svd).toContainText("Said vs did");
  await expect(svd).toContainText("Context, not scored");
  await page.getByTestId("said-vs-did-toggle").click();
  await expect(page.getByTestId("svd-explanation").first()).toContainText("Said:");
  await expect(page.getByTestId("svd-story")).toContainText("Real story");
});

test("B.5 Value Mapper maps custom skills with confidence; admin accepts, changes, rejects", async ({ page }) => {
  await page.goto("/admin/new");
  await page.getByLabel("Company name").fill("Northwind Labs");
  await page.getByLabel("Role or challenge title").fill("Product Analyst");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByTestId("vm-terms").fill("Communicate tech and business, Analytical thinking, Make new discoveries, Synergy");
  await page.getByTestId("vm-map").click();
  await expect(page.getByTestId("vm-skill-0")).toHaveText("Communication");
  await expect(page.getByTestId("vm-skill-1")).toHaveText("Analytical thinking");
  await expect(page.getByTestId("vm-skill-2")).toHaveText("Curiosity and discovery");
  await expect(page.getByTestId("vm-confidence-1")).toContainText("95%");
  await expect(page.getByTestId("vm-skill-3")).toHaveText("No match");

  await page.getByTestId("vm-accept-0").click();
  await page.getByTestId("vm-accept-1").click();
  await page.getByTestId("vm-change-2").selectOption("creativity");
  await page.getByTestId("vm-reject-3").click();
  await expect(page.getByTestId("vm-row-0")).toHaveAttribute("data-status", "accepted");
  await expect(page.getByTestId("vm-row-2")).toHaveAttribute("data-status", "changed");
  await expect(page.getByTestId("vm-skill-2")).toHaveText("Creativity with limited resources");
  await expect(page.getByTestId("vm-row-3")).toHaveAttribute("data-status", "rejected");
  // Accepted and changed mappings select those skills.
  for (const s of ["communication", "analytical", "creativity"]) await expect(page.getByTestId(`skill-${s}`).locator("input")).toBeChecked();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
});

test("B.6 Copilot answers with citations that jump the clip, and refuses protected and hiring questions", async ({ page }) => {
  await seed(page);
  await page.goto(CARD);
  await page.getByTestId("copilot-open").click();
  await page.getByTestId("copilot-q").fill("Where did they show prioritization?");
  await page.getByTestId("copilot-ask").click();
  const answer = page.getByTestId("copilot-answer");
  await expect(answer).toHaveAttribute("data-refused", "no");
  await expect(answer).toContainText("Prioritization");
  await page.getByTestId("tab-cp1").click();
  await page.getByTestId("cite-0").click();
  await expect(page.getByTestId("tab-cp2")).toHaveAttribute("aria-selected", "true");

  await page.getByTestId("copilot-q").fill("How old is she?");
  await page.getByTestId("copilot-ask").click();
  await expect(answer).toHaveAttribute("data-refused", "protected");
  await page.getByTestId("copilot-q").fill("Should I hire her?");
  await page.getByTestId("copilot-ask").click();
  await expect(answer).toHaveAttribute("data-refused", "decision");
  await expect(answer).toContainText("no overall score");
});

test("B.8 AI health shows calls, latency, cost and validation failures", async ({ page }) => {
  await seed(page);
  await page.goto(CARD);
  await expect(page.getByTestId("capability-card")).toBeVisible();
  await page.goto("/admin/ai-health");
  await expect(page.getByTestId("ai-health")).toBeVisible();
  await expect(page.getByTestId("ai-mode")).toHaveText(/off|cached|live/);
  await page.getByTestId("ai-selfcheck").click();
  const table = page.getByTestId("ai-table");
  for (const h of ["p50", "p95", "Cost", "Validation failures"]) await expect(table).toContainText(h);
  for (const s of ["evidence-scanner", "recruiter-copilot", "value-mapper", "dialogue-variants", "consistency-checker", "candidate-coach", "fairness-monitor"]) {
    await expect(page.getByTestId(`ai-row-${s}`)).toBeVisible();
  }
  await expect(page.getByTestId("ai-row-all-services")).toBeVisible();
});
