import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { SKILL_SLUGS } from "@/lib/engine/skills";
import { adapterFor } from "./ats/adapters";
import { handleMockAts } from "./ats/mockServer";
import { createApiKey, revokeApiKey } from "./api";
import { randomToken, sha256hex } from "./crypto";
import { reportAttempt, resend } from "./outbound";
import { decideSecondLook, markOpened, SecondLookError, secondLookStats, sweepNeverReviewed } from "./secondLook";
import { company, createCompany, nowIso, PROVIDER_LABEL, PROVIDERS, type Company, type Provider } from "./store";

// Internal endpoints behind /api/integrations/... for the integration console (C.10), the results page
// (outbound report, ATS resume intake) and the recruiter's Second Look queue (C.11). Demo: no auth.

export type Out = { status: number; json: unknown };
const ok = (json: unknown, status = 200): Out => ({ status, json });
const bad = (status: number, error: string): Out => ({ status, json: { error } });

const Prov = z.enum(PROVIDERS);
const MapBody = z.object({ provider: Prov, jobId: z.string(), challengeId: z.string(), slug: z.string(), title: z.string(), targetSkills: z.array(z.enum(SKILL_SLUGS)).min(1) });

const appPath = (p: Provider) => (p === "greenhouse" ? ["v1", "applications"] : ["ccx", "api", "v1", "jobApplications"]);

/** Everything the console shows. Secrets are masked; resume text is never included. */
export async function consoleState(c: Company) {
  const jobs: Record<string, unknown> = {};
  for (const p of PROVIDERS) {
    const ats = adapterFor(p, c.id);
    const list = await ats.listJobs();
    jobs[p] = await Promise.all(list.map(async (j) => ({ ...j, applicants: (await ats.listApplicants(j.id)).map(({ resumeText, ...a }) => ({ ...a, hasResume: !!resumeText })) })));
  }
  return {
    company: { id: c.id, name: c.name },
    providers: PROVIDERS.map((p) => ({ provider: p, label: PROVIDER_LABEL[p], connected: !!c.connections[p], connection: c.connections[p] ?? null, failNext: c.ats[p].failNext })),
    jobs,
    webhookUrl: `/api/webhooks/${c.id}`,
    webhookSecret: `${c.webhookSecret.slice(0, 10)}…`,
    secretRotatedAt: c.secretRotatedAt,
    apiKeys: c.apiKeys.map(({ hash: _h, ...k }) => (void _h, k)),
    events: c.events.slice(0, 50),
    deliveries: c.deliveries.slice(0, 50),
    emails: c.emails.slice(0, 20),
    invites: c.invites.map(({ resumeText, ...i }) => ({ ...i, hasResume: !!resumeText })),
    secondLook: c.secondLook,
    stats: secondLookStats(c.secondLook),
  };
}

/**
 * Never behind the console secret: the routes a candidate's browser calls (report a finished attempt, look up an
 * invite), the read-only Second Look queue the recruiter screens show (ids, reasons and skill names, no personal
 * details), and the lock status itself, so the console can ask for the secret without a failed request first.
 */
const OPEN_ROUTES = (method: string, path: string[]) =>
  (method === "POST" && path.join("/") === "attempts") ||
  (method === "GET" && path[0] === "invites" && !!path[1]) ||
  (method === "GET" && path.length === 1 && (path[0] === "second-look" || path[0] === "lock"));

/**
 * Optional console lock (QA night): with TP_CONSOLE_SECRET set (a public deploy), every console route needs the
 * same value in the x-tp-console-secret header. Unset (the local demo), the console stays open.
 */
export function consoleAllowed(method: string, path: string[], given: string | null | undefined, secret = process.env.TP_CONSOLE_SECRET): boolean {
  if (!secret || OPEN_ROUTES(method, path)) return true;
  if (!given) return false;
  const a = Buffer.from(sha256hex(given), "hex");
  const b = Buffer.from(sha256hex(secret), "hex");
  return timingSafeEqual(a, b);
}

