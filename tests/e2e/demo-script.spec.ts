import { expect, test, type Page } from "@playwright/test";

// I.1 (start): plays docs/pitch/demo-script.md step by step against the app.
// Run twice in a row: pnpm e2e tests/e2e/demo-script.spec.ts --repeat-each=2
// Steps that need unmerged branches are skipped with the branch named in the reason.

type TP = {
  getState: () => { t: number; tp: { fired: boolean }; issues: Record<string, { status: string }> };
  setClock: (t: string) => void;
};
const tp = <T,>(page: Page, fn: (tp: TP) => T) => page.evaluate(`(${fn.toString()})(window.__tp)`) as Promise<T>;

const CARD = "/recruiter/card/att_demo_maya?challenge=ch_demo_energy";

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

  test("step 0b: Ctrl+Shift+D demo panel and reset", async () => {
    test.skip(true, "Demo panel (P.2) is being built on claude/v2-m5; not in main yet. Confirm once merged.");
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
    expect(await tp(page, (x) => x.getState().issues["recovery-plan"].status)).toBe("open");
  });

  test("step 5b: Ctrl+Shift+D jumps straight to the turning point", async () => {
    test.skip(true, "Demo shortcut (P.2) is being built on claude/v2-m5; not in main yet. Confirm once merged.");
  });

  test("step 6: Second Look restores a candidate the mock ATS rejected", async () => {
    test.skip(true, "Second Look and the integration console (C.10, C.11) are on claude/v2-integrations; not in main yet.");
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
    await expect(card).not.toContainText(/score\s*[:=]?\s*\d/i);
    await page.getByTestId("jump-prioritization").click();
    await expect(page.getByTestId("tab-cp2")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("witness-line")).toHaveText("Confirmed by 1 community partner");
    await page.getByTestId("said-vs-did-toggle").click();
    await expect(page.getByTestId("said-vs-did")).toContainText("Context, not scored");
    await page.getByRole("button", { name: "Shortlist" }).click();
    await expect(page.getByTestId("decision")).toContainText("Shortlisted");
    await expect(page.getByTestId("card-name")).toHaveText("Maya Chen");
  });

  test("step 7b: Resume vs Evidence on the card", async () => {
    test.skip(true, "Resume vs Evidence (C.7) is on claude/v2-integrations; not in main yet.");
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
