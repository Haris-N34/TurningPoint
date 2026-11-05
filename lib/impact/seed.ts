import fixture from "@/fixtures/attempt.json";
import { CardSchema, PASS_REASONS, type Card } from "@/lib/card/types";
import { getScenario } from "@/content/scenarios";
import { getChallenge, saveDraft, publish } from "@/lib/challenge/challenge";
import type { Store } from "@/lib/store/store";
import { DEMO_PREFIX } from "./metrics";
import { ANSWER_VARIANTS } from "./answers";

// E7.4: 200 synthetic candidates across 3 fictional employers. Feeds the recruiter inbox,
// the fairness analytics and /admin/impact. Deterministic: the same seed gives the same cohort.
// Names are clearly synthetic ("Synthetic candidate 001"), never real people.

export const IMPACT_EMPLOYERS = [
  { id: "ch_impact_energy", company: "Prairie Grid Energy (fictional)", colour: "#0f766e", title: "Field Operations Analyst (synthetic demo)" },
  { id: "ch_impact_credit", company: "Bow River Credit Union (fictional)", colour: "#1d4ed8", title: "Member Experience Associate (synthetic demo)" },
  { id: "ch_impact_community", company: "Foothills Community Market (fictional)", colour: "#c2410c", title: "Community Programs Coordinator (synthetic demo)" },
] as const;

export const IMPACT_COHORT_SIZE = 200;
/** Opt-in demographic labels are abstract on purpose: no real group is implied. */
export const OPT_IN_GROUPS = ["Opt-in group A", "Opt-in group B", "Opt-in group C"] as const;

/** Small seeded PRNG (mulberry32) so the cohort is identical on every machine. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const syntheticName = (i: number) => `Synthetic candidate ${String(i + 1).padStart(3, "0")}`;
export const impactAttemptId = (i: number) => `${DEMO_PREFIX}${String(i + 1).padStart(3, "0")}`;

type Mode = "video" | "voice" | "text";
export type SyntheticCandidate = {
  i: number;
  attemptId: string;
  employerId: string;
  mode: Mode;
  adjustedTiming: boolean;
  optInGroup?: string;
  finished: boolean;
  verified: boolean;
  witnessConfirmed: boolean;
  levels: Card["evidence"][number]["level"][];
  decision?: "shortlist" | "hold" | "pass";
  date: string;
};

/**
 * Pure cohort generator. Shortlist decisions stand in for human reviewers. A shortlist gap for
 * video answers and for one opt-in group is planted on purpose so the four-fifths warning has
 * something to show; demographics never feed evidence levels or any score.
 */
export function syntheticCohort(seed = 2026): SyntheticCandidate[] {
  const rnd = prng(seed);
  const out: SyntheticCandidate[] = [];
  const quota = new Map<string, number>();
  for (let i = 0; i < IMPACT_COHORT_SIZE; i++) {
    const r = Array.from({ length: 12 }, rnd);
    const mode: Mode = r[0] < 0.45 ? "text" : r[0] < 0.75 ? "voice" : "video";
    const adjustedTiming = r[1] < 0.15;
    const optInGroup = r[2] < 0.7 ? OPT_IN_GROUPS[Math.floor(r[3] * 3)] : undefined;
    const finished = i % 5 !== 0;
    const levels = [r[4], r[5], r[6], r[7]].map((x) => (x < 0.3 ? "strong" : x < 0.75 ? "some" : "not_observed") as SyntheticCandidate["levels"][number]);
    let decision: SyntheticCandidate["decision"];
    if (finished && r[8] < 0.85) {
      // Simulated reviewers shortlist about 40% of each bucket, with planted gaps for video and one
      // opt-in group. A running quota per bucket (mode, group, timing) keeps the rates steady at small sizes.
      const key = `${mode}|${optInGroup ?? "-"}|${adjustedTiming}`;
      const rate = 0.4 * (mode === "video" ? 0.6 : 1) * (optInGroup === OPT_IN_GROUPS[2] ? 0.6 : 1);
      const acc = (quota.get(key) ?? 0.5) + rate;
      quota.set(key, acc >= 1 ? acc - 1 : acc);
      decision = acc >= 1 ? "shortlist" : r[10] < 0.6 ? "hold" : "pass";
    }
    out.push({
      i,
      attemptId: impactAttemptId(i),
      employerId: IMPACT_EMPLOYERS[i % 3].id,
      mode,
      adjustedTiming,
      optInGroup,
      finished,
      verified: r[11] < 0.85,
      witnessConfirmed: r[11] > 0.3 && r[11] < 0.6,
      levels,
      decision,
      date: new Date(Date.UTC(2026, 9, 1 + (i % 28), 9 + (i % 9), (i * 7) % 60)).toISOString(),
    });
  }
  return out;
}

