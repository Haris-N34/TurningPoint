import { inProcessFetch } from "./ats/adapters";
import { adapterFor } from "./ats/adapters";
import { company, nextId, nowIso, type Company, type Provider, type SecondLookEntry } from "./store";
import { joinNames, skillName, strongTargets } from "./summary";

// Second Look (PRD v2 C3, C.11). If the ATS rejects an applicant at the resume stage, or nobody ever
// reviews them, and their evidence shows Strong in 2+ of the employer's target skills, they go into a
// queue with the reason. A recruiter must open the card and Restore or Confirm pass with a reason.
// Turning Point never removes anyone from consideration.

const RESUME_STAGES = /application review|resume|screen|new|applied/i;
export const NEVER_REVIEWED_DAYS = 7;

/** Check one applicant; queue them if Second Look applies. Returns the new entry, if any. */
export function evaluateSecondLook(c: Company, provider: Provider, applicantId: string, trigger: SecondLookEntry["trigger"]): SecondLookEntry | undefined {
  const a = c.ats[provider].applicants.find((x) => x.id === applicantId);
  if (!a) return undefined;
  if (trigger === "rejected_at_resume" && !(a.status === "rejected" && RESUME_STAGES.test(a.stage))) return undefined;
  if (trigger === "never_reviewed" && (a.reviewed || a.status !== "active")) return undefined;
  const invite = c.invites.find((i) => i.provider === provider && i.applicantId === applicantId && i.attemptId);
  const attempt = invite?.attemptId ? c.attempts[invite.attemptId] : undefined;
  if (!attempt) return undefined;
  const strong = strongTargets(attempt);
  if (strong.length < 2) return undefined;
  if (c.secondLook.some((e) => e.applicantId === applicantId && e.attemptId === attempt.attemptId && e.status === "queued")) return undefined;
  const lead = trigger === "rejected_at_resume" ? "Rejected at resume screen" : "Never reviewed";
  const entry: SecondLookEntry = {
    id: nextId("sl"),
    provider,
    applicantId,
    attemptId: attempt.attemptId,
    challengeId: attempt.challengeId,
    reason: `${lead}; Strong evidence in ${joinNames(strong.map(skillName))}`,
    strongSkills: strong,
    trigger,
    status: "queued",
    createdAt: nowIso(),
  };
  c.secondLook.push(entry);
  return entry;
}

/** Applicants with a finished attempt that nobody has reviewed for a week (or `days`). */
export function sweepNeverReviewed(c: Company, days = NEVER_REVIEWED_DAYS, now = Date.now()) {
  const out: SecondLookEntry[] = [];
  for (const inv of c.invites) {
    if (!inv.attemptId) continue;
    const at = c.attempts[inv.attemptId];
    if (!at || now - Date.parse(at.finishedAt) < days * 86_400_000) continue;
    const e = evaluateSecondLook(c, inv.provider, inv.applicantId, "never_reviewed");
    if (e) out.push(e);
  }
  return out;
}

export function markOpened(companyId: string, entryId: string) {
  const e = company(companyId)?.secondLook.find((x) => x.id === entryId);
  if (e && !e.openedAt) e.openedAt = nowIso();
  return e;
}

export class SecondLookError extends Error {}

/** Restore or Confirm pass. The card must have been opened; a pass needs a reason. */
export async function decideSecondLook(companyId: string, entryId: string, decision: "restore" | "confirm_pass", reason: string, origin = "") {
  const c = company(companyId);
  const e = c?.secondLook.find((x) => x.id === entryId);
  if (!c || !e) throw new SecondLookError("No such Second Look entry");
  if (e.status !== "queued") throw new SecondLookError("Already decided");
  if (!e.openedAt) throw new SecondLookError("Open the card before deciding");
  if (decision === "confirm_pass" && !reason.trim()) throw new SecondLookError("A pass needs a reason");
  e.status = decision === "restore" ? "restored" : "confirmed_pass";
  e.decidedAt = nowIso();
  e.decisionReason = reason.trim() || undefined;
  const ats = adapterFor(e.provider, companyId);
  const link = `${origin}/recruiter/card/${e.attemptId}?challenge=${e.challengeId}`;
  if (decision === "restore") {
    await inProcessFetch(
      e.provider === "greenhouse" ? `/api/mock-ats/greenhouse/${companyId}/v1/applications/${e.applicantId}` : `/api/mock-ats/workday/${companyId}/ccx/api/v1/jobApplications/${e.applicantId}`,
      { method: "PATCH", body: JSON.stringify({ status: "active", stage: "Application Review", reviewed: true }) },
    );
    await ats.postNote(e.applicantId, `Restored by Turning Point Second Look. ${e.reason}.${e.decisionReason ? ` Recruiter: ${e.decisionReason}.` : ""} Card: ${link}`);
  } else {
    await ats.postNote(e.applicantId, `Second Look reviewed; pass confirmed by a recruiter. Reason: ${e.decisionReason}. Card: ${link}`);
  }
  return e;
}

/** "Candidates rescued by Second Look this season" (for the impact dashboard, Part G). */
export function rescuedCount(entries: Pick<SecondLookEntry, "status" | "decidedAt">[], since?: string): number {
  return entries.filter((e) => e.status === "restored" && (!since || (e.decidedAt ?? "") >= since)).length;
}

export function secondLookStats(entries: SecondLookEntry[], since?: string) {
  return {
    queued: entries.filter((e) => e.status === "queued").length,
    rescued: rescuedCount(entries, since),
    confirmedPass: entries.filter((e) => e.status === "confirmed_pass").length,
  };
}
