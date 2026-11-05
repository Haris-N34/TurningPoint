import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { adapterFor, type AtsAdapter } from "./ats/adapters";
import { fireWebhook, handleMockAts } from "./ats/mockServer";
import { signWebhook } from "./crypto";
import { backoffMs, reportAttempt, resend } from "./outbound";
import { decideSecondLook, markOpened, rescuedCount, sweepNeverReviewed } from "./secondLook";
import { company, createCompany, PROVIDERS } from "./store";
import { summarize } from "./summary";
import { receiveWebhook } from "./webhooks";

const noSleep = { sleep: async () => {} };
const maya = CardSchema.parse(fixture);

describe.each(PROVIDERS)("ATS adapter contract: %s (C.1)", (provider) => {
  const setup = () => {
    const c = createCompany();
    return { c, ats: adapterFor(provider, c.id) as AtsAdapter };
  };
  it("is marked as a mock", () => {
    const { ats } = setup();
    expect(ats.mock).toBe(true);
    expect(ats.label).toMatch(/\(Mock\)/);
  });
  it("lists and gets jobs in one normalized shape", async () => {
    const { ats } = setup();
    const jobs = await ats.listJobs();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0]).toEqual({ id: expect.any(String), title: expect.any(String), requisitionId: expect.any(String), status: "open" });
    expect(await ats.getJob(jobs[0].id)).toEqual(jobs[0]);
    expect(await ats.getJob("nope")).toBeUndefined();
  });
  it("lists applicants per job and reads their status", async () => {
    const { ats } = setup();
    const [job] = await ats.listJobs();
    const apps = await ats.listApplicants(job.id);
    expect(apps.length).toBeGreaterThan(0);
    expect(apps[0]).toMatchObject({ id: expect.any(String), jobId: job.id, name: expect.any(String), status: "active" });
    expect(await ats.getStatus(apps[0].id)).toEqual({ status: "active", stage: expect.any(String), reviewed: expect.any(Boolean) });
  });
  it("posts a result and a note, and subscribes to webhooks", async () => {
    const { c, ats } = setup();
    const [job] = await ats.listJobs();
    const [app] = await ats.listApplicants(job.id);
    const s = summarize(maya);
    await ats.postResult(app.id, { attemptId: s.attemptId, cardUrl: "https://x/card", summary: s.summary, levels: s.levels as Record<string, string>, finalScore: s.finalScore });
    await ats.postNote(app.id, "hello");
    expect(c.ats[provider].results).toHaveLength(1);
    expect(c.ats[provider].notes[0].body).toBe("hello");
    const sub = await ats.subscribeWebhooks("/api/webhooks/x", ["application.created"]);
    expect(sub.id).toMatch(/^sub_/);
  });
  it("speaks its provider's dialect on the wire", async () => {
    const { c } = setup();
    const r = await handleMockAts(provider, c.id, "GET", provider === "greenhouse" ? ["v1", "jobs"] : ["ccx", "api", "v1", "jobRequisitions"], new URLSearchParams(), undefined);
    if (provider === "greenhouse") expect(Array.isArray(r.json)).toBe(true);
    else expect(r.json).toMatchObject({ total: expect.any(Number), data: expect.any(Array) });
  });
});

