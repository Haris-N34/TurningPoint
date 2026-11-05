import { EXTRACTOR } from "@/lib/ai/evidence";
import { cardConsistencyInput, checkConsistency } from "@/lib/ai/services/consistency";
import { scanEvidence } from "@/lib/ai/services/scanner";
import type { RunState } from "@/lib/engine/engine";
import type { RunPlan } from "@/lib/engine/seed";
import type { Scenario } from "@/lib/engine/schema";
import { hashSeed } from "@/lib/engine/seed";
import type { SkillSlug } from "@/lib/engine/skills";
import { CardSchema, type Card, type CardCheckpoint } from "./types";

export type BuildInput = {
  attemptId: string;
  scenario: Scenario;
  plan: RunPlan;
  state: RunState;
  answers: CardCheckpoint[];
  integrity: Card["integrity"];
  realStory?: { title: string; checkpointId: string; followUpCheckpointId?: string };
  challenge: { id: string; title: string; company: string; targetSkills?: SkillSlug[] };
  candidate: { displayName: string; university?: string; verified: boolean };
  timeMultiplier: number;
  now?: Date;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Stable random-looking ID for anonymous first review (E6.1). Not derived from the name. */
export function anonIdFor(attemptId: string): string {
  let h = hashSeed(attemptId);
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length) ^ hashSeed(id + attemptId);
    h >>>= 0;
  }
  return `Candidate ${id}`;
}

/** Turn a finished run into a Capability Card. The extractor sees transcripts and choices only (G2). */
export function buildCard(i: BuildInput): Card {
  const now = (i.now ?? new Date()).toISOString();
  const targetSkills = (i.challenge.targetSkills?.length ? i.challenge.targetSkills : i.scenario.targetSkills) as SkillSlug[];
  const prompts = new Map(i.scenario.nodes.map((n) => [n.id, n.text]));
  const decisionCheckpoint = new Map(i.answers.filter((a) => a.kind === "decision").map((a) => [a.nodeId, a.id]));

  const decisionPath = i.state.log.map((e) => ({
    nodeId: e.nodeId,
    prompt: prompts.get(e.nodeId) ?? "",
    optionId: e.optionId,
    optionLabel: e.optionLabel,
    decidedMs: e.decidedMs,
    at: e.at,
    checkpointId: decisionCheckpoint.get(e.nodeId),
  }));

  // How many choices came before the turning point fired.
  let turningPointAfter = -1;
  if (i.state.turningPointNodeId) {
    const tpAt = i.state.path.indexOf(i.state.turningPointNodeId);
    const before = new Set(i.state.path.slice(0, tpAt));
    turningPointAfter = i.state.log.filter((e) => before.has(e.nodeId)).length - 1;
  }

  const nodeSkills: Record<string, SkillSlug[]> = {};
  for (const n of i.scenario.nodes) if (n.type === "choice") nodeSkills[n.id] = n.skillSignals as SkillSlug[];

  // Evidence Scanner (B2): blind inputs, verified quotes. The name and school are stripped before it runs.
  const evidence = scanEvidence(
    { targetSkills, checkpoints: i.answers.map(({ id, nodeId, kind, transcript }) => ({ id, nodeId, kind, transcript })), decisionPath, nodeSkills },
    { name: i.candidate.displayName, university: i.candidate.university },
  );

  return CardSchema.parse({
    attemptId: i.attemptId,
    anonId: anonIdFor(i.attemptId),
    candidate: i.candidate,
    challenge: { id: i.challenge.id, title: i.challenge.title, company: i.challenge.company },
    scenario: { id: i.scenario.id, version: i.scenario.version, seed: i.plan.seed, disruptionId: i.plan.disruptionId },
    finishedAt: now,
    adjustedTiming: i.timeMultiplier !== 1,
    targetSkills,
    evidence,
    decisionPath,
    turningPointAfter,
    checkpoints: i.answers,
    realStory: i.realStory ? { ...i.realStory, witnesses: [] } : undefined,
    integrity: i.integrity,
    // Consistency Checker (B2): said vs did, context only.
    consistency: checkConsistency(
      cardConsistencyInput({ checkpoints: i.answers, decisionPath, realStory: i.realStory ? { ...i.realStory, witnesses: [] } : undefined }, (id) => optionsOf(i.scenario, id), {
        name: i.candidate.displayName,
        university: i.candidate.university,
      }),
    ),
    audit: { extractor: EXTRACTOR.name, version: EXTRACTOR.version, createdAt: now },
  });
}

/** A choice node's options, for said-vs-did. */
export function optionsOf(s: Scenario, nodeId: string) {
  const n = s.nodes.find((x) => x.id === nodeId);
  return n?.type === "choice" ? n.options.map((o) => ({ id: o.id, label: o.label })) : [];
}
