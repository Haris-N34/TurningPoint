import { signWebhook } from "../crypto";
import { company, nextId, nowIso, type MockApplicant, type MockAts, type Provider } from "../store";
import { receiveWebhook } from "../webhooks";

// Our own mock ATS servers (PRD v2 C2): a Harvest-shaped Greenhouse and a Workday-shaped API.
// Served over HTTP at /api/mock-ats/<provider>/<company>/..., and called in-process by the adapters.
// Clearly mocks: nothing here talks to a real ATS.

export type MockResponse = { status: number; json: unknown };
const ok = (json: unknown, status = 200): MockResponse => ({ status, json });
const err = (status: number, message: string): MockResponse => ({ status, json: { message } });

// Provider-shaped serializers.
const gh = {
  job: (j: MockAts["jobs"][number]) => ({ id: Number(j.id) || j.id, name: j.title, requisition_id: j.requisitionId, status: j.status }),
  app: (a: MockApplicant) => {
    const [first, ...rest] = a.name.split(" ");
    return {
      id: a.id,
      candidate: { first_name: first, last_name: rest.join(" "), email_addresses: [{ value: a.email, type: "personal" }] },
      status: a.status,
      current_stage: { name: a.stage },
      jobs: [{ id: Number(a.jobId) || a.jobId }],
      applied_at: a.createdAt,
      last_activity_at: a.createdAt,
      reviewed: a.reviewed,
      attachments: a.resumeText ? [{ type: "resume", filename: "resume.txt", content: a.resumeText }] : [],
    };
  },
};
const wd = {
  job: (j: MockAts["jobs"][number]) => ({ id: j.id, descriptor: j.title, jobPostingTitle: j.title, status: { descriptor: j.status === "open" ? "Open" : "Closed" } }),
  app: (a: MockApplicant) => ({
    id: a.id,
    candidate: { descriptor: a.name, email: a.email },
    jobRequisition: { id: a.jobId },
    status: { descriptor: a.status === "active" ? "Active" : a.status === "rejected" ? "Rejected" : "Hired" },
    stage: { descriptor: a.stage },
    reviewed: a.reviewed,
    resume: a.resumeText ? { text: a.resumeText } : undefined,
  }),
};

/** Sign and deliver an event to every subscriber, exactly as an ATS would POST to /api/webhooks/<company>. */
export async function fireWebhook(companyId: string, provider: Provider, type: string, data: Record<string, unknown>) {
  const c = company(companyId);
  if (!c) return [];
  const subs = c.ats[provider].subscriptions.filter((s) => s.events.includes(type));
  const out = [];
  for (const _ of subs) {
    void _;
    const id = nextId("evt");
    const body = JSON.stringify({ id, type, provider, created_at: nowIso(), data });
    const headers = new Headers({ "content-type": "application/json", "x-tp-signature": signWebhook(c.webhookSecret, body), "idempotency-key": id });
    out.push(await receiveWebhook(companyId, body, headers));
  }
  return out;
}

