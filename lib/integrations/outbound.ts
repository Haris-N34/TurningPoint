import { adapterFor, AtsError, type AtsResult } from "./ats/adapters";
import { evaluateSecondLook } from "./secondLook";
import { company, nextId, nowIso, type Company, type Delivery, type Provider } from "./store";
import { AttemptSummarySchema, type AttemptSummary } from "./summary";

// Outbound results (PRD v2 C2, C.3): on attempt finish, post a scorecard-style result to the ATS.
// Exponential backoff; every call is logged on the delivery and shown in the console.

export type RetryOpts = { maxAttempts?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> };
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const backoffMs = (attempt: number, base = 100) => base * 2 ** (attempt - 1);

async function run(c: Company, d: Delivery, opts: RetryOpts) {
  const { maxAttempts = 4, baseMs = 100, sleep = defaultSleep } = opts;
  const ats = adapterFor(d.provider, c.id);
  d.status = "pending";
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      if (d.kind === "result") await ats.postResult(d.applicantId, d.payload as AtsResult);
      else await ats.postNote(d.applicantId, String(d.payload));
      d.attempts.push({ at: nowIso(), ok: true, status: 201, waitMs: 0 });
      d.status = "delivered";
      return d;
    } catch (e) {
      const wait = i < maxAttempts ? backoffMs(i, baseMs) : 0;
      d.attempts.push({ at: nowIso(), ok: false, status: e instanceof AtsError ? e.status : 0, error: e instanceof Error ? e.message : String(e), waitMs: wait });
      if (wait) await sleep(wait);
    }
  }
  d.status = "failed";
  return d;
}

export async function deliver(c: Company, provider: Provider, kind: Delivery["kind"], applicantId: string, payload: unknown, opts: RetryOpts & { attemptId?: string } = {}) {
  const d: Delivery = { id: nextId("dlv"), provider, kind, applicantId, attemptId: opts.attemptId, payload, status: "pending", attempts: [], createdAt: nowIso() };
  c.deliveries.unshift(d);
  return run(c, d, opts);
}

/** Console "Re-send" for a failed delivery. Adds attempts to the same log entry. */
export async function resend(companyId: string, deliveryId: string, opts: RetryOpts = {}) {
  const c = company(companyId);
  const d = c?.deliveries.find((x) => x.id === deliveryId);
  if (!c || !d) throw new Error("No such delivery");
  if (d.status === "delivered") return d;
  return run(c, d, opts);
}

export function resultPayload(s: AttemptSummary, origin: string): AtsResult {
  return {
    attemptId: s.attemptId,
    cardUrl: `${origin.replace(/\/$/, "")}${s.cardPath}`,
    summary: s.summary,
    levels: Object.fromEntries(Object.entries(s.levels)),
    finalScore: { value: s.finalScore.value, breakdown: s.finalScore.breakdown, configVersion: s.finalScore.configVersion },
  };
}

/**
 * Called when an attempt finishes (from the results page). Stores the summary, links it to the ATS
 * applicant if the candidate came through an invite, posts the result, then checks Second Look.
 */
export async function reportAttempt(companyId: string, raw: unknown, origin: string, opts: RetryOpts = {}) {
  const c = company(companyId);
  if (!c) throw new Error("Unknown company");
  const s = AttemptSummarySchema.parse(raw);
  const invite = s.inviteToken ? c.invites.find((i) => i.token === s.inviteToken) : undefined;
  const prev = c.attempts[s.attemptId];
  c.attempts[s.attemptId] = { ...s, provider: invite?.provider ?? prev?.provider, applicantId: invite?.applicantId ?? prev?.applicantId, reportedAt: nowIso() };
  if (!invite) return { stored: true, delivery: undefined, secondLook: undefined };
  invite.attemptId = s.attemptId;
  // Only post once per attempt; re-sends go through the console.
  const already = c.deliveries.find((d) => d.attemptId === s.attemptId && d.kind === "result");
  const delivery = already ?? (await deliver(c, invite.provider, "result", invite.applicantId, resultPayload(s, origin), { ...opts, attemptId: s.attemptId }));
  const secondLook = evaluateSecondLook(c, invite.provider, invite.applicantId, "rejected_at_resume");
  return { stored: true, delivery, secondLook };
}
