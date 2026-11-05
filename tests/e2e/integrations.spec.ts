import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fixture from "../../fixtures/attempt.json";

// v2 Part C end to end. Every test gets its own tenant so parallel runs never share state.
test.describe.configure({ timeout: 120_000 });

async function tenant(page: Page) {
  const r = await page.request.post("/api/integrations/companies", { data: { name: "Prairie Grid Energy (fictional)" } });
  expect(r.status()).toBe(201);
  const t = (await r.json()) as { id: string; webhookSecret: string };
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto(`/admin/integrations?company=${t.id}`);
  await expect(page.getByTestId("integration-console")).toContainText(t.id);
  return t;
}

/** The candidate finishes: a copy of Maya's card lands in this browser, then the results page reports it. */
async function finishAs(page: Page, attemptId: string) {
  await page.evaluate(
    ([card, id]) => {
      const c = { ...(card as Record<string, unknown>), attemptId: id };
      localStorage.setItem(`tp:card:${id}`, JSON.stringify(c));
    },
    [fixture, attemptId] as const,
  );
  await page.goto(`/results/${attemptId}`);
  await expect(page.getByTestId("results")).toBeVisible();
}

test("ATS application invites the candidate; the finished result posts back to the mock ATS (C.1, C.2, C.3, C.10)", async ({ page }) => {
  await tenant(page);
  await expect(page.getByTestId("provider-greenhouse")).toContainText("Greenhouse (Mock)");
  await expect(page.getByTestId("provider-workday")).toContainText("Not connected");
  await page.getByTestId("connect-workday").click();
  await expect(page.getByTestId("provider-workday")).toContainText("Connected");

  await page.getByTestId("apply-greenhouse-4001").click();
  const invite = page.getByTestId("email-log").getByTestId("invite-link").first();
  await expect(invite).toHaveText(/^\/c\/.+\?invite=inv_/);
  await expect(page.getByTestId("webhook-log")).toContainText("application.created");
  await expect(page.getByTestId("webhook-log").locator('[data-outcome="processed"]').first()).toContainText("Invited applicant");
  await page.getByTestId("webhook-log").locator("summary").first().click();
  await expect(page.getByTestId("webhook-log")).toContainText('"type": "application.created"');

  await page.goto((await invite.getAttribute("href"))!);
  await expect(page).toHaveURL(/invite=inv_/);
  const id = `att_e2e_${Date.now()}`;
  await finishAs(page, id);
  await expect(page.getByTestId("ats-sent")).toContainText("sent to the employer", { timeout: 15_000 });
  // The ATS resume is offered for intake, behind consent.
  await expect(page.getByTestId("resume-from-ats")).toContainText("Greenhouse (Mock)");

  await page.goBack();
  await page.goto("/admin/integrations");
  const delivered = page.getByTestId("delivery-log").locator('[data-status="delivered"]').first();
  await expect(delivered).toContainText("result → greenhouse");
  await delivered.locator("summary").click();
  await expect(delivered).toContainText(`/recruiter/card/${id}?challenge=ch_demo_energy`);
  await expect(delivered).toContainText('"finalScore"');

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
});

test("a failed delivery retries with backoff, then the console re-sends it (C.3, C.10)", async ({ page }) => {
  await tenant(page);
  await page.getByTestId("apply-greenhouse-4001").click();
  const invite = page.getByTestId("email-log").getByTestId("invite-link").first();
  await expect(invite).toBeVisible();
  await page.getByTestId("fail-greenhouse").click();
  await expect(page.getByTestId("fail-greenhouse")).toContainText("5 left");
  await page.goto((await invite.getAttribute("href"))!);
  await finishAs(page, `att_fail_${Date.now()}`);
  await expect(page.getByTestId("ats-sent")).toContainText("being retried", { timeout: 15_000 });
  await page.goto("/admin/integrations");
  const failed = page.getByTestId("delivery-log").locator('[data-status="failed"]').first();
  await expect(failed).toContainText("retried after 100 ms");
  await expect(failed).toContainText("retried after 400 ms");
  await failed.getByTestId("resend").click();
  await expect(page.getByTestId("delivery-log").locator('[data-status="delivered"]').first()).toBeVisible();
});