export async function handleIntegrations(method: string, path: string[], query: URLSearchParams, body: unknown, origin: string, consoleSecret?: string | null): Promise<Out> {
  if (!consoleAllowed(method, path, consoleSecret)) return bad(401, "Console secret required");
  const route = `${method} ${path.join("/")}`;
  if (route === "GET lock") return ok({ locked: !!process.env.TP_CONSOLE_SECRET });
  const b = (body ?? {}) as Record<string, unknown>;
  if (route === "POST companies") {
    const c = createCompany(typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, 80) : "Demo employer");
    // The secret is shown once, at creation, so a test or an external system can sign webhooks.
    return ok({ id: c.id, name: c.name, webhookSecret: c.webhookSecret }, 201);
  }
  const c = company(query.get("company") ?? String(b.company ?? "demo"));
  if (!c) return bad(404, "Unknown company");

  try {
    switch (true) {
      case route === "GET state":
        return ok(await consoleState(c));
      case route === "POST connect": {
        const p = Prov.parse(b.provider);
        if (!c.connections[p]) {
          const sub = await adapterFor(p, c.id).subscribeWebhooks(`/api/webhooks/${c.id}`, ["application.created", "application.status_changed"]);
          c.connections[p] = { provider: p, connectedAt: nowIso(), mappings: [], subscriptionId: sub.id };
        }
        return ok(c.connections[p]);
      }
      case route === "POST disconnect": {
        const p = Prov.parse(b.provider);
        const sub = c.connections[p]?.subscriptionId;
        c.ats[p].subscriptions = c.ats[p].subscriptions.filter((s) => s.id !== sub);
        delete c.connections[p];
        return ok({ ok: true });
      }
      case route === "POST map": {
        const m = MapBody.parse(b);
        const conn = c.connections[m.provider];
        if (!conn) return bad(409, "Connect this ATS first");
        conn.mappings = [...conn.mappings.filter((x) => x.jobId !== m.jobId), { jobId: m.jobId, challengeId: m.challengeId, slug: m.slug, title: m.title, targetSkills: m.targetSkills }];
        return ok(conn);
      }
      case route === "POST unmap": {
        const p = Prov.parse(b.provider);
        const conn = c.connections[p];
        if (conn) conn.mappings = conn.mappings.filter((x) => x.jobId !== b.jobId);
        return ok({ ok: true });
      }
      case route === "POST attempts":
        return ok(await reportAttempt(c.id, b.summary, origin));
      case method === "GET" && path[0] === "invites" && !!path[1]: {
        const inv = c.invites.find((i) => i.token === path[1]);
        if (!inv) return bad(404, "Unknown invite");
        return ok({ challengeId: inv.challengeId, slug: inv.slug, provider: inv.provider, providerLabel: PROVIDER_LABEL[inv.provider], resumeText: inv.resumeText ?? null });
      }
      case method === "POST" && path[0] === "deliveries" && path[2] === "resend":
        return ok(await resend(c.id, path[1]));
      case route === "POST keys":
        return ok(createApiKey(c, typeof b.label === "string" ? b.label : undefined), 201);
      case method === "POST" && path[0] === "keys" && path[2] === "revoke":
        return ok(revokeApiKey(c, path[1]));
      case route === "POST secret/rotate":
        c.webhookSecret = randomToken("whsec");
        c.secretRotatedAt = nowIso();
        return ok({ webhookSecret: c.webhookSecret, rotatedAt: c.secretRotatedAt });
      case route === "GET second-look": {
        const ch = query.get("challenge");
        return ok({ entries: c.secondLook.filter((e) => !ch || e.challengeId === ch), stats: secondLookStats(c.secondLook, query.get("since") ?? undefined) });
      }
      case method === "POST" && path[0] === "second-look" && path[2] === "open":
        return ok(markOpened(c.id, path[1]) ?? null);
      case method === "POST" && path[0] === "second-look" && path[2] === "decide": {
        const d = z.object({ decision: z.enum(["restore", "confirm_pass"]), reason: z.string().max(500).default("") }).parse(b);
        return ok(await decideSecondLook(c.id, path[1], d.decision, d.reason, origin));
      }
      case route === "POST second-look/sweep":
        return ok(sweepNeverReviewed(c, typeof b.days === "number" ? b.days : undefined));
      case route === "POST simulate": {
        // Demo buttons: act inside the mock ATS, which then fires real signed webhooks at us.
        const p = Prov.parse(b.provider);
        if (b.action === "apply")
          return ok((await handleMockAts(p, c.id, "POST", appPath(p), new URLSearchParams(), { job_id: b.jobId, jobRequisition: b.jobId, name: b.name, email: b.email, resume_text: b.resumeText })).json);
        if (b.action === "reject" || b.action === "activate")
          return ok((await handleMockAts(p, c.id, "PATCH", [...appPath(p), String(b.applicantId)], new URLSearchParams(), { status: b.action === "reject" ? "rejected" : "active", stage: b.stage })).json);
        if (b.action === "failNext") return ok((await handleMockAts(p, c.id, "POST", ["_control"], new URLSearchParams(), { failNext: b.count ?? 3 })).json);
        return bad(422, "Unknown action");
      }
    }
  } catch (e) {
    if (e instanceof z.ZodError) return bad(422, e.issues.map((i) => i.message).join("; "));
    if (e instanceof SecondLookError) return bad(409, e.message);
    return bad(500, e instanceof Error ? e.message : "Error");
  }
  return bad(404, `No route ${route}`);
}
