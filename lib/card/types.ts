import { z } from "zod";
import { SKILL_SLUGS } from "@/lib/engine/skills";

// The Capability Card data contract (PRD, E3 and Data model, adapted for a local-only demo).
// Recruiter screens build against fixtures/attempt.json, which must pass this schema.

const skill = z.enum(SKILL_SLUGS);

export const WordSchema = z.object({ w: z.string(), start: z.number().min(0), end: z.number().min(0) });

export const TranscriptSchema = z.object({
  text: z.string(),
  // Word timestamps in seconds from the start of the clip, for jump-to-second (E3.4).
  words: z.array(WordSchema).default([]),
  status: z.enum(["ready", "pending", "unavailable"]).default("ready"),
});

export const AnswerMode = z.enum(["video", "voice", "text"]);

export const CheckpointSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  kind: z.enum(["decision", "real_life", "follow_up"]),
  question: z.string(),
  /** Where the question came from: generated from the choice log, or the node's fallback. */
  questionSource: z.enum(["generated", "fallback"]).default("generated"),
  mode: AnswerMode,
  /** Local blob key (IndexedDB) or static demo file. Never a public URL. */
  media: z.string().optional(),
  durationS: z.number().min(0),
  transcript: TranscriptSchema,
  retakeUsed: z.boolean().default(false),
  /** Candidate can hide a clip from employers (C7.2). Transcripts cannot be edited. */
  hidden: z.boolean().default(false),
});

export const EvidenceSource = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("clip"),
    checkpointId: z.string(),
    quote: z.string().min(1),
    startS: z.number().min(0),
    endS: z.number().min(0),
  }),
  z.object({ type: z.literal("choice"), nodeId: z.string(), optionId: z.string(), optionLabel: z.string() }),
]);

export const EvidenceSchema = z.object({
  skill,
  level: z.enum(["strong", "some", "not_observed", "needs_review"]),
  /** One plain sentence (max 20 words) saying what the source shows. Labelled "AI summary" in the UI (E3.8). */
  sentence: z.string().optional(),
  source: EvidenceSource.optional(),
});

export const DecisionStepSchema = z.object({
  nodeId: z.string(),
  prompt: z.string(),
  optionId: z.string(),
  optionLabel: z.string(),
  decidedMs: z.number().min(0),
  at: z.string(),
  checkpointId: z.string().optional(),
});

export const WitnessSchema = z.object({
  id: z.string(),
  relationship: z.enum(["supervisor", "peer", "community_partner", "instructor", "other"]),
  status: z.enum(["pending", "confirmed", "declined", "expired"]),
  skillsSeen: z.array(skill).max(3).default([]),
  sentence: z.string().optional(),
  confirmedAt: z.string().optional(),
  // No witness email or name is ever part of the card (C6.4).
});

export const IntegrityNoteSchema = z.object({
  checkpointId: z.string(),
  kind: z.enum(["focus_lost", "retake_used"]),
  detail: z.string(),
});

export const CardSchema = z.object({
  attemptId: z.string(),
  anonId: z.string(),
  candidate: z.object({ displayName: z.string(), university: z.string().optional(), verified: z.boolean() }),
  challenge: z.object({ id: z.string(), title: z.string(), company: z.string() }),
  scenario: z.object({ id: z.string(), version: z.number(), seed: z.string(), disruptionId: z.string() }),
  finishedAt: z.string(),
  /** Only ever shown as "adjusted timing" (E3.1). */
  adjustedTiming: z.boolean().default(false),
  targetSkills: z.array(skill).min(1),
  evidence: z.array(EvidenceSchema),
  decisionPath: z.array(DecisionStepSchema),
  /** Index in decisionPath right after which the turning point fired. */
  turningPointAfter: z.number().int().min(-1),
  checkpoints: z.array(CheckpointSchema),
  realStory: z
    .object({
      title: z.string(),
      checkpointId: z.string(),
      followUpCheckpointId: z.string().optional(),
      witnesses: z.array(WitnessSchema).max(2).default([]),
    })
    .optional(),
  integrity: z.array(IntegrityNoteSchema).default([]),
  reused: z.object({ fromChallenge: z.string(), skills: z.array(skill) }).optional(),
  review: z
    .object({
      decision: z.enum(["shortlist", "hold", "pass"]),
      reason: z.string().optional(),
      note: z.string().optional(),
      at: z.string(),
    })
    .optional(),
  /** How the card was made, so it can be audited (G3). */
  audit: z.object({ extractor: z.string(), version: z.string(), createdAt: z.string() }),
});

export type Card = z.infer<typeof CardSchema>;
export type CardCheckpoint = z.infer<typeof CheckpointSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;

export const PASS_REASONS = [
  "Skills needed for the role were not observed",
  "Role requirements not met (location, availability, eligibility)",
  "Position filled",
  "Other (explain in note)",
] as const;