test("Second Look: resume-stage rejection with strong evidence; recruiter opens the card and restores (C.11)", async ({ page }) => {
  await tenant(page);
  await page.getByTestId("reject-gh_app_maya").click();
  await expect(page.getByTestId("webhook-log")).toContainText("Second Look: Rejected at resume screen; Strong evidence in Prioritization and Collaboration");

  await page.goto("/recruiter?challenge=ch_demo_energy");
  const q = page.getByTestId("second-look-queue");
  await expect(q).toContainText("Rejected at resume screen; Strong evidence in Prioritization and Collaboration");
  await expect(page.getByTestId("second-look-rescued")).toContainText("this season: 0");
  // Maya is still in the main inbox: nobody is removed.
  await expect(page.getByTestId("row-att_demo_maya")).toBeVisible();
  await q.getByRole("link", { name: "Open card" }).click();

  const panel = page.getByTestId("second-look-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("second-look-confirm")).toBeDisabled();
  await expect(page.getByTestId("second-look-restore")).toBeEnabled();
  await page.getByTestId("second-look-restore").click();
  await expect(page.getByTestId("second-look-done")).toContainText("restored to consideration");

  await page.goto("/recruiter?challenge=ch_demo_energy");
  await expect(page.getByTestId("second-look-rescued")).toContainText("this season: 1");
  await page.goto("/admin/integrations");
  await expect(page.getByTestId("console-rescued")).toContainText("1 rescued this season");
  await expect(page.getByTestId("applicant-gh_app_maya")).toContainText("active");
});

test("webhook route enforces signature, time window and idempotency over HTTP (C.2)", async ({ page }) => {
  const t = await tenant(page);
  const body = JSON.stringify({ id: "evt_http", type: "application.created", provider: "greenhouse", created_at: new Date().toISOString(), data: { application_id: "gh_app_http", job_id: "4001" } });
  const sign = (secret: string, ts: number) => `t=${ts},v1=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`;
  const now = Math.floor(Date.now() / 1000);
  const post = (sig: string) => page.request.post(`/api/webhooks/${t.id}`, { data: body, headers: { "content-type": "application/json", "x-tp-signature": sig, "idempotency-key": "evt_http" } });
  expect((await post(sign("not-the-secret", now))).status()).toBe(401);
  expect((await post(sign(t.webhookSecret, now - 600))).status()).toBe(401);
  const ok = await post(sign(t.webhookSecret, now));
  expect(ok.status()).toBe(200);
  const dup = await post(sign(t.webhookSecret, now));
  expect(await dup.json()).toMatchObject({ duplicate: true });
  await page.reload();
  const log = page.getByTestId("webhook-log");
  await expect(log.locator('[data-outcome="rejected"]')).toHaveCount(2);
  await expect(log.locator('[data-outcome="duplicate"]')).toHaveCount(1);
});

test("public API: key from the console, try-it on /developers, 401 without a key (C.4)", async ({ page }) => {
  await tenant(page);
  await page.getByTestId("create-key").click();
  const key = (await page.getByTestId("key-once").locator("code").textContent())!;
  expect(key).toMatch(/^tp_live_/);
  await page.goto("/developers");
  await expect(page.getByTestId("op-listAttempts")).toContainText("/attempts");
  await page.getByTestId("try-op").selectOption("/attempts");
  await page.getByTestId("try-send").click();
  await expect(page.getByTestId("try-status")).toContainText("401");
  await page.getByTestId("try-key").fill(key);
  await page.getByTestId("try-send").click();
  await expect(page.getByTestId("try-status")).toContainText("200");
  await expect(page.getByTestId("try-result")).toContainText("att_demo_maya");
  await expect(page.getByTestId("try-status")).toContainText("x-ratelimit-remaining");
  const spec = await page.request.get("/api/v1/openapi.json");
  expect((await spec.json()).openapi).toBe("3.1.0");
});

test("portable credential: download from results, verify, and a tampered file fails (C.9)", async ({ page }) => {
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto("/results/att_demo_maya");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("badge-download").click()]);
  const text = await readFile((await download.path())!, "utf8");
  const vc = JSON.parse(text);
  expect(vc.type).toContain("OpenBadgeCredential");

  await page.goto("/verify");
  await page.getByTestId("verify-input").fill(text);
  await page.getByTestId("verify-check").click();
  await expect(page.getByTestId("verify-result")).toHaveAttribute("data-valid", "true");
  await expect(page.getByTestId("verify-result")).toContainText("Collaboration: Strong");

  vc.credentialSubject.result[0].value = vc.credentialSubject.result[0].value === "Strong" ? "Some" : "Strong";
  await page.getByTestId("verify-input").fill(JSON.stringify(vc));
  await page.getByTestId("verify-check").click();
  await expect(page.getByTestId("verify-result")).toHaveAttribute("data-valid", "false");
  await expect(page.getByTestId("verify-result")).toContainText("changed after it was issued");
});

test("integration console is open when no console secret is set (default)", async ({ page }) => {
  await page.goto("/admin/integrations");
  await expect(page.getByTestId("integration-console")).toBeVisible();
  await expect(page.getByTestId("console-secret")).toHaveCount(0);
});
