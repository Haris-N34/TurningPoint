import type { SkillSlug } from "@/lib/engine/skills";
import type { Card, Evidence } from "./types";

// Recruiter inbox data (E2, E6, E8). Haris's inbox UI renders these rows; all rules live here.

export type Decision = "shortlist" | "hold" | "pass";
export type Status = "new" | Decision | "withdrawn";
export type Level = Evidence["level"];

export type InboxRow = {
  attemptId: string;
  /** Name only after shortlisting when anonymous review is on (E6.1). */
  displayName: string;
  anonymous: boolean;
  university?: string;
  date: string;
  status: Status;
  topSkills: { skill: SkillSlug; level: Level }[];
  levels: Partial<Record<SkillSlug, Level>>;
  witnessConfirmed: boolean;
  reused: boolean;
  /** Which of this employer's skills a reused card covers (E8.1). */
  covers: SkillSlug[];
  withdrawn: boolean;
};

export const LEVEL_RANK: Record<Level, number> = { strong: 3, some: 2, needs_review: 1, not_observed: 0 };

export type ShareInfo = { reused: boolean; revokedAt?: string };
export type ReviewInfo = { decision: Decision };

/** Decide what a recruiter may see of a candidate's identity. */
export function identity(card: Card, anonymousReview: boolean, decision?: Decision) {
  const reveal = !anonymousReview || decision === "shortlist";
  return reveal
    ? { displayName: card.candidate.displayName || card.anonId, university: card.candidate.university, anonymous: false }
    : { displayName: card.anonId, university: undefined, anonymous: true };
}

export function toRow(card: Card, employerSkills: SkillSlug[], share: ShareInfo | undefined, review: ReviewInfo | undefined, anonymousReview = true): InboxRow {
  const levels: Partial<Record<SkillSlug, Level>> = {};
  for (const e of card.evidence) levels[e.skill as SkillSlug] = e.level;
  const withdrawn = !!share?.revokedAt;
  const topSkills = card.evidence
    .filter((e) => e.level === "strong" || e.level === "some")
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])
    .slice(0, 3)
    .map((e) => ({ skill: e.skill as SkillSlug, level: e.level }));
  const covers = employerSkills.filter((s) => card.targetSkills.includes(s));
  return {
    attemptId: card.attemptId,
    ...identity(card, anonymousReview, review?.decision),
    date: card.finishedAt,
    status: withdrawn ? "withdrawn" : review?.decision ?? "new",
    topSkills,
    levels,
    witnessConfirmed: !!card.realStory?.witnesses.some((w) => w.status === "confirmed"),
    reused: !!share?.reused,
    covers,
    withdrawn,
  };
}

export type InboxFilter = {
  skill?: SkillSlug;
  minLevel?: Level;
  status?: Status;
  witness?: boolean;
};

export type InboxSort = { by: "date" } | { by: "skill"; skill: SkillSlug };

/** Filter and sort rows (E2.2). Withdrawn cards stay listed but sink to the bottom. */
export function queryInbox(rows: InboxRow[], f: InboxFilter = {}, sort: InboxSort = { by: "date" }): InboxRow[] {
  const out = rows.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (f.witness !== undefined && r.witnessConfirmed !== f.witness) return false;
    if (f.skill && f.minLevel && LEVEL_RANK[r.levels[f.skill] ?? "not_observed"] < LEVEL_RANK[f.minLevel]) return false;
    return true;
  });
  const key = (r: InboxRow) => (sort.by === "skill" ? LEVEL_RANK[r.levels[sort.skill] ?? "not_observed"] : Date.parse(r.date));
  return out.sort((a, b) => Number(a.withdrawn) - Number(b.withdrawn) || key(b) - key(a) || b.date.localeCompare(a.date));
}
