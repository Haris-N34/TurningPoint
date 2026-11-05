import type { SkillSlug } from "@/lib/engine/skills";
import type { Store } from "@/lib/store/store";
import { identity, queryInbox, toRow, type Decision, type InboxFilter, type InboxSort } from "./inbox";
import type { Card } from "./types";

// Recruiter data APIs over the local store (AI.3). Haris's inbox and card screens call these.

export function inboxFor(s: Store, challengeId: string, employerSkills: SkillSlug[], opts: { anonymous?: boolean; filter?: InboxFilter; sort?: InboxSort } = {}) {
  const anonymous = opts.anonymous ?? true;
  const rows = s
    .sharesFor(challengeId)
    .map((sh) => {
      const card = s.getCard(sh.attemptId);
      return card ? toRow(card, employerSkills, sh, s.reviewFor(sh.attemptId, challengeId), anonymous) : undefined;
    })
    .filter((r): r is NonNullable<typeof r> => !!r);
  return queryInbox(rows, opts.filter, opts.sort);
}

export type RecruiterCardView =
  | { status: "withdrawn" }
  | { status: "ok"; card: Card; name: ReturnType<typeof identity>; hiddenClipIds: string[] };

/** The card as a recruiter may see it: identity per anonymous review, hidden clips removed, withdrawn cards blocked (C7.2, C7.4). */
export function cardFor(s: Store, attemptId: string, challengeId: string, anonymous = true): RecruiterCardView | undefined {
  const share = s.sharesFor(challengeId).find((x) => x.attemptId === attemptId);
  if (!share) return undefined;
  if (share.revokedAt) return { status: "withdrawn" };
  const card = s.getCard(attemptId);
  if (!card) return undefined;
  const review = s.reviewFor(attemptId, challengeId);
  const hidden = card.checkpoints.filter((c) => c.hidden).map((c) => c.id);
  const visible: Card = {
    ...card,
    // Accommodations (extra time, turn-based play) are the candidate's business, never the employer's.
    adjustedTiming: false,
    checkpoints: card.checkpoints.map((c) => (c.hidden ? { ...c, media: undefined } : c)),
  };
  return { status: "ok", card: visible, name: identity(card, anonymous, review?.decision), hiddenClipIds: hidden };
}

/** Shortlist, hold or pass. A pass needs a reason (E3.7); the store enforces it. */
export function decide(s: Store, attemptId: string, challengeId: string, decision: Decision, reason?: string, note?: string) {
  return s.review({ attemptId, challengeId, decision, reason, note });
}
