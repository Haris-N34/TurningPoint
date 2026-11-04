import fixture from "@/fixtures/attempt.json";
import { getScenario } from "@/content/scenarios";
import { CardSchema } from "@/lib/card/types";
import { listChallenges, publish, saveDraft, type Challenge } from "@/lib/challenge/challenge";
import { tailorScenario } from "@/lib/challenge/tailor";
import type { Store } from "@/lib/store/store";

// Demo data: two fictional employers with published challenges, and Maya's finished card in the
// first one's inbox so the pitch can open on a real card (PRD, Demo script step 1).

export const DEMO_EMPLOYERS = [
  { id: "ch_demo_energy", company: { name: "Prairie Grid Energy (fictional)", colour: "#0f766e" }, title: "Field Operations Analyst, Summer 2027", industry: "Energy" as const, targetSkills: ["adaptability", "resilience", "prioritization", "collaboration"] as const },
  { id: "ch_demo_bank", company: { name: "Bow River Credit Union (fictional)", colour: "#1d4ed8" }, title: "Member Experience Associate", industry: "Banking" as const, targetSkills: ["resilience", "communication", "empathy"] as const },
];

export function seedDemo(s: Store, templateId = "sample"): Challenge[] {
  const base = getScenario(templateId)!;
  const out: Challenge[] = [];
  for (const e of DEMO_EMPLOYERS) {
    if (!listChallenges(s).some((c) => c.id === e.id)) {
      saveDraft(s, { id: e.id, company: e.company, title: e.title, templateId, industry: e.industry, targetSkills: [...e.targetSkills], scenario: tailorScenario(base, e.industry, e.company.name).scenario });
    }
    out.push(publish(s, e.id));
  }
  const maya = CardSchema.parse(fixture);
  if (!s.getCard(maya.attemptId)) {
    s.saveCard(maya);
    s.share(maya.attemptId, DEMO_EMPLOYERS[0].id, false);
  }
  return out;
}
