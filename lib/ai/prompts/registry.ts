import { getMapScenario } from "@/content/maps";
import { getScenario } from "@/content/scenarios";
import attempt from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { newGame, nodeById } from "@/lib/game/engine";
import { coachPrompt } from "../services/coach";
import { consistencyPrompt } from "../services/consistency";
import { blindCard, copilotPrompt } from "../services/copilot";
import { fairnessPrompt } from "../services/fairness";
import { checkpointQuestionPrompt, followUpPrompt } from "../services/interviewer";
import { scannerPrompt } from "../services/scanner";
import { tailorPrompt } from "../services/tailor";
import { transcriberPrompt } from "../services/transcriber";
import { valueMapperPrompt } from "../services/valueMapper";
import { npcLines, variantsPrompt } from "../services/variants";
import type { AnyPrompt } from "./types";

// The versioned prompt registry (PRD v2 B1): every AI job, its version, schema and fixtures. The AI health
// page, the cache recorder and the tests all read this list.

export const PROMPTS: AnyPrompt[] = [
  tailorPrompt,
  variantsPrompt,
  checkpointQuestionPrompt,
  followUpPrompt,
  transcriberPrompt,
  scannerPrompt,
  consistencyPrompt,
  valueMapperPrompt,
  copilotPrompt,
  coachPrompt,
  fairnessPrompt,
];

/** The ten B2 services, each backed by at least one prompt above. */
export const SERVICES = [
  "Scenario Tailor",
  "Dialogue Variants",
  "Checkpoint Interviewer",
  "Transcriber",
  "Evidence Scanner",
  "Consistency Checker",
  "Value Mapper",
  "Recruiter Copilot",
  "Candidate Coach",
  "Fairness Monitor",
] as const;

export const promptById = (id: string) => PROMPTS.find((p) => p.id === id);

/** Fixtures that need real content (scenarios, a card) are built here so the services stay light. */
function contentFixtures(id: string): { name: string; input: unknown }[] {
  const map = getMapScenario("launch-week");
  switch (id) {
    case "scenario-tailor": {
      const base = getScenario("launch-week");
      return base ? [{ name: "launch week for energy", input: { scenario: base, industry: "Energy", company: "Prairie Grid" } }] : [];
    }
    case "dialogue-variants":
      return map ? [{ name: "launch week lines", input: { lines: npcLines(map) } }] : [];
    case "checkpoint-question": {
      if (!map) return [];
      const issue = map.issues.find((i) => i.spawnAt !== undefined) ?? map.issues[0];
      const opt = nodeById(map, issue.node).options[0];
      const state = newGame(map, "fixture-seed");
      return [
        { name: "explain a choice", input: { scenario: map, state, due: { id: "f1", kind: "explain", t: 0, issue: issue.id, action: "choose", optionId: opt.id, optionLabel: opt.label } } },
        { name: "order question", input: { scenario: map, state, due: { id: "order", kind: "order", t: 0 } } },
      ];
    }
    case "recruiter-copilot": {
      const card = blindCard(CardSchema.parse(attempt));
      return [
        { name: "where prioritization", input: { question: "Where did they show prioritization?", card } },
        { name: "keyword", input: { question: "What did they say about the vendors?", card } },
      ];
    }
    default:
      return [];
  }
}

export const fixturesOf = (p: AnyPrompt): { name: string; input: unknown }[] => [...p.fixtures, ...contentFixtures(p.id)];
