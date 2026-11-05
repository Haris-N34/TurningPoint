import { handleMockAts } from "./mockServer";
import type { Provider } from "../store";

// ATS adapter interface (PRD v2 C2, C.1). One shape for every ATS; each adapter speaks its provider's dialect.

export type AtsJob = { id: string; title: string; requisitionId?: string; status: "open" | "closed" };
export type AtsApplicant = { id: string; jobId: string; name: string; email: string; status: "active" | "rejected" | "hired"; stage: string; reviewed: boolean; resumeText?: string };
export type AtsResult = {
  attemptId: string;
  cardUrl: string;
  summary: string;
  levels: Record<string, string>;
  finalScore: { value: number; breakdown: { skill: string; weight: number; game: number | null; resume: number | null; combined: number; confidence: string }[]; configVersion: string };
};

export interface AtsAdapter {
  provider: Provider;
  label: string;
  mock: true;
  listJobs(): Promise<AtsJob[]>;
  getJob(id: string): Promise<AtsJob | undefined>;
  listApplicants(jobId: string): Promise<AtsApplicant[]>;
  postResult(applicantId: string, result: AtsResult): Promise<{ id: string }>;
  postNote(applicantId: string, body: string): Promise<{ id: string }>;
  getStatus(applicantId: string): Promise<Pick<AtsApplicant, "status" | "stage" | "reviewed">>;
  subscribeWebhooks(url: string, events: string[]): Promise<{ id: string }>;
}

export type Fetcher = (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<{ status: number; json(): Promise<unknown> }>;

export class AtsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the mock ATS in the same process (no network hop). Same handler as the HTTP route. */
export const inProcessFetch: Fetcher = async (url, init = {}) => {
  const u = new URL(url, "http://local");
  const [, , , provider, companyId, ...path] = u.pathname.split("/"); // /api/mock-ats/<provider>/<company>/...
  const r = await handleMockAts(provider as Provider, companyId, init.method ?? "GET", path, u.searchParams, init.body ? JSON.parse(init.body) : undefined);
  return { status: r.status, json: async () => r.json };
};

async function call<T>(f: Fetcher, url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await f(url, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json", authorization: "Basic bW9jazo=" } });
  const json = (await res.json()) as T & { message?: string };
  if (res.status >= 400) throw new AtsError(res.status, json?.message ?? `ATS error ${res.status}`);
  return json;
}

type GhApp = { id: string; candidate: { first_name: string; last_name: string; email_addresses: { value: string }[] }; status: AtsApplicant["status"]; current_stage: { name: string }; jobs: { id: number | string }[]; reviewed: boolean; attachments: { type: string; content?: string }[] };
type GhJob = { id: number | string; name: string; requisition_id: string; status: "open" | "closed" };

export function greenhouseAdapter(companyId: string, f: Fetcher = inProcessFetch, base = "/api/mock-ats"): AtsAdapter {
  const root = `${base}/greenhouse/${companyId}/v1`;
  const job = (j: GhJob): AtsJob => ({ id: String(j.id), title: j.name, requisitionId: j.requisition_id, status: j.status });
  const app = (a: GhApp): AtsApplicant => ({
    id: a.id,
    jobId: String(a.jobs[0]?.id ?? ""),
    name: `${a.candidate.first_name} ${a.candidate.last_name}`.trim(),
    email: a.candidate.email_addresses[0]?.value ?? "",
    status: a.status,
    stage: a.current_stage.name,
    reviewed: a.reviewed,
    resumeText: a.attachments.find((x) => x.type === "resume")?.content,
  });
  return {
    provider: "greenhouse",
    label: "Greenhouse (Mock)",
    mock: true,
    listJobs: async () => (await call<GhJob[]>(f, `${root}/jobs`)).map(job),
    getJob: async (id) => call<GhJob>(f, `${root}/jobs/${id}`).then(job, () => undefined),
    listApplicants: async (jobId) => (await call<GhApp[]>(f, `${root}/applications?job_id=${encodeURIComponent(jobId)}`)).map(app),
    postResult: (id, r) =>
      call(f, `${root}/applications/${id}/scorecards`, "POST", {
        interview: "Turning Point challenge",
        submitted_by: "Turning Point",
        attributes: Object.entries(r.levels).map(([name, rating]) => ({ name, type: "Skill", rating })),
        external_link: r.cardUrl,
        final_score: r.finalScore,
        summary: r.summary,
        attempt_id: r.attemptId,
      }),
    postNote: (id, body) => call(f, `${root}/applications/${id}/activity_feed/notes`, "POST", { body, visibility: "private" }),
    getStatus: async (id) => {
      const a = app(await call<GhApp>(f, `${root}/applications/${id}`));
      return { status: a.status, stage: a.stage, reviewed: a.reviewed };
    },
    subscribeWebhooks: (url, events) => call(f, `${root}/webhooks`, "POST", { url, events }),
  };
}

type WdApp = { id: string; candidate: { descriptor: string; email: string }; jobRequisition: { id: string }; status: { descriptor: string }; stage: { descriptor: string }; reviewed: boolean; resume?: { text: string } };
type WdJob = { id: string; descriptor: string; status: { descriptor: string } };
type WdList<T> = { total: number; data: T[] };

export function workdayAdapter(companyId: string, f: Fetcher = inProcessFetch, base = "/api/mock-ats"): AtsAdapter {
  const root = `${base}/workday/${companyId}/ccx/api/v1`;
  const job = (j: WdJob): AtsJob => ({ id: j.id, title: j.descriptor, requisitionId: j.id, status: j.status.descriptor === "Open" ? "open" : "closed" });
  const app = (a: WdApp): AtsApplicant => ({
    id: a.id,
    jobId: a.jobRequisition.id,
    name: a.candidate.descriptor,
    email: a.candidate.email,
    status: a.status.descriptor.toLowerCase() as AtsApplicant["status"],
    stage: a.stage.descriptor,
    reviewed: a.reviewed,
    resumeText: a.resume?.text,
  });
  return {
    provider: "workday",
    label: "Workday (Mock)",
    mock: true,
    listJobs: async () => (await call<WdList<WdJob>>(f, `${root}/jobRequisitions`)).data.map(job),
    getJob: async (id) => call<WdJob>(f, `${root}/jobRequisitions/${id}`).then(job, () => undefined),
    listApplicants: async (jobId) => (await call<WdList<WdApp>>(f, `${root}/jobApplications?jobRequisition=${encodeURIComponent(jobId)}`)).data.map(app),
    postResult: (id, r) =>
      call(f, `${root}/jobApplications/${id}/assessments`, "POST", {
        assessmentName: "Turning Point challenge",
        externalLink: r.cardUrl,
        skillResults: Object.entries(r.levels).map(([skill, level]) => ({ skill, level })),
        finalScore: r.finalScore,
        comment: r.summary,
        attemptId: r.attemptId,
      }),
    postNote: (id, body) => call(f, `${root}/jobApplications/${id}/comments`, "POST", { comment: body }),
    getStatus: async (id) => {
      const a = app(await call<WdApp>(f, `${root}/jobApplications/${id}`));
      return { status: a.status, stage: a.stage, reviewed: a.reviewed };
    },
    subscribeWebhooks: (url, events) => call(f, `${root}/subscriptions`, "POST", { url, events }),
  };
}

export function adapterFor(provider: Provider, companyId: string, f: Fetcher = inProcessFetch): AtsAdapter {
  return provider === "greenhouse" ? greenhouseAdapter(companyId, f) : workdayAdapter(companyId, f);
}
