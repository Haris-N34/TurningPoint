import { z } from "zod";
import { EvidenceSchema, type CardCheckpoint, type Evidence } from "@/lib/card/types";
import { fromChunks, locateQuote } from "@/lib/checkpoint/transcript";
import { SKILLS } from "@/lib/engine/skills";
import { EXTRACTOR, extractEvidence, type ExtractInput } from "../evidence";
import { stripPii, type Known } from "../guards/pii";
import { protectedCheck } from "../guards/protected";
import { quoteIn, verifyEvidence } from "../guards/quotes";
import type { PromptDef } from "../prompts/types";
import { runSync, type RunOptions } from "../run";

// Evidence Scanner (PRD v2 B2): per-skill level with a verbatim quote and timestamp, at run end.
// Blind inputs only (no name, email, school), exact-substring quotes, no protected traits, and the same
// input always gives the same output (local rules, or a recorded answer replayed in cached mode).

export const ScanOutput = z.object({ evidence: z.array(EvidenceSchema) });
export type ScanOutput = z.infer<typeof ScanOutput>;

const SAMPLE = (id: string, text: string) => ({ id, nodeId: "n1", kind: "decision" as const, transcript: fromChunks([{ text, startS: 0, endS: 20 }]) });

export const scannerPrompt: PromptDef<ExtractInput, ScanOutput> = {
  id: "evidence-scanner",
  version: `1.0.0+${EXTRACTOR.version}`,
  service: "Evidence Scanner",
  tier: "large",
  system: [
    "You organise interview evidence for a human recruiter. You never decide and never give an overall score.",
    "For each target skill return level strong, some or not_observed, with one quote copied exactly from a transcript.",
    "Strong: names the trade-off, says why, and considers who it affects. Some: gives a reason. Otherwise not_observed.",
    "Judge only what was said. Ignore grammar, accent, dialect, fluency and spelling. Never mention age, gender, race, ethnicity, disability, religion, pregnancy or nationality.",
    "Every quote must be an exact substring of the transcript, at most 25 words. If unsure, choose not_observed.",
  ].join("\n"),
  render: (i) =>
    JSON.stringify({
      targetSkills: i.targetSkills.map((s) => ({ slug: s, definition: SKILLS.find((k) => k.slug === s)?.definition })),
      checkpoints: i.checkpoints.map((c) => ({ id: c.id, kind: c.kind, transcript: c.transcript.text })),
      decisions: i.decisionPath,
    }),
  schema: ScanOutput,
  local: (i) => ({ evidence: extractEvidence(i) }),
  // No answer from the model: a human looks instead (PRD fallback "Needs human review").
  fallback: (i) => ({ evidence: i.targetSkills.map((skill) => ({ skill, level: "needs_review" as const })) }),
  check: (o, i) => {
    const skills = new Set(i.targetSkills);
    if (o.evidence.some((e) => !skills.has(e.skill))) return "evidence for a skill that was not asked for";
    for (const e of o.evidence) {
      const src = e.source;
      if (src?.type !== "clip") continue;
      const cp = i.checkpoints.find((c) => c.id === src.checkpointId);
      if (!cp || !quoteIn(cp.transcript.text, src.quote)) return "quote not in transcript";
    }
    return protectedCheck(...o.evidence.map((e) => e.sentence ?? ""));
  },
  fixtures: [
    {
      name: "strong prioritization",
      input: {
        targetSkills: ["prioritization", "communication", "curiosity"],
        checkpoints: [SAMPLE("cp1", "I cut the second weekend instead of the vendor spots, because the vendors had already paid for stock and the team agreed. I told everyone the same day.")],
        decisionPath: [],
        nodeSkills: { n1: ["prioritization"] },
      },
    },
    {
      name: "no reason given",
      input: {
        targetSkills: ["prioritization", "collaboration", "analytical"],
        checkpoints: [SAMPLE("cp1", "I picked the second option. It looked fine to me at the time.")],
        decisionPath: [],
        nodeSkills: {},
      },
    },
  ],
};

/** Blind a checkpoint: identity stripped from the text; word timings rebuilt if the text changed. */
export function blindCheckpoint<C extends Pick<CardCheckpoint, "id" | "nodeId" | "kind" | "transcript">>(cp: C, known: Known): C {
  const text = stripPii(cp.transcript.text, known);
  if (text === cp.transcript.text) return cp;
  const w = cp.transcript.words;
  const t = fromChunks([{ text, startS: w[0]?.start ?? 0, endS: w.at(-1)?.end ?? 1 }]);
  return { ...cp, transcript: { ...t, status: cp.transcript.status } };
}

/**
 * Scan a run. The scanner sees the blind copy; quotes are then located in the original transcripts for
 * exact timestamps, and anything that can't be verified there is dropped a level (G1).
 */
export function scanEvidence(input: ExtractInput, known: Known = {}, opts: RunOptions = {}): Evidence[] {
  const blind: ExtractInput = { ...input, checkpoints: input.checkpoints.map((c) => blindCheckpoint(c, known)) };
  const { output } = runSync(scannerPrompt, blind, opts);
  const relocated = output.evidence.map((e): Evidence => {
    if (e.source?.type !== "clip") return e;
    const src = e.source;
    const cp = input.checkpoints.find((c) => c.id === src.checkpointId);
    const at = cp ? locateQuote(cp.transcript, src.quote) : undefined;
    return at ? { ...e, source: { ...src, ...at } } : e;
  });
  // Every target skill gets a row, even if the provider skipped one.
  const rows = input.targetSkills.map((skill) => relocated.find((e) => e.skill === skill) ?? { skill, level: "not_observed" as const });
  return verifyEvidence({
    evidence: rows,
    checkpoints: input.checkpoints as CardCheckpoint[],
    decisionPath: input.decisionPath.map((d) => ({ ...d, prompt: "", decidedMs: 0, at: "" })),
  }).evidence;
}
