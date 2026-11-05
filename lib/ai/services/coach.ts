import { z } from "zod";
import { stripPii, type Known } from "../guards/pii";
import { protectedCheck } from "../guards/protected";
import type { PromptDef } from "../prompts/types";
import { runSync, type RunOptions } from "../run";

// Candidate Coach (PRD v2 B2): private feedback on how specific and clear an answer is. Never a score,
// never a level, never a hiring signal, and nothing about grammar, accent or fluency.

export const CoachOutput = z
  .object({
    strengths: z.array(z.string()).max(3),
    tips: z.array(z.string()).max(3),
  })
  .strict();
export type CoachOutput = z.infer<typeof CoachOutput>;
export type CoachInput = { answer: string };

const has = (re: RegExp, s: string) => re.test(s);

export function localCoach({ answer }: CoachInput): CoachOutput {
  const a = answer.trim();
  const strengths: string[] = [];
  const tips: string[] = [];
  if (!a) return { strengths, tips: ["Say what you did, why you did it, and what it cost you."] };
  const words = a.split(/\s+/).length;
  const reason = has(/\b(because|cause|cuz|cos|since|so that|so|the reason)\b/i, a);
  const trade = has(/\b(instead of|rather than|trade-?off|gave up|give up|but|over)\b/i, a);
  const people = has(/\b(team|they|them|customer|client|volunteers?|people|everyone|vendors?)\b/i, a);
  const specific = has(/\d|\$|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|hour|minutes?|day)\b/i, a);
  (reason ? strengths : tips).push(reason ? "You said why you made the call." : "Add the reason: 'I did X because Y.'");
  (trade ? strengths : tips).push(trade ? "You named what you gave up." : "Name what you gave up: 'instead of…' or 'rather than…'.");
  (people ? strengths : tips).push(people ? "You thought about who it affected." : "Say who the decision affected and how.");
  if (!specific && tips.length < 3) tips.push("Add one concrete detail: a number, a time, or a name of a task.");
  if (words < 15 && tips.length < 3) tips.push("A little more detail would help a reviewer see your thinking.");
  return { strengths: strengths.slice(0, 3), tips: tips.slice(0, 3) };
}

const SCORE_WORDS = /\b(score|scored|rating|rated|grade|out of \d+|\d+\s*\/\s*\d+|\d+%|percent|level|strong|weak|hire|hireable|pass|fail|accent|grammar|fluen\w*)\b/i;

export const coachPrompt: PromptDef<CoachInput, CoachOutput> = {
  id: "candidate-coach",
  version: "1.0.0",
  service: "Candidate Coach",
  tier: "fast",
  system: [
    "Give a candidate private feedback on one answer: up to 3 strengths and up to 3 tips about specificity and clarity.",
    "Never give a score, grade, level, percentage or hiring opinion. Never comment on grammar, accent or fluency.",
  ].join("\n"),
  render: (i) => i.answer,
  schema: CoachOutput,
  local: localCoach,
  fallback: () => ({ strengths: [], tips: ["Say what you did, why you did it, and what it cost you."] }),
  check: (o) => {
    const all = [...o.strengths, ...o.tips];
    if (all.some((t) => SCORE_WORDS.test(t))) return "coach output looks like a score or judgement";
    return protectedCheck(...all);
  },
  fixtures: [
    { name: "specific", input: { answer: "I moved the launch to Friday instead of Thursday because the vendors needed two more days, and I told the team at 9am." } },
    { name: "vague", input: { answer: "I just picked B." } },
  ],
};

export const coach = (answer: string, known: Known = {}, opts: RunOptions = {}) => runSync(coachPrompt, { answer: stripPii(answer, known) }, opts).output;
