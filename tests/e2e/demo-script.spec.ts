import { expect, test, type Page } from "@playwright/test";

// I.1 (start): plays docs/pitch/demo-script.md step by step against the app.
// Run twice in a row: pnpm e2e tests/e2e/demo-script.spec.ts --repeat-each=2
// Steps that need unmerged branches are skipped with the branch named in the reason.

type TP = {
  getState: () => { t: number; tp: { fired: boolean }; issues: Record<string, { status: string }> };
  openIssues: () => string[];
  setClock: (t: string) => void;
};
const tp = <T,>(page: Page, fn: (tp: TP) => T) => page.evaluate(`(${fn.toString()})(window.__tp)`) as Promise<T>;

const CARD = "/recruiter/card/att_demo_maya?challenge=ch_demo_energy";

// The resume used in setup. Same shape as tests/e2e/resume.spec.ts.
const RESUME = `Maya Chen
maya.chen@example.com | (403) 555-0182

Experience
Volunteer Coordinator at Bow Valley Food Bank (May 2025 - Aug 2025)
- Led a team of 50 volunteers and kept every volunteer informed when funding was cut
- Negotiated donated supplies from a local store, saving $2,000
- Tracked attendance data in a spreadsheet`;

async function seed(page: Page) {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
}

/** Clear any overlay the way the presenter would. Returns false when nothing was open. */
async function clearOverlay(page: Page): Promise<boolean> {
  for (const id of ["cutscene-next", "cutscene-done", "recap-next", "pause-resume"]) {
    const b = page.getByTestId(id);
    if (await b.isVisible()) {
      await b.click();
      return true;
    }
  }
  if (await page.getByTestId("order-pick").isVisible()) {
    const ranks = page.locator('[data-testid^="rank-"]:not([data-testid="rank-done"])');
    for (let i = 0; i < Math.min(2, await ranks.count()); i++) await ranks.nth(i).click();
    await page.getByTestId("rank-done").click();
    return true;
  }
  if (await page.getByTestId("checkpoint").isVisible()) {
    await answerText(page, "I did the urgent thing first because the team was waiting on it, and I told the vendor why.");
    return true;
  }
  if (await page.getByTestId("dialogue").isVisible()) {
    await toChoices(page);
    await page.getByTestId("choice-a").click();
    await expect(page.getByTestId("dialogue")).toBeHidden();
    return true;
  }
  if (await page.getByTestId("reaction").isVisible()) {
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

async function toChoices(page: Page) {
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId("choice-a").isVisible()) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await expect(page.getByTestId("choice-a")).toBeVisible();
  await page.waitForTimeout(400); // anti-mash guard on fresh choices
}

async function answerText(page: Page, text: string) {
  const cp = page.getByTestId("checkpoint");
  await cp.locator('label:has(input[value="text"])').click();
  await cp.getByRole("button", { name: /start answering/i }).click();
  await expect(cp).toHaveAttribute("data-phase", "answer", { timeout: 20_000 });
  await cp.getByTestId("answer-text").fill(text);
  await cp.getByRole("button", { name: "Done" }).click();
  await expect(cp.getByTestId("transcript")).not.toBeEmpty();
  await cp.getByRole("button", { name: "Submit" }).click();
  await expect(cp).toBeHidden({ timeout: 10_000 });
}

/** Steps 1 and 3 share this: title screen, turn-based on, avatar, onto the map. */
async function startLaunchWeek(page: Page) {
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await expect(page.getByTestId("title-screen")).toContainText("PRESS ENTER");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("set-turn-based").check();
  // The long demo plays the full week (Quick mode, the default, is the one-minute demo).
  await page.getByTestId("set-full-week").check();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("avatar-creator")).toBeVisible();
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await expect(page.getByTestId("turn-based")).toBeVisible();
}

