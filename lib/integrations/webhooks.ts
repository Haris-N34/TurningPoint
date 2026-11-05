import { z } from "zod";
import { maskEmail, randomToken, verifyWebhook } from "./crypto";
import { evaluateSecondLook } from "./secondLook";
import { company, nextId, nowIso, PROVIDERS, type WebhookEvent } from "./store";

// Inbound ATS webhooks (PRD v2 C2, C.2). HMAC-SHA256 with a per-company secret, 5-minute timestamp
// window, idempotency keys in webhook_events. application.created invites the applicant (simulated
// email); application.status_changed to rejected runs the Second Look check.

export const WebhookEnvelope = z.object({
  id: z.string().min(1),
  type: z.enum(["application.created", "application.status_changed"]),
  provider: z.enum(PROVIDERS),
  created_at: z.string(),
  data: z.object({
    application_id: z.string().min(1),
    job_id: z.string().min(1),
    status: z.enum(["active", "rejected", "hired"]).optional(),
    previous_status: z.string().optional(),
    stage: z.string().optional(),
    reviewed: z.boolean().optional(),
    candidate: z.object({ name: z.string(), email: z.string() }).optional(),
    resume_text: z.string().max(20_000).optional(),
  }),
});
export type WebhookEnvelope = z.infer<typeof WebhookEnvelope>;

export type WebhookResult = { status: number; body: Record<string, unknown> };

/** What the console log keeps of a payload: emails masked, resume text replaced by its length. */
export function logSafe(payload: unknown): unknown {
  if (typeof payload === "string") return payload.replace(/[^\s"'<>@]+@[^\s"'<>@]+\.[a-z]{2,}/gi, (m) => maskEmail(m));
  if (Array.isArray(payload)) return payload.map(logSafe);
  if (!payload || typeof payload !== "object") return payload;
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([k, v]) =>
      k === "resume_text" && typeof v === "string" ? [k, `[resume held, ${v.length} characters]`] : [k, logSafe(v)],
    ),
  );
}

export async function receiveWebhook(companyId: string, rawBody: string, headers: Headers, nowS = Math.floor(Date.now() / 1000)): Promise<WebhookResult> {
  const c = company(companyId);
  if (!c) return { status: 404, body: { error: "Unknown company" } };
  const log = (e: Omit<WebhookEvent, "id" | "receivedAt">) => {
    const entry = { id: nextId("whe"), receivedAt: nowIso(), ...e, payload: logSafe(e.payload) };
    c.events.unshift(entry);
    return entry;
  };
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = rawBody.slice(0, 500);
  }

  const sig = verifyWebhook(c.webhookSecret, headers.get("x-tp-signature"), rawBody, nowS);
  if (!sig.ok) {
    log({ outcome: "rejected", reason: sig.reason, payload, actions: [] });
    return { status: 401, body: { error: sig.reason } };
  }
  const parsed = WebhookEnvelope.safeParse(payload);
  if (!parsed.success) {
    log({ outcome: "rejected", reason: "invalid_payload", payload, actions: [] });
    return { status: 422, body: { error: "invalid_payload", issues: parsed.error.issues.map((i) => i.message) } };
  }
  const ev = parsed.data;
  const key = headers.get("idempotency-key") ?? ev.id;
  if (c.events.some((e) => e.idempotencyKey === key && e.outcome === "processed")) {
    log({ idempotencyKey: key, type: ev.type, outcome: "duplicate", payload, actions: [] });
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  const actions: string[] = [];
  if (ev.type === "application.created") {
    const conn = c.connections[ev.provider];
    const m = conn?.mappings.find((x) => x.jobId === ev.data.job_id);
    if (!m) actions.push(`No challenge mapped to job ${ev.data.job_id}; nothing sent`);
    else {
      const token = randomToken("inv", 12);
      const link = `/c/${m.slug}?invite=${token}`;
      c.invites.push({ token, provider: ev.provider, applicantId: ev.data.application_id, jobId: ev.data.job_id, challengeId: m.challengeId, slug: m.slug, link, createdAt: nowIso(), resumeText: ev.data.resume_text });
      const to = maskEmail(ev.data.candidate?.email ?? "applicant@example.com");
      c.emails.unshift({
        id: nextId("eml"),
        to,
        subject: `${c.name}: your Turning Point challenge for ${m.title}`,
        body: `Thanks for applying. Instead of judging you on a resume alone, we'd like to see how you handle it when the plan breaks. It takes about 20 minutes, and you can answer by video, voice or text. Start here: ${link}`,
        at: nowIso(),
      });
      actions.push(`Invited applicant ${ev.data.application_id} to ${m.challengeId} (simulated email to ${to})`);
      if (ev.data.resume_text) actions.push("Resume held for the candidate to review and consent to");
    }
  } else if (ev.type === "application.status_changed") {
    const a = c.ats[ev.provider].applicants.find((x) => x.id === ev.data.application_id);
    if (a && ev.data.status) a.status = ev.data.status;
    if (ev.data.status === "rejected") {
      const e = evaluateSecondLook(c, ev.provider, ev.data.application_id, "rejected_at_resume");
      actions.push(e ? `Second Look: ${e.reason}` : "Rejected; Second Look does not apply");
    } else actions.push(`Status is now ${ev.data.status ?? "unchanged"}`);
  }
  log({ idempotencyKey: key, type: ev.type, outcome: "processed", payload, actions });
  return { status: 200, body: { ok: true, actions } };
}
