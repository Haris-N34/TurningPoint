import { z } from "zod";
import { SKILLS } from "@/lib/engine/skills";
import type { Store } from "@/lib/store/store";
import type { Card } from "@/lib/card/types";
import { getChallenge } from "@/lib/challenge/challenge";
import { listReviewSessions, listSurveyResponses, median } from "./events";

export const DEMO_PREFIX = "att_impact_demo_";
export const Participation = z.object({ mode: z.enum(["video", "voice", "text"]), adjustedTiming: z.boolean(), optInGroup: z.string().optional() });
export type Source = "all" | "live" | "demo";
type Group = { label: string; started: number; finished: number; shortlisted: number; completion: number | null; rate: number | null; warning: boolean };
const fraction = (a: number, b: number) => b ? a / b : null;

/** Aggregate local evidence, never infer identities, protected traits or time spent. */
export function impactReport(s: Store, challengeId?: string, source: Source = "all") {
  // Demo inbox peers (lib/demo/peers.ts) are scenery for the recruiter screen, not part of any cohort.
  const include = (id: string) => !id.startsWith("att_demo_peer_") && (source === "all" || id.startsWith(DEMO_PREFIX) === (source === "demo"));
  const shares = s.listShares().filter((x) => !x.revokedAt);
  const visible = (c: Card) => !challengeId || c.challenge.id === challengeId || shares.some((x) => x.attemptId === c.attemptId && x.challengeId === challengeId);
  const cards = s.listCards().filter((c) => include(c.attemptId) && visible(c));
  const runs = s.listRuns().filter((r) => !r.practice && include(r.attemptId) && (!challengeId || r.challengeId === challengeId || cards.some((c) => c.attemptId === r.attemptId)));
  const ids = new Set([...runs.map((r) => r.attemptId), ...cards.map((c) => c.attemptId)]);
  const finishedIds = new Set(cards.map((c) => c.attemptId));
  const reviewMap = new Map<string, ReturnType<Store["listReviews"]>[number]>();
  for (const r of s.listReviews().filter((r) => finishedIds.has(r.attemptId) && (!challengeId || r.challengeId === challengeId)).sort((a,b) => a.at.localeCompare(b.at))) reviewMap.set(r.attemptId, r);
  const participation = new Map(runs.flatMap((r) => {
    const parsed = Participation.safeParse(r.extra.impactParticipation);
    return parsed.success ? [[r.attemptId, parsed.data] as const] : [];
  }));
  const groups = (kind: "mode" | "timing" | "demographic"): Group[] => {
    const groups = new Map<string, Group>();
    for (const id of ids) {
      const p = participation.get(id);
      const card = cards.find((c) => c.attemptId === id);
      const recordedModes = new Set(card?.checkpoints.map((c) => c.mode) ?? []);
      const observedMode = recordedModes.size === 1 ? [...recordedModes][0] : recordedModes.size > 1 ? "Mixed modes" : "Unknown mode";
      const label = kind === "mode" ? p?.mode ?? observedMode : kind === "timing" ? (p ? p.adjustedTiming : card?.adjustedTiming) === undefined ? "Unknown timing" : (p ? p.adjustedTiming : card?.adjustedTiming) ? "Adjusted timing" : "Standard timing" : p?.optInGroup;
      if (!label) continue;
      const g = groups.get(label) ?? { label, started: 0, finished: 0, shortlisted: 0, completion: null, rate: null, warning: false };
      g.started++;
      if (finishedIds.has(id)) g.finished++;
      if (reviewMap.get(id)?.decision === "shortlist") g.shortlisted++;
      groups.set(label, g);
    }
    const out = [...groups.values()];
    for (const g of out) { g.completion = fraction(g.finished,g.started); g.rate = g.finished >= 10 && !g.label.startsWith("Unknown") ? fraction(g.shortlisted,g.finished) : null; }
    const best = Math.max(0, ...out.map((g) => g.rate ?? 0));
    for (const g of out) g.warning = g.rate !== null && best > 0 && g.rate / best < 0.8;
    return out.sort((a,b) => a.label.localeCompare(b.label));
  };
  const consistency = cards.flatMap((c) => c.consistency ?? []);
  const strong = cards.filter((c) => c.evidence.some((e) => e.level === "strong")).length;
  const stories = cards.filter((c) => c.realStory);
  const confirmed = stories.filter((c) => c.realStory!.witnesses.some((w) => w.status === "confirmed")).length;
  // Recruiter minutes: visible card time per candidate, summed over sessions (G.1). Never decision timestamps.
  const perCandidate = new Map<string, number>();
  for (const x of listReviewSessions(s)) if (finishedIds.has(x.attemptId) && (!challengeId || x.challengeId === challengeId)) perCandidate.set(x.attemptId, (perCandidate.get(x.attemptId) ?? 0) + x.ms);
  const minutes = median([...perCandidate.values()].map((ms) => ms / 60_000));
  const resumes = cards.filter((c) => c.resume);
  const claims = resumes.flatMap((c) => c.resume!.claims);
  const survey = listSurveyResponses(s).filter((r) => finishedIds.has(r.attemptId));
  const practiced = runs.filter((r) => (r.extra.impactDemo as { practicedFirst?: boolean } | undefined)?.practicedFirst === true).length;
  return {
    started: ids.size, finished: cards.length, reviewed: reviewMap.size,
    shortlisted: [...reviewMap.values()].filter((r) => r.decision === "shortlist").length,
    employers: new Set([...cards.map((c) => c.challenge.id), ...runs.map((r) => r.challengeId)]).size,
    strongRate: fraction(strong, cards.length), reviewedRate: fraction(reviewMap.size, cards.length), witnessRate: fraction(confirmed, stories.length), stories: stories.length,
    reviewMinutes: minutes === null ? null : Math.round(minutes * 10) / 10, timedCandidates: perCandidate.size,
    resume: { cards: resumes.length, claims: claims.length, backed: claims.filter((c) => c.backed).length, rate: fraction(claims.filter((c) => c.backed).length, claims.length) },
    survey: { responses: survey.length, mean: survey.length ? Math.round((survey.reduce((a, r) => a + r.rating, 0) / survey.length) * 10) / 10 : null, counts: [1, 2, 3, 4, 5].map((n) => survey.filter((r) => r.rating === n).length), responseRate: fraction(survey.length, cards.length) },
    /** Candidates whose run records a practice round first. Live practice runs are not linked to attempts. */
    practicedFirst: { count: practiced, rate: practiced ? fraction(practiced, ids.size) : null },
    consistencyChecks: consistency.length, consistencyRate: fraction(consistency.filter((note) => note.consistent).length, consistency.length),
    skills: SKILLS.map((skill) => ({ ...skill, strong: cards.filter((c) => c.evidence.some((e) => e.skill === skill.slug && e.level === "strong")).length, some: cards.filter((c) => c.evidence.some((e) => e.skill === skill.slug && e.level === "some")).length, total: cards.filter((c) => c.targetSkills.includes(skill.slug)).length })),
    groups: groups("mode"), timing: groups("timing"), demographics: groups("demographic"),
  };
}