test.describe("demo script v2 (docs/pitch/demo-script.md)", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "the demo is driven on the laptop");
  });

  test("step 0: reset to a clean demo state", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await seed(page);
    await expect(page.getByTestId("seeded")).toContainText("Prairie Grid Energy");
    await expect(page.getByTestId("seeded")).toContainText("Bow River Credit Union");
  });

  test("step 0b: Ctrl+Shift+D demo panel resets, reseeds and jumps to the game", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("tp:run:att_leftover", "{}"));
    await expect(page.getByTestId("demo-panel")).toHaveCount(0);
    await page.keyboard.press("Control+Shift+D");
    const panel = page.getByTestId("demo-panel");
    await expect(panel).toBeVisible();
    await page.getByTestId("demo-reset").click();
    await expect(page.getByTestId("demo-msg")).toContainText("Reset done");
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).not.toContain("tp:run:att_leftover");
    expect(keys).toContain("tp:card:att_demo_maya");
    await panel.getByRole("link", { name: "Game", exact: true }).click();
    // First hit compiles the game route in dev; allow for it.
    await expect(page).toHaveURL(/\/game\/launch-week$/, { timeout: 30_000 });
    await expect(page.getByTestId("title-screen")).toBeVisible();
  });

  test("step 1: title screen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/game/launch-week");
    await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
    await expect(page.getByTestId("title-map")).toBeVisible();
    await expect(page.getByTestId("title-screen")).toContainText("Launch Week");
    expect(errors).toEqual([]);
  });

  test("step 2: employer types its own skills, Value Mapper maps them, publish", async ({ page }) => {
    await page.goto("/admin/new");
    await page.getByLabel("Company name").fill("Northwind Labs");
    await page.getByLabel("Role or challenge title").fill("Junior Tech Consultant");
    const next = page.getByRole("button", { name: "Next", exact: true });
    await next.click();
    await page.getByTestId("vm-terms").fill("Communicate tech and business, Analytical thinking, Make new discoveries");
    await page.getByTestId("vm-map").click();
    await expect(page.getByTestId("vm-skill-0")).toHaveText("Communication");
    await expect(page.getByTestId("vm-skill-1")).toHaveText("Analytical thinking");
    await expect(page.getByTestId("vm-skill-2")).toHaveText("Curiosity and discovery");
    for (const i of [0, 1, 2]) await page.getByTestId(`vm-accept-${i}`).click();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByTestId("template-launch-week")).toBeVisible();
    await next.click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByTestId("public-link")).toHaveText(/\/c\/northwind-labs-/);
    await expect(page.getByTestId("job-code")).toHaveText(/^TP-[A-Z2-9]{5}$/);
    await expect(page.getByTestId("qr")).toBeVisible();
  });

  test("step 3: talk to Priya, pick C, the checkpoint quotes that choice", async ({ page }) => {
    await startLaunchWeek(page);
    await page.getByTestId("go-roles").click();
    await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("dialogue").locator("img[data-expression]")).toBeVisible();
    await toChoices(page);
    await page.getByTestId("choice-c").click();
    await expect(page.getByTestId("checkpoint")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("checkpoint-question")).toHaveAttribute(
      "aria-label",
      "You chose C, to take logistics myself so the team stays happy. Walk us through why.",
    );
    await answerText(page, "Nobody wanted logistics, so I took it to keep the volunteers on the jobs they chose. It costs me three days.");
    expect(await tp(page, (x) => x.getState().issues.roles.status)).toBe("resolved");
  });

  test("step 4: defer the vendor issue with a reason", async ({ page }) => {
    await startLaunchWeek(page);
    await page.getByTestId("delegate-roles").click();
    await page.getByTestId("delegate-to-priya").click();
    while (await clearOverlay(page));
    for (let i = 0; i < 6 && !(await page.getByTestId("defer-vendor-mix").isVisible()); i++) {
      if (!(await clearOverlay(page))) await page.getByTestId("wait").click();
    }
    await page.getByTestId("defer-vendor-mix").click();
    await expect(page.getByTestId("defer-reason").first()).toContainText("Something more urgent first");
    await page.getByTestId("defer-reason").first().click();
    await expect.poll(() => tp(page, (x) => x.getState().issues["vendor-mix"].status)).toBe("deferred");
    // A seeded checkpoint about the deferral may open; the presenter answers it in text.
    while (await clearOverlay(page));
  });

  test("step 5: turning point cutscene drains the budget and opens the recovery plan", async ({ page }) => {
    // On stage this is the Ctrl+Shift+D jump (claude/v2-m5). Here the test hook stands in for it.
    await startLaunchWeek(page);
    await tp(page, (x) => x.setClock("Wed 09:00"));
    for (let i = 0; i < 12 && !(await page.getByTestId("cutscene").isVisible()); i++) {
      await clearOverlay(page);
      await tp(page, (x) => x.setClock("Wed 09:00"));
      if (!(await tp(page, (x) => x.getState().tp.fired))) await page.getByTestId("wait").click();
    }
    await expect(page.getByTestId("cutscene")).toBeVisible();
    await page.getByTestId("cutscene-next").click();
    await expect(page.getByTestId("budget-drain")).toBeVisible();
    await page.getByTestId("cutscene-done").click();
    // Each disruption has its own recovery issue (recovery-plan, recovery-venue or recovery-cover).
    expect((await tp(page, (x) => x.openIssues())).some((id) => id.startsWith("recovery"))).toBe(true);
  });

  test("step 5b: Ctrl+Shift+D jumps straight to the turning point", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await page.keyboard.press("Control+Shift+D");
    await page.getByTestId("demo-panel").getByRole("link", { name: "Turning point" }).click();
    await expect(page).toHaveURL(/jump=turning-point/);
    await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
    await page.getByTestId("start").click();
    await page.getByTestId("avatar-done").click();
    await expect(page.getByTestId("cutscene")).toBeVisible({ timeout: 20_000 });
    // The HUD hides during the cutscene; the clock shows Tuesday morning (Quick mode, the default) once it closes.
    await page.getByTestId("cutscene-next").click();
    await page.getByTestId("cutscene-done").click();
    await expect(page.getByTestId("clock-time")).toHaveText(/^Tue 09:/);
    // A jumped run is never saved.
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tp:run:")).length)).toBe(0);
  });

  test("step 6: Second Look restores a candidate the mock ATS rejected", async ({ page }) => {
    await seed(page);
    await page.goto("/admin/integrations");
    await expect(page.getByTestId("integration-console")).toBeVisible();
    // Fresh tenant per run, as in setup: the mock ATS state lives on the server.
    const before = await page.getByTestId("integration-console").locator("code").first().innerText();
    await page.getByTestId("fresh-company").click();
    await expect(page.getByTestId("integration-console").locator("code").first()).not.toHaveText(before);
    await page.getByTestId("reject-gh_app_maya").click();
    await expect(page.getByTestId("webhook-log")).toContainText("Second Look: Rejected at resume screen; Strong evidence in Prioritization and Collaboration");
    await page.goto("/recruiter?challenge=ch_demo_energy");
    const q = page.getByTestId("second-look-queue");
    await expect(q).toContainText("Rejected at resume screen");
    await expect(page.getByTestId("row-att_demo_maya")).toBeVisible(); // nobody is removed from the inbox
    await q.getByRole("link", { name: "Open card" }).click();
    await expect(page.getByTestId("second-look-panel")).toBeVisible();
    await page.getByTestId("second-look-restore").click();
    await expect(page.getByTestId("second-look-done")).toContainText("restored to consideration");
    await page.goto("/recruiter?challenge=ch_demo_energy");
    await expect(page.getByTestId("second-look-rescued")).toContainText("this season: 1");
  });

  test("step 7a: inbox is anonymous, shortlist reveals the name", async ({ page }) => {
    await seed(page);
    await page.goto("/recruiter");
    const row = page.getByTestId("row-att_demo_maya");
    await expect(row).toContainText("Candidate 4F7K");
    await expect(row).not.toContainText("Maya");
    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/recruiter\/card\/att_demo_maya/);
    const card = page.getByTestId("capability-card");
    // v2 Part D: a Final score exists but only sorts; it never hides or rejects anyone.
    await expect(card).toContainText("Never used to hide or reject anyone");
    await expect(card).toContainText("Sorts only");
    await expect(card).not.toContainText(/threshold|cut-?off|pass mark|auto-?reject/i);
    await page.getByTestId("jump-prioritization").click();
    await expect(page.getByTestId("tab-cp2")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("witness-line")).toHaveText("Confirmed by 1 community partner");
    await page.getByTestId("said-vs-did-toggle").click();
    await expect(page.getByTestId("said-vs-did")).toContainText("Context, not scored");
    await page.getByRole("button", { name: "Shortlist" }).click();
    await expect(page.getByTestId("decision")).toContainText("Shortlisted");
    await expect(page.getByTestId("card-name")).toHaveText("Maya Chen");
  });

  test("step 7b: Resume vs Evidence and the Final score breakdown", async ({ page }) => {
    await seed(page);
    // Setup step: the candidate adds a resume with consent (demo-script.md, Setup).
    await page.goto("/results/att_demo_maya");
    const intake = page.getByTestId("resume-intake");
    await intake.getByTestId("resume-text").fill(RESUME);
    await intake.getByTestId("resume-consent").check();
    await intake.getByTestId("resume-analyze").click();
    await expect(intake.getByTestId("resume-added")).toContainText("claims");
    await page.goto(CARD);
    const rve = page.getByTestId("resume-vs-evidence");
    await expect(rve).toContainText("Resume: basic capabilities");
    await expect(rve).toContainText("Game: evidence");
    await expect(rve).toContainText("Backed by game evidence");
    await expect(rve).toContainText("Not yet shown");
    await expect(rve).not.toContainText(/Maya|Chen|Bow Valley|example\.com/i);
    await page.getByTestId("final-score").getByRole("button").focus();
    await expect(page.getByTestId("final-score-breakdown")).toContainText("Resume 25%");
  });

  test("step 8: Copilot answers with a citation and refuses a hiring question", async ({ page }) => {
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
    await page.getByTestId("copilot-q").fill("Should I hire her?");
    await page.getByTestId("copilot-ask").click();
    await expect(answer).toHaveAttribute("data-refused", "decision");
  });

  test("step 9: impact dashboard with the fictional cohort and a four-fifths flag", async ({ page }) => {
    await page.goto("/admin/impact");
    await page.getByRole("button", { name: "Load 200 fictional candidates" }).click();
    await expect(page.getByTestId("impact-started")).toHaveText("200");
    await expect(page.getByRole("status")).toContainText("Fictional cohort loaded");
    await expect(page.getByText("Review: below four-fifths").first()).toBeVisible();
    await expect(page.getByText("Recruiter minutes per candidate", { exact: true })).toBeVisible();
  });
});
