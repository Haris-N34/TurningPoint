import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { publicSlugFor } from "@/lib/challenge/challenge";
import { DEMO_EMPLOYERS } from "@/lib/demo/seed";
import type { SkillSlug } from "@/lib/engine/skills";
import { randomToken } from "./crypto";
import { summarize, type AttemptSummary } from "./summary";

// In-process server demo store for the integration layer (PRD v2 C2, demo scope: no database).
// Lives on globalThis so every route bundle in one Node process shares it. Restarting the server
// resets it. Secrets are generated here at runtime and never written to the repo.

export const PROVIDERS = ["greenhouse", "workday"] as const;
export type Provider = (typeof PROVIDERS)[number];
export const PROVIDER_LABEL: Record<Provider, string> = { greenhouse: "Greenhouse (Mock)", workday: "Workday (Mock)" };

export type MockJob = { id: string; title: string; requisitionId: string; status: "open" | "closed" };
export type ApplicantStatus = "active" | "rejected" | "hired";
export type MockApplicant = {
  id: string;
  jobId: string;
  name: string;
  email: string;
  status: ApplicantStatus;
  stage: string;
  /** Has a person looked at this application yet? */
  reviewed: boolean;
  resumeText?: string;
  createdAt: string;
};
export type MockAts = {
  jobs: MockJob[];
  applicants: MockApplicant[];
  notes: { id: string; applicantId: string; body: string; at: string }[];
  results: { id: string; applicantId: string; body: unknown; at: string }[];
  subscriptions: { id: string; url: string; events: string[] }[];
  /** Demo control: fail the next N result posts with a 503, to show retries. */
  failNext: number;
};

export type Mapping = { jobId: string; challengeId: string; slug: string; targetSkills: SkillSlug[]; title: string };
export type Connection = { provider: Provider; connectedAt: string; mappings: Mapping[]; subscriptionId?: string };

export type WebhookEvent = {
  id: string;
  idempotencyKey?: string;
  type?: string;
  receivedAt: string;
  outcome: "processed" | "duplicate" | "rejected";
  reason?: string;
  payload: unknown;
  actions: string[];
};
export type DeliveryAttempt = { at: string; ok: boolean; status: number; error?: string; waitMs: number };
export type Delivery = {
  id: string;
  provider: Provider;
  kind: "result" | "note";
  applicantId: string;
  attemptId?: string;
  payload: unknown;
  status: "pending" | "delivered" | "failed";
  attempts: DeliveryAttempt[];
  createdAt: string;
};
export type Invite = {
  token: string;
  provider: Provider;
  applicantId: string;
  jobId: string;
  challengeId: string;
  slug: string;
  link: string;
  createdAt: string;
  attemptId?: string;
  resumeText?: string;
};
export type SimEmail = { id: string; to: string; subject: string; body: string; at: string };
export type SecondLookEntry = {
  id: string;
  provider: Provider;
  applicantId: string;
  attemptId: string;
  challengeId: string;
  reason: string;
  strongSkills: SkillSlug[];
  trigger: "rejected_at_resume" | "never_reviewed";
  status: "queued" | "restored" | "confirmed_pass";
  createdAt: string;
  openedAt?: string;
  decidedAt?: string;
  decisionReason?: string;
};
export type ApiKey = { id: string; prefix: string; hash: string; createdAt: string; revokedAt?: string };

export type Company = {
  id: string;
  name: string;
  webhookSecret: string;
  secretRotatedAt: string;
  apiKeys: ApiKey[];
  connections: Partial<Record<Provider, Connection>>;
  ats: Record<Provider, MockAts>;
  events: WebhookEvent[];
  deliveries: Delivery[];
  invites: Invite[];
  emails: SimEmail[];
  attempts: Record<string, AttemptSummary & { provider?: Provider; applicantId?: string; reportedAt: string }>;
  secondLook: SecondLookEntry[];
  rate: Record<string, { tokens: number; at: number }>;
};

type State = { companies: Record<string, Company>; seq: number };
const g = globalThis as unknown as { __tpIntegrations?: State };
const state = (): State => (g.__tpIntegrations ??= { companies: {}, seq: 0 });

