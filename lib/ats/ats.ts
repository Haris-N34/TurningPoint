import { z } from "zod";
import { identity } from "@/lib/card/inbox";
import type { Store } from "@/lib/store/store";

// Mock Greenhouse export (E5). Shortlisted candidates only, each with a link back to their card.

export const GreenhouseCandidate = z.object({
  external_id: z.string(),
  name: z.string(),
  source: z.literal("Turning Point"),
  application: z.object({ job_code: z.string(), status: z.literal("shortlisted") }),
  attachments: z.array(z.object({ type: z.literal("capability_card"), url: z.string().url() })).min(1),
  skills: z.array(z.object({ skill: z.string(), evidence: z.string() })),
});
export const GreenhousePayload = z.object({ exported_at: z.string(), job_code: z.string(), candidates: z.array(GreenhouseCandidate) });
export type GreenhousePayload = z.infer<typeof GreenhousePayload>;

export function buildExport(
  s: Store,
  c: { id: string; jobCode?: string; anonymousReview?: boolean },
  origin: string,
  now = new Date(),
): GreenhousePayload {
  const jobCode = c.jobCode ?? c.id;
  const candidates = s
    .sharesFor(c.id)
    .filter((sh) => !sh.revokedAt && s.reviewFor(sh.attemptId, c.id)?.decision === "shortlist")
    .map((sh) => s.getCard(sh.attemptId))
    .filter((card): card is NonNullable<typeof card> => !!card)
    .map((card) => ({
      external_id: card.attemptId,
      name: identity(card, c.anonymousReview ?? true, "shortlist").displayName,
      source: "Turning Point" as const,
      application: { job_code: jobCode, status: "shortlisted" as const },
      attachments: [{ type: "capability_card" as const, url: `${origin.replace(/\/$/, "")}/recruiter/card/${card.attemptId}?challenge=${c.id}` }],
      skills: card.evidence.map((e) => ({ skill: e.skill, evidence: e.level })),
    }));
  return GreenhousePayload.parse({ exported_at: now.toISOString(), job_code: jobCode, candidates });
}

/** Post to the in-app mock endpoint and keep a local log (E5.1). */
export async function sendToAts(s: Store, payload: GreenhousePayload, fetcher: typeof fetch = fetch) {
  const res = await fetcher("/api/mock-greenhouse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = (await res.json()) as { ok: boolean; received: number; error?: string };
  if (!res.ok || !body.ok) throw new Error(body.error ?? `ATS export failed (${res.status})`);
  const log = s.getJSON("ats_exports", z.array(z.object({ at: z.string(), payload: z.unknown() }))) ?? [];
  s.setJSON("ats_exports", [...log, { at: payload.exported_at, payload }]);
  return body;
}