describe("inbound webhooks (C.2)", () => {
  const body = (id = "evt_1") =>
    JSON.stringify({ id, type: "application.created", provider: "greenhouse", created_at: new Date().toISOString(), data: { application_id: "gh_app_x", job_id: "4001", candidate: { name: "A B", email: "ab@example.com" } } });
  const headers = (sig: string, key?: string) => new Headers({ "x-tp-signature": sig, ...(key ? { "idempotency-key": key } : {}) });

  it("rejects a bad signature", async () => {
    const c = createCompany();
    const b = body();
    const r = await receiveWebhook(c.id, b, headers(signWebhook("wrong-secret", b)));
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("bad_signature");
    expect(c.invites).toHaveLength(1); // only Maya's seeded invite
  });
  it("rejects a missing signature and a tampered body", async () => {
    const c = createCompany();
    const b = body();
    expect((await receiveWebhook(c.id, b, new Headers())).status).toBe(401);
    const sig = signWebhook(c.webhookSecret, b);
    expect((await receiveWebhook(c.id, b.replace("4001", "4002"), headers(sig))).status).toBe(401);
  });
  it("rejects a replay outside the 5-minute window", async () => {
    const c = createCompany();
    const b = body();
    const old = Math.floor(Date.now() / 1000) - 6 * 60;
    const r = await receiveWebhook(c.id, b, headers(signWebhook(c.webhookSecret, b, old)));
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("stale_timestamp");
  });
  it("processes a duplicate only once (idempotency key)", async () => {
    const c = createCompany();
    const b = body("evt_dup");
    const sig = signWebhook(c.webhookSecret, b);
    const first = await receiveWebhook(c.id, b, headers(sig, "evt_dup"));
    const second = await receiveWebhook(c.id, b, headers(sig, "evt_dup"));
    expect(first.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(c.invites.filter((i) => i.applicantId === "gh_app_x")).toHaveLength(1);
    expect(c.events.map((e) => e.outcome)).toEqual(["duplicate", "processed"]);
  });
  it("application.created invites the applicant with a unique link and a simulated email", async () => {
    const c = createCompany();
    const r = await handleMockAts("greenhouse", c.id, "POST", ["v1", "applications"], new URLSearchParams(), { job_id: "4001", name: "Ada Obi", email: "ada@example.com", resume_text: "Ada Obi\nExperience\nLead at Acme\n- Led a team" });
    expect(r.status).toBe(201);
    const inv = c.invites.at(-1)!;
    expect(inv.link).toMatch(new RegExp(`^/c/${c.connections.greenhouse!.mappings[0].slug}\\?invite=inv_`));
    expect(inv.resumeText).toContain("Led a team");
    expect(c.emails[0].to).toBe("a***@example.com");
    expect(c.emails[0].body).toContain(inv.link);
    expect(c.events[0]).toMatchObject({ outcome: "processed", type: "application.created" });
  });
  it("a job with no mapped challenge sends nothing", async () => {
    const c = createCompany();
    await handleMockAts("greenhouse", c.id, "POST", ["v1", "applications"], new URLSearchParams(), { job_id: "4002", name: "No Map" });
    expect(c.invites).toHaveLength(1);
    expect(c.events[0].actions[0]).toMatch(/No challenge mapped/);
  });
});

describe("outbound results (C.3)", () => {
  const invited = async () => {
    const c = createCompany();
    await handleMockAts("greenhouse", c.id, "POST", ["v1", "applications"], new URLSearchParams(), { job_id: "4001", name: "Ada Obi", email: "ada@example.com" });
    const inv = c.invites.at(-1)!;
    const s = summarize({ ...maya, attemptId: "att_ada" }, inv.token);
    return { c, inv, s };
  };
  it("posts per-skill levels, card link, Final score with breakdown and summary to the ATS", async () => {
    const { c, inv, s } = await invited();
    const r = await reportAttempt(c.id, s, "https://tp.example", noSleep);
    expect(r.delivery?.status).toBe("delivered");
    const posted = c.ats.greenhouse.results.at(-1)!;
    expect(posted.applicantId).toBe(inv.applicantId);
    expect(posted.body).toMatchObject({
      external_link: "https://tp.example/recruiter/card/att_ada?challenge=ch_demo_energy",
      final_score: { value: expect.any(Number), breakdown: expect.any(Array), configVersion: expect.any(String) },
      summary: expect.stringMatching(/Strong evidence in/),
    });
    expect(JSON.stringify(posted.body)).not.toMatch(/Maya|Chen|Calgary/);
  });
  it("retries with exponential backoff and logs every call", async () => {
    const { c, s } = await invited();
    c.ats.greenhouse.failNext = 2;
    const waits: number[] = [];
    const r = await reportAttempt(c.id, s, "", { sleep: async (ms) => void waits.push(ms) });
    expect(r.delivery?.status).toBe("delivered");
    expect(r.delivery?.attempts.map((a) => a.ok)).toEqual([false, false, true]);
    expect(waits).toEqual([backoffMs(1), backoffMs(2)]);
    expect(waits[1]).toBe(waits[0] * 2);
  });
  it("marks a delivery failed after the last attempt, and the console can re-send it", async () => {
    const { c, s } = await invited();
    c.ats.greenhouse.failNext = 10;
    const r = await reportAttempt(c.id, s, "", noSleep);
    expect(r.delivery?.status).toBe("failed");
    expect(r.delivery?.attempts).toHaveLength(4);
    c.ats.greenhouse.failNext = 0;
    const again = await resend(c.id, r.delivery!.id, noSleep);
    expect(again.status).toBe("delivered");
    expect(again.attempts).toHaveLength(5);
  });
});

describe("Second Look (C.11)", () => {
  it("a resume-stage rejection with Strong in 2+ target skills enters the queue with the reason", async () => {
    const c = createCompany();
    await handleMockAts("greenhouse", c.id, "PATCH", ["v1", "applications", "gh_app_maya"], new URLSearchParams(), { status: "rejected" });
    expect(c.secondLook).toHaveLength(1);
    expect(c.secondLook[0]).toMatchObject({ status: "queued", trigger: "rejected_at_resume", attemptId: maya.attemptId });
    expect(c.secondLook[0].reason).toBe("Rejected at resume screen; Strong evidence in Prioritization and Collaboration");
  });
  it("does not apply when evidence is weaker or the rejection came after interviews", async () => {
    const c = createCompany();
    c.attempts[maya.attemptId].levels = { ...c.attempts[maya.attemptId].levels, prioritization: "some" };
    await handleMockAts("greenhouse", c.id, "PATCH", ["v1", "applications", "gh_app_maya"], new URLSearchParams(), { status: "rejected" });
    expect(c.secondLook).toHaveLength(0);
    const d = createCompany();
    await handleMockAts("greenhouse", d.id, "PATCH", ["v1", "applications", "gh_app_maya"], new URLSearchParams(), { status: "rejected", stage: "Final Interview" });
    expect(d.secondLook).toHaveLength(0);
  });
  it("never-reviewed applicants with strong evidence are swept in after a week", () => {
    const c = createCompany();
    expect(sweepNeverReviewed(c, 7, Date.parse(maya.finishedAt) + 86_400_000)).toHaveLength(0);
    const out = sweepNeverReviewed(c, 7, Date.parse(maya.finishedAt) + 8 * 86_400_000);
    expect(out[0].reason).toMatch(/^Never reviewed; Strong evidence in/);
  });
  it("the recruiter must open the card, and a pass needs a reason; restore writes back to the ATS", async () => {
    const c = createCompany();
    await fireWebhook(c.id, "greenhouse", "noop", {});
    await handleMockAts("greenhouse", c.id, "PATCH", ["v1", "applications", "gh_app_maya"], new URLSearchParams(), { status: "rejected" });
    const e = c.secondLook[0];
    await expect(decideSecondLook(c.id, e.id, "restore", "")).rejects.toThrow(/Open the card/);
    markOpened(c.id, e.id);
    await expect(decideSecondLook(c.id, e.id, "confirm_pass", " ")).rejects.toThrow(/reason/);
    await decideSecondLook(c.id, e.id, "restore", "Strong prioritization evidence", "https://tp.example");
    expect(c.ats.greenhouse.applicants.find((a) => a.id === "gh_app_maya")?.status).toBe("active");
    expect(c.ats.greenhouse.notes.at(-1)?.body).toMatch(/Restored by Turning Point Second Look/);
    expect(rescuedCount(c.secondLook)).toBe(1);
  });
  it("never removes anyone: confirm pass keeps the entry and the applicant", async () => {
    const c = createCompany();
    await handleMockAts("greenhouse", c.id, "PATCH", ["v1", "applications", "gh_app_maya"], new URLSearchParams(), { status: "rejected" });
    const e = c.secondLook[0];
    markOpened(c.id, e.id);
    await decideSecondLook(c.id, e.id, "confirm_pass", "Role requires a licence");
    expect(c.secondLook).toHaveLength(1);
    expect(c.ats.greenhouse.applicants.some((a) => a.id === "gh_app_maya")).toBe(true);
    expect(rescuedCount(c.secondLook)).toBe(0);
  });
  it("rescued count only counts restores in the season", () => {
    expect(rescuedCount([{ status: "restored", decidedAt: "2026-09-01" }, { status: "restored", decidedAt: "2026-03-01" }, { status: "queued" }], "2026-08-01")).toBe(1);
  });
});

describe("demo company", () => {
  it("is seeded with greenhouse connected and Maya's attempt linked", () => {
    const c = company()!;
    expect(c.connections.greenhouse?.mappings[0].challengeId).toBe("ch_demo_energy");
    expect(c.attempts[maya.attemptId].applicantId).toBe("gh_app_maya");
    expect(c.webhookSecret).toMatch(/^whsec_/);
  });
});