export const nextId = (prefix: string) => `${prefix}_${(++state().seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nowIso = () => new Date().toISOString();

const emptyAts = (): MockAts => ({ jobs: [], applicants: [], notes: [], results: [], subscriptions: [], failNext: 0 });

export const DEMO_COMPANY = "demo";
const energy = DEMO_EMPLOYERS[0];

/** Fresh company with the demo requisitions, applicants and Maya's finished attempt. */
function seedCompany(id: string, name: string): Company {
  const t = nowIso();
  const c: Company = {
    id,
    name,
    webhookSecret: randomToken("whsec"),
    secretRotatedAt: t,
    apiKeys: [],
    connections: {},
    ats: { greenhouse: emptyAts(), workday: emptyAts() },
    events: [],
    deliveries: [],
    invites: [],
    emails: [],
    attempts: {},
    secondLook: [],
    rate: {},
  };
  c.ats.greenhouse.jobs = [
    { id: "4001", title: energy.title, requisitionId: "REQ-118", status: "open" },
    { id: "4002", title: "Member Experience Associate", requisitionId: "REQ-207", status: "open" },
  ];
  c.ats.greenhouse.applicants = [
    { id: "gh_app_maya", jobId: "4001", name: "Maya Chen", email: "maya.chen@example.com", status: "active", stage: "Application Review", reviewed: false, createdAt: t },
    { id: "gh_app_sam", jobId: "4001", name: "Sam Okafor", email: "sam.okafor@example.com", status: "active", stage: "Application Review", reviewed: true, createdAt: t },
  ];
  c.ats.workday.jobs = [{ id: "JR-3301", title: energy.title, requisitionId: "JR-3301", status: "open" }];
  c.ats.workday.applicants = [
    { id: "wd_app_lee", jobId: "JR-3301", name: "Jordan Lee", email: "jordan.lee@example.com", status: "active", stage: "Screen", reviewed: false, createdAt: t },
  ];
  // Greenhouse comes pre-connected with the energy requisition mapped, so the demo works on first load.
  c.connections.greenhouse = {
    provider: "greenhouse",
    connectedAt: t,
    subscriptionId: "sub_seed",
    mappings: [
      { jobId: "4001", challengeId: energy.id, slug: publicSlugFor(energy.id, energy.company.name, energy.title), targetSkills: [...energy.targetSkills], title: energy.title },
    ],
  };
  c.ats.greenhouse.subscriptions = [{ id: "sub_seed", url: `/api/webhooks/${id}`, events: ["application.created", "application.status_changed"] }];
  // Maya already played through an invite (the seeded card).
  const maya = CardSchema.parse(fixture);
  const token = randomToken("inv", 12);
  c.invites.push({
    token,
    provider: "greenhouse",
    applicantId: "gh_app_maya",
    jobId: "4001",
    challengeId: energy.id,
    slug: c.connections.greenhouse.mappings[0].slug,
    link: `/c/${c.connections.greenhouse.mappings[0].slug}?invite=${token}`,
    createdAt: t,
    attemptId: maya.attemptId,
  });
  c.attempts[maya.attemptId] = { ...summarize(maya, token), provider: "greenhouse", applicantId: "gh_app_maya", reportedAt: t };
  return c;
}

export function company(id = DEMO_COMPANY): Company | undefined {
  const s = state();
  if (!s.companies[id] && id === DEMO_COMPANY) s.companies[id] = seedCompany(id, "Prairie Grid Energy (fictional)");
  return s.companies[id];
}

/** A separate company (tenant) with its own secrets and seeded mock ATS. Used by tests and the console. */
export function createCompany(name = "Demo employer"): Company {
  const id = nextId("co");
  return (state().companies[id] = seedCompany(id, name));
}

export function listCompanies() {
  company(DEMO_COMPANY);
  return Object.values(state().companies);
}

/** Tests only: forget everything. */
export function resetIntegrations() {
  g.__tpIntegrations = { companies: {}, seq: 0 };
}
