import { z } from "zod";
import type { CheckpointDue, GameState } from "@/lib/game/engine";
import type { MapScenario } from "@/lib/game/schema";
import { stripPii, type Known } from "../guards/pii";
import { protectedCheck } from "../guards/protected";
import type { PromptDef } from "../prompts/types";
import { followUpQuestion, FOLLOW_UP_FALLBACK, mapCheckpointQuestion, MAX_QUESTION_WORDS } from "../questions";
import { run, runSync, type RunOptions } from "../run";

// Checkpoint Interviewer (PRD v2 B2): the checkpoint question is generated from the action just taken and
// quotes it; at most 30 words; the template is used if generation fails or takes longer than 4 seconds.
// The real-life follow-up asks about one specific detail of the candidate's story.

export const QuestionOutput = z.object({ question: z.string().min(5), source: z.enum(["generated", "fallback"]) });
export type QuestionOutput = z.infer<typeof QuestionOutput>;
export const INTERVIEWER_TIMEOUT_MS = 4000;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const lc = (s: string) => s.toLowerCase();

/** What the question must quote: the issue title or the option picked. */
function anchors(i: { scenario: MapScenario; due: CheckpointDue }): string[] {
  const issue = i.due.issue ? i.scenario.issues.find((x) => x.id === i.due.issue) : undefined;
  return [issue?.title, i.due.optionLabel, i.due.to].filter((x): x is string => !!x).map(lc);
}

const templateFor = (i: { scenario: MapScenario; due: CheckpointDue }): QuestionOutput => {
  if (i.due.kind === "order") return { question: "You've got several open problems. Which are you going to first, and why?", source: "fallback" };
  const issue = i.due.issue ? i.scenario.issues.find((x) => x.id === i.due.issue) : undefined;
  return { question: issue ? `For ${lc(issue.title)}, walk us through why you made that call.` : "Why did you make that last call?", source: "fallback" };
};

export type CheckpointInput = { scenario: MapScenario; state: GameState; due: CheckpointDue };

export const checkpointQuestionPrompt: PromptDef<CheckpointInput, QuestionOutput> = {
  id: "checkpoint-question",
  version: "1.0.0",
  service: "Checkpoint Interviewer",
  tier: "fast",
  system: [
    "Write one interview question about the action the candidate just took in a workplace simulation.",
    "Quote the action (the problem's name or the option they picked). At most 30 words. Ask why, not what.",
    "Never mention personal traits. Return source: generated.",
  ].join("\n"),
  render: (i) => {
    const issue = i.scenario.issues.find((x) => x.id === i.due.issue);
    const open = i.scenario.issues.filter((x) => i.state.issues[x.id]?.status === "open" && !x.hidden && x.id !== i.due.issue).map((x) => x.title);
    return JSON.stringify({ kind: i.due.kind, action: i.due.action, problem: issue?.title, optionPicked: i.due.optionLabel, reason: i.due.reason, delegatedTo: i.due.to, otherOpenProblems: open });
  },
  schema: QuestionOutput,
  local: (i) => mapCheckpointQuestion(i.scenario, i.state, i.due),
  fallback: templateFor,
  check: (o, i) => {
    if (words(o.question) > MAX_QUESTION_WORDS) return `question over ${MAX_QUESTION_WORDS} words`;
    if (o.source === "generated" && i.due.kind !== "order") {
      const q = lc(o.question);
      const a = anchors(i);
      // Quotes the action: the problem name, the option picked (or a 3-word run of it), or who it went to.
      const quoted = a.some((x) => q.includes(x) || x.split(/\s+/).some((_, k, ws) => k + 3 <= ws.length && q.includes(ws.slice(k, k + 3).join(" "))));
      if (a.length && !quoted) return "question does not quote the action";
    }
    return protectedCheck(o.question);
  },
  fixtures: [],
};

// Questions are made once, when the action happens, and reused on every render (pre-generated).
const made = new Map<string, QuestionOutput>();
const keyOf = (i: CheckpointInput) => `${i.state.seed}:${i.due.id}:${i.due.t}`;

export function interviewQuestion(scenario: MapScenario, state: GameState, due: CheckpointDue, opts: RunOptions = {}): QuestionOutput {
  const k = keyOf({ scenario, state, due });
  const hit = made.get(k);
  if (hit) return hit;
  const { output } = runSync(checkpointQuestionPrompt, { scenario, state, due }, opts);
  made.set(k, output);
  return output;
}

/** Live mode: ask the model, give up after 4 s and use the template. */
export async function interviewQuestionAsync(scenario: MapScenario, state: GameState, due: CheckpointDue, opts: RunOptions = {}): Promise<QuestionOutput> {
  const { output } = await run(checkpointQuestionPrompt, { scenario, state, due }, { timeoutMs: INTERVIEWER_TIMEOUT_MS, ...opts });
  made.set(keyOf({ scenario, state, due }), output);
  return output;
}

export type FollowUpInput = { transcript: string };

export const followUpPrompt: PromptDef<FollowUpInput, QuestionOutput> = {
  id: "follow-up-question",
  version: "1.0.0",
  service: "Checkpoint Interviewer",
  tier: "fast",
  system: "Ask one follow-up question (at most 30 words) about a specific detail the candidate mentioned in their story. Never ask about personal traits.",
  render: (i) => i.transcript,
  schema: QuestionOutput,
  local: (i) => followUpQuestion(i.transcript),
  fallback: () => ({ question: FOLLOW_UP_FALLBACK, source: "fallback" }),
  check: (o) => (words(o.question) > MAX_QUESTION_WORDS + 6 ? "question too long" : protectedCheck(o.question)),
  fixtures: [
    { name: "garden story", input: { transcript: "Last spring our community garden lost its water access, so I organised a rota with the neighbours and we carried water for six weeks." } },
    { name: "empty", input: { transcript: "" } },
  ],
};

/** Follow-up for the real-life story. The story is blinded first; the model never sees a name or school. */
export function followUp(transcript: string, known: Known = {}, opts: RunOptions = {}): QuestionOutput {
  return runSync(followUpPrompt, { transcript: stripPii(transcript, known) }, opts).output;
}