/** E7.1: started, finished and shortlisted per challenge. A shared card counts in each challenge it was shared with. */
export function funnelByChallenge(s: Store, source: Source = "all") {
  // Demo inbox peers (lib/demo/peers.ts) are scenery for the recruiter screen, not part of any cohort.
  const include = (id: string) => !id.startsWith("att_demo_peer_") && (source === "all" || id.startsWith(DEMO_PREFIX) === (source === "demo"));
  const names = new Map<string, { company: string; title: string }>();
  for (const c of s.listCards().filter((c) => include(c.attemptId))) names.set(c.challenge.id, { company: c.challenge.company, title: c.challenge.title });
  const ids = new Set([...names.keys(), ...s.listRuns().filter((r) => !r.practice && include(r.attemptId)).map((r) => r.challengeId), ...s.listShares().filter((x) => !x.revokedAt && include(x.attemptId)).map((x) => x.challengeId)]);
  return [...ids].sort().map((challengeId) => {
    const r = impactReport(s, challengeId, source);
    const ch = getChallenge(s, challengeId);
    return { challengeId, company: ch?.company.name ?? names.get(challengeId)?.company ?? challengeId, title: ch?.title ?? names.get(challengeId)?.title ?? "", started: r.started, finished: r.finished, shortlisted: r.shortlisted };
  }).filter((f) => f.started > 0);
}
