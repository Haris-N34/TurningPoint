import { z } from "zod";
import { extractEvidence } from "@/lib/ai/evidence";
import { fromTyping } from "@/lib/checkpoint/transcript";
import { EvidenceSchema, type Card, type Evidence } from "@/lib/card/types";
import { SKILL_SLUGS, type SkillSlug } from "@/lib/engine/skills";
import type { Store } from "@/lib/store/store";

// E8.2 (P2): when a reused card misses some of an employer's skills, the recruiter can ask for a short
// add-on: a 5-minute mini-scenario with one question per missing skill. Evidence comes from the same
// local extractor as full runs (exact-quote check, no score). The candidate chooses whether to do it.

export const ADDON_MINUTES = 5;
const KEY = "addons";

export const AddonSchema = z.object({
  id: z.string(),
  attemptId: z.string(),
  challengeId: z.string(),
  skills: z.array(z.enum(SKILL_SLUGS)).min(1),
  status: z.enum(["requested", "done"]),
  requestedAt: z.string(),
  answers: z.record(z.string(), z.string()).default({}),
  evidence: z.array(EvidenceSchema).default([]),
  finishedAt: z.string().optional(),
});
export type Addon = z.infer<typeof AddonSchema>;

/** The mini-scenario: one short situation, then one question per missing skill. */
export const ADDON_SITUATION =
  "It is Friday afternoon. Your team's weekly report is due at 5 pm. An hour ago a key data file came back wrong, one teammate is out sick, and your manager has asked for a quick update.";

const QUESTIONS: Record<SkillSlug, string> = {
  "problem-solving": "The data file is wrong. Walk through how you would find the cause and get a usable report out.",
  adaptability: "The original plan no longer works. What do you change, and what do you keep?",
  resilience: "Think of a time a deadline went badly for you. What did you do next, and what changed after?",
  ambiguity: "You cannot tell yet how much of the data is wrong. What call do you make, and why?",
  prioritization: "You cannot finish everything by 5 pm. What do you do first, and what do you drop?",
  creativity: "You have no budget and one person short. What could you use or borrow to get it done?",
  collaboration: "How do you split the work with the people who are still here?",
  empathy: "Your sick teammate is worried about letting everyone down. What do you do?",
  communication: "Write the two or three sentences you send your manager right now.",
  feedback: "Last week your manager said the report was hard to follow. What do you change this time?",
  analytical: "The numbers look off compared with last week. How do you check what is actually going on?",
  curiosity: "Nobody knows why the file came back wrong. How would you find out?",
};
export const addonQuestion = (skill: SkillSlug) => QUESTIONS[skill];

export const missingSkills = (card: Pick<Card, "targetSkills">, employerSkills: readonly SkillSlug[]) =>
  employerSkills.filter((s) => !card.targetSkills.includes(s));

const list = (s: Store): Addon[] => s.getJSON(KEY, z.array(AddonSchema)) ?? [];
const save = (s: Store, all: Addon[]) => s.setJSON(KEY, all);

export const getAddon = (s: Store, id: string) => list(s).find((a) => a.id === id);
export const addonsForAttempt = (s: Store, attemptId: string) => list(s).filter((a) => a.attemptId === attemptId);
export const addonFor = (s: Store, attemptId: string, challengeId: string) =>
  list(s).find((a) => a.attemptId === attemptId && a.challengeId === challengeId);

/** One-click request. Only for a card actively shared with this employer that misses some of its skills. */
export function requestAddon(s: Store, attemptId: string, challengeId: string, employerSkills: readonly SkillSlug[]): Addon | undefined {
  const card = s.getCard(attemptId);
  const shared = s.sharesFor(challengeId).some((x) => x.attemptId === attemptId && !x.revokedAt);
  if (!card || !shared) return undefined;
  const skills = missingSkills(card, employerSkills);
  if (!skills.length) return undefined;
  const existing = addonFor(s, attemptId, challengeId);
  if (existing) return existing;
  const a = AddonSchema.parse({ id: `addon_${attemptId}_${challengeId}`, attemptId, challengeId, skills, status: "requested", requestedAt: new Date().toISOString() });
  save(s, [...list(s), a]);
  return a;
}

/** Store the candidate's answers and extract evidence for the missing skills only. */
export function completeAddon(s: Store, id: string, answers: Partial<Record<SkillSlug, string>>): Addon {
  const a = getAddon(s, id);
  if (!a) throw new Error("Add-on not found");
  const clean = Object.fromEntries(a.skills.map((sk) => [sk, (answers[sk] ?? "").trim()]).filter(([, t]) => t));
  // Each skill is judged on its own answer only.
  const evidence: Evidence[] = a.skills.flatMap((sk) =>
    extractEvidence({
      targetSkills: [sk],
      checkpoints: clean[sk] ? [{ id: `${a.id}:${sk}`, nodeId: `addon:${sk}`, kind: "decision", transcript: fromTyping(clean[sk], []) }] : [],
      decisionPath: [],
      nodeSkills: { [`addon:${sk}`]: [sk] },
    }),
  );
  const done = AddonSchema.parse({ ...a, status: "done", answers: clean, evidence, finishedAt: new Date().toISOString() });
  save(s, list(s).map((x) => (x.id === id ? done : x)));
  return done;
}