/** Which answer variant each candidate gave per checkpoint. Own PRNG stream, so the cohort above never shifts. */
export function answerPicks(seed = 2026): number[][] {
  const rnd = prng(seed ^ 0x9e3779b9);
  return Array.from({ length: IMPACT_COHORT_SIZE }, () => ANSWER_VARIANTS.map((v) => Math.floor(rnd() * v.variants.length)));
}

/** Checkpoints and evidence for one synthetic candidate. Every quote is checked as an exact substring (G1). */
export function syntheticAnswers(base: Card, picks: number[], levels: SyntheticCandidate["levels"], mode: Mode) {
  const checkpoints = base.checkpoints.map((cp) => {
    const k = ANSWER_VARIANTS.findIndex((v) => v.checkpointId === cp.id);
    const pick = k < 0 ? 0 : picks[k];
    const text = k < 0 || pick === 0 ? cp.transcript : { text: ANSWER_VARIANTS[k].variants[pick].text, words: [], status: "ready" as const };
    return { ...cp, mode, media: undefined, transcript: text };
  });
  const evidence = base.evidence.map((e, j) => {
    const level = levels[j];
    const k = ANSWER_VARIANTS.findIndex((v) => v.skill === e.skill);
    if (level === "not_observed" || k < 0) return { skill: e.skill, level };
    const v = ANSWER_VARIANTS[k];
    const cp = checkpoints.find((c) => c.id === v.checkpointId)!;
    const { quote, sentence } = v.variants[picks[k]];
    const at = cp.transcript.text.indexOf(quote);
    if (at < 0) throw new Error(`Seed quote not in transcript: ${quote}`);
    const len = cp.transcript.text.length;
    const startS = Math.round((cp.durationS * at) / len * 100) / 100;
    const endS = Math.round((cp.durationS * (at + quote.length)) / len * 100) / 100;
    return { ...e, level, sentence, source: { type: "clip" as const, checkpointId: cp.id, quote, startS, endS } };
  });
  return { checkpoints, evidence };
}

/** Explicit, deterministic synthetic cohort. Never overwrites existing data. */
export function seedImpactDemo(s: Store) {
  const base = CardSchema.parse(fixture);
  for (const employer of IMPACT_EMPLOYERS) {
    if (getChallenge(s, employer.id)) continue;
    saveDraft(s, { id: employer.id, company: { name: employer.company, colour: employer.colour }, title: employer.title, templateId: "launch-week", industry: "Non-profit", targetSkills: base.targetSkills, scenario: getScenario("launch-week")! });
    publish(s, employer.id);
  }
  const picks = answerPicks();
  for (const c of syntheticCohort()) {
    if (s.getRun(c.attemptId) || s.getCard(c.attemptId)) continue;
    const employer = IMPACT_EMPLOYERS.find((e) => e.id === c.employerId)!;
    // Opt-in demographics live only on the run, for aggregate fairness checks. Never on the card.
    s.saveRun({ attemptId: c.attemptId, challengeId: employer.id, scenarioId: "launch-week", seed: c.attemptId, state: {}, status: c.finished ? "finished" : "playing", startedAt: c.date, practice: false, extra: { impactParticipation: { mode: c.mode, adjustedTiming: c.adjustedTiming, ...(c.optInGroup ? { optInGroup: c.optInGroup } : {}) } } });
    if (!c.finished) continue;
    const { checkpoints, evidence } = syntheticAnswers(base, picks[c.i], c.levels, c.mode);
    const n = String(c.i + 1).padStart(3, "0");
    const card = CardSchema.parse({
      ...base,
      attemptId: c.attemptId,
      anonId: `Candidate D${n}`,
      candidate: { displayName: syntheticName(c.i), verified: c.verified },
      challenge: { id: employer.id, title: employer.title, company: employer.company },
      scenario: { ...base.scenario, seed: c.attemptId },
      finishedAt: c.date,
      adjustedTiming: c.adjustedTiming,
      evidence,
      checkpoints,
      realStory: base.realStory ? { ...base.realStory, title: "Illustrative story from the demo fixture", witnesses: c.witnessConfirmed ? [{ id: `demo-w-${c.i}`, relationship: "peer", status: "confirmed", skillsSeen: ["collaboration"] }] : [] } : undefined,
      review: undefined,
    });
    s.saveCard(card);
    s.share(c.attemptId, employer.id, false);
    if (c.decision) s.review({ attemptId: c.attemptId, challengeId: employer.id, decision: c.decision, ...(c.decision === "pass" ? { reason: PASS_REASONS[0] } : {}) });
  }
}
