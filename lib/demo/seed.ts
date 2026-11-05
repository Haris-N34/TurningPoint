import { z } from "zod";
import { hashSeed } from "@/lib/engine/seed";
import { WITNESS_TTL_DAYS, WitnessRecordSchema, type WitnessRecord } from "@/lib/witness/witness";
import fixture from "@/fixtures/attempt.json";
import { getScenario } from "@/content/scenarios";
import { CardSchema } from "@/lib/card/types";
import { listChallenges, publish, saveDraft, type Challenge } from "@/lib/challenge/challenge";
import { diffMap, mapForTemplate, tailorMap } from "@/lib/challenge/mapTailor";
import { tailorScenario } from "@/lib/challenge/tailor";
import type { Store } from "@/lib/store/store";
import { cardConsistencyInput, checkConsistency } from "@/lib/ai/services/consistency";
import { preparePublishedContent } from "@/lib/ai/services/publish";
import { optionsOf } from "@/lib/card/build";
import { seedPeers } from "./peers";

// Demo data: two fictional employers with published challenges, and Maya's finished card in the
// first one's inbox so the pitch can open on a real card (PRD, Demo script step 1).

export const DEMO_EMPLOYERS = [
  { id: "ch_demo_energy", company: { name: "Prairie Grid Energy (fictional)", colour: "#0f766e" }, title: "Field Operations Analyst, Summer 2027", industry: "Energy" as const, targetSkills: ["adaptability", "resilience", "prioritization", "collaboration"] as const },
  { id: "ch_demo_bank", company: { name: "Bow River Credit Union (fictional)", colour: "#1d4ed8" }, title: "Member Experience Associate", industry: "Banking" as const, targetSkills: ["resilience", "communication", "empathy"] as const },
];

export function seedDemo(s: Store, templateId = "launch-week"): Challenge[] {
  const base = getScenario(templateId)!;
  const map = mapForTemplate(templateId)?.map;
  const out: Challenge[] = [];
  for (const e of DEMO_EMPLOYERS) {
    if (!listChallenges(s).some((c) => c.id === e.id)) {
      saveDraft(s, { id: e.id, company: e.company, title: e.title, templateId, industry: e.industry, targetSkills: [...e.targetSkills], scenario: tailorScenario(base, e.industry, e.company.name).scenario, mapOverrides: map && diffMap(map, tailorMap(map, e.industry, e.company.name).map) });
    }
    const c = publish(s, e.id);
    // Publish-time AI (B.3): dialogue variants cached with each demo challenge.
    preparePublishedContent(s, c);
    out.push(c);
  }
  const maya = CardSchema.parse(fixture);
  // Said vs did for the demo card, from the same checker real runs use (context, never scored).
  maya.consistency ??= checkConsistency(cardConsistencyInput(maya, (id) => optionsOf(base, id), { name: maya.candidate.displayName, university: maya.candidate.university }));
  if (!s.getCard(maya.attemptId)) {
    s.saveCard(maya);
    s.share(maya.attemptId, DEMO_EMPLOYERS[0].id, false);
  }
  seedWitnessRecords(s, maya);
  // Synthetic peers so the inbox reads like a real list (clearly labelled, excluded from impact numbers).
  seedPeers(s, { id: DEMO_EMPLOYERS[0].id, title: DEMO_EMPLOYERS[0].title, company: DEMO_EMPLOYERS[0].company.name });
  return out;
}

/** The witness list (x:witnesses) holds the same confirmed witnesses as the seeded card, so it reads "1 of 2". Idempotent. */
function seedWitnessRecords(s: Store, card: ReturnType<typeof CardSchema.parse>) {
  const story = card.realStory;
  if (!story?.witnesses.length) return;
  const list = s.getJSON("witnesses", z.array(WitnessRecordSchema)) ?? [];
  const add: WitnessRecord[] = story.witnesses
    .filter((w) => !list.some((x) => x.id === w.id))
    .map((w) => {
      const at = w.confirmedAt ?? "2026-11-04T18:05:00.000Z";
      return WitnessRecordSchema.parse({
        id: w.id,
        attemptId: card.attemptId,
        storyTitle: story.title,
        relationship: w.relationship,
        // A fictional partner: only a hash is ever kept, as for real witnesses.
        emailHash: hashSeed(`demo-witness-${w.id}@example.org`).toString(16),
        token: `demo-${card.attemptId}-${w.id}`,
        status: w.status,
        skillsSeen: w.skillsSeen,
        sentence: w.sentence,
        createdAt: at,
        expiresAt: new Date(Date.parse(at) + WITNESS_TTL_DAYS * 86_400_000).toISOString(),
        confirmedAt: w.confirmedAt,
      });
    });
  if (add.length) s.setJSON("witnesses", [...list, ...add]);
}