export async function handleMockAts(provider: Provider, companyId: string, method: string, path: string[], query: URLSearchParams, body: unknown): Promise<MockResponse> {
  const c = company(companyId);
  if (!c) return err(404, "Unknown tenant");
  const ats = c.ats[provider];
  const route = `${method} ${path.join("/")}`;
  const b = (body ?? {}) as Record<string, unknown>;
  const findApp = (id: string) => ats.applicants.find((a) => a.id === id);

  // Same operations, provider-shaped paths.
  const P: { jobs: string; apps: string; result: string; note: string; subs: string; app: (a: MockApplicant) => unknown; job: (j: MockAts["jobs"][number]) => unknown } =
    provider === "greenhouse"
      ? { jobs: "v1/jobs", apps: "v1/applications", result: "scorecards", note: "activity_feed/notes", subs: "v1/webhooks", app: gh.app, job: gh.job }
      : { jobs: "ccx/api/v1/jobRequisitions", apps: "ccx/api/v1/jobApplications", result: "assessments", note: "comments", subs: "ccx/api/v1/subscriptions", app: wd.app, job: wd.job };
  const wrap = (items: unknown[]) => (provider === "greenhouse" ? items : { total: items.length, data: items });
  const p = path.join("/");

  if (method === "GET" && p === P.jobs) return ok(wrap(ats.jobs.map(P.job)));
  if (method === "GET" && p.startsWith(`${P.jobs}/`)) {
    const j = ats.jobs.find((x) => x.id === path.at(-1));
    return j ? ok(P.job(j)) : err(404, "Job not found");
  }
  if (method === "GET" && p === P.apps) {
    const job = query.get(provider === "greenhouse" ? "job_id" : "jobRequisition");
    return ok(wrap(ats.applicants.filter((a) => !job || a.jobId === job).map(P.app)));
  }
  if (method === "POST" && p === P.subs) {
    const url = String(b.url ?? "");
    const events = Array.isArray(b.events) ? (b.events as string[]) : [];
    if (!url || !events.length) return err(422, "url and events are required");
    const sub = { id: nextId("sub"), url, events };
    ats.subscriptions.push(sub);
    return ok(sub, 201);
  }
  // Demo controls (not part of either real API): create an applicant, change status, force failures.
  if (method === "POST" && p === P.apps) {
    const jobId = String(b.job_id ?? b.jobRequisition ?? "");
    if (!ats.jobs.some((j) => j.id === jobId)) return err(422, "Unknown job");
    const a: MockApplicant = {
      id: nextId(provider === "greenhouse" ? "gh_app" : "wd_app"),
      jobId,
      name: String(b.name ?? "New Applicant"),
      email: String(b.email ?? "applicant@example.com"),
      status: "active",
      stage: "Application Review",
      reviewed: false,
      resumeText: typeof b.resume_text === "string" ? b.resume_text : undefined,
      createdAt: nowIso(),
    };
    ats.applicants.push(a);
    const deliveries = await fireWebhook(companyId, provider, "application.created", {
      application_id: a.id,
      job_id: a.jobId,
      candidate: { name: a.name, email: a.email },
      ...(a.resumeText ? { resume_text: a.resumeText } : {}),
    });
    return ok({ application: P.app(a), webhooks: deliveries.map((d) => d.status) }, 201);
  }
  if (method === "POST" && p === "_control") {
    ats.failNext = Math.max(0, Number(b.failNext ?? 0));
    return ok({ failNext: ats.failNext });
  }

  if (p.startsWith(`${P.apps}/`)) {
    const [id, ...rest] = p.slice(P.apps.length + 1).split("/");
    const tail = rest.join("/");
    const a = findApp(id);
    if (!a) return err(404, "Application not found");
    if (method === "GET" && tail === "") return ok(P.app(a));
    if (method === "PATCH" && tail === "") {
      const status = String(b.status ?? "");
      if (!["active", "rejected", "hired"].includes(status)) return err(422, "status must be active, rejected or hired");
      const prev = a.status;
      a.status = status as MockApplicant["status"];
      if (typeof b.stage === "string") a.stage = b.stage;
      if (b.reviewed !== undefined) a.reviewed = !!b.reviewed;
      const deliveries = await fireWebhook(companyId, provider, "application.status_changed", {
        application_id: a.id,
        job_id: a.jobId,
        status: a.status,
        previous_status: prev,
        stage: a.stage,
        reviewed: a.reviewed,
      });
      return ok({ application: P.app(a), webhooks: deliveries.map((d) => d.status) });
    }
    if (method === "POST" && tail === P.result) {
      if (ats.failNext > 0) {
        ats.failNext--;
        return err(503, "Mock ATS temporarily unavailable");
      }
      const r = { id: nextId("res"), applicantId: a.id, body, at: nowIso() };
      ats.results.push(r);
      return ok({ id: r.id }, 201);
    }
    if (method === "POST" && tail === P.note) {
      const n = { id: nextId("note"), applicantId: a.id, body: String(b.body ?? b.comment ?? ""), at: nowIso() };
      ats.notes.push(n);
      return ok({ id: n.id }, 201);
    }
  }
  return err(404, `No route ${route}`);
}
