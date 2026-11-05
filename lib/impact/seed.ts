import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { getScenario } from "@/content/scenarios";
import { getChallenge, saveDraft, publish } from "@/lib/challenge/challenge";
import type { Store } from "@/lib/store/store";
import { DEMO_PREFIX } from "./metrics";

export const IMPACT_EMPLOYERS = [
  { id: "ch_impact_energy", company: "Prairie Grid Energy (fictional)" },
  { id: "ch_impact_credit", company: "Bow River Credit Union (fictional)" },
  { id: "ch_impact_community", company: "Foothills Community Market (fictional)" },
];

/** Explicit, deterministic synthetic cohort. Never overwrites existing data. */
export function seedImpactDemo(s: Store) {
  const base = CardSchema.parse(fixture);
  for (const employer of IMPACT_EMPLOYERS) {
    if (getChallenge(s, employer.id)) continue;
    saveDraft(s, { id: employer.id, company: { name: employer.company, colour: "#c2410c" }, title: "Community market leadership (synthetic demo)", templateId: "launch-week", industry: "Non-profit", targetSkills: base.targetSkills, scenario: getScenario("launch-week")! });
    publish(s, employer.id);
  }
  for (let i = 0; i < 200; i++) {
    const attemptId = `${DEMO_PREFIX}${String(i + 1).padStart(3, "0")}`;
    if (s.getRun(attemptId) || s.getCard(attemptId)) continue;
    const employer = IMPACT_EMPLOYERS[i % 3];
    const mode = (["text", "voice", "video"] as const)[Math.floor(i / 3) % 3];
    const adjustedTiming = i % 4 === 0;
    const finished = i % 5 !== 0;
    const date = new Date(Date.UTC(2026, 10, 1, 9, i * 15)).toISOString();
    s.saveRun({ attemptId, challengeId: employer.id, scenarioId: "launch-week", seed: attemptId, state: {}, status: finished ? "finished" : "playing", startedAt: date, practice: false, extra: { impactParticipation: { mode, adjustedTiming, ...(i % 4 !== 1 ? { optInGroup: i % 2 ? "Demo group B" : "Demo group A" } : {}) } } });
    if (!finished) continue;
    const evidence = base.evidence.map((e, j) => {
      const level = i % 11 === 0 ? "not_observed" : i % 7 === 0 ? "some" : (["strong", "some", "not_observed"] as const)[(i + j) % 3];
      return level === "not_observed" ? { skill: e.skill, level } : { ...e, level };
    });
    const card = CardSchema.parse({ ...base, attemptId, anonId: `Demo ${String(i + 1).padStart(3, "0")}`, candidate: { displayName: `Fictional candidate ${i + 1}`, verified: i % 7 !== 0 }, challenge: { id: employer.id, title: "Community market leadership (synthetic demo)", company: employer.company }, scenario: { ...base.scenario, seed: attemptId }, finishedAt: date, adjustedTiming, evidence, checkpoints: base.checkpoints.map((c) => ({ ...c, mode, media: undefined })), realStory: base.realStory ? { ...base.realStory, title: "Illustrative story from the demo fixture", witnesses: i % 4 === 0 ? [{ id: `demo-w-${i}`, relationship: "peer", status: "confirmed", skillsSeen: ["collaboration"] }] : [] } : undefined });
    s.saveCard(card);
    s.share(attemptId, employer.id, false);
    if (i % 6 !== 0) s.review({ attemptId, challengeId: employer.id, decision: (mode === "video" ? i % 4 === 0 : i % 2 === 0) ? "shortlist" : "hold" });
  }
}
