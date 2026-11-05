import { z } from "zod";
import type { Card } from "@/lib/card/types";
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

// Practice feedback (C8.2): the same Candidate Coach, grouped into the two things the candidate can work
// on, clarity and specificity. Rules read only what was said: filler words, spelling and grammar make no
// difference, and nothing is counted into a score or level.

const AreaNotes = z.object({ strengths: z.array(z.string()).max(3), tips: z.array(z.string()).max(3) }).strict();
export const PracticeFeedbackOutput = z.object({ clarity: AreaNotes, specificity: AreaNotes }).strict();
export type PracticeFeedbackOutput = z.infer<typeof PracticeFeedbackOutput>;
export type PracticeFeedbackInput = { question: string; answer: string };

const FILLER = /\b(um+|uh+|erm|er|like|you know|i mean|kind of|sort of|basically|actually|literally)\b/gi;
const DECIDED = /\b(i|we)\s+(?:\w+\s+)?(chose|choose|picked|pick|decided|decide|went|go|moved|cut|kept|keep|let|asked|told|called|focused|put|gave|took|delayed|cancell?ed|pushed|split|dropped|stopped|started|made|switched|prioriti[sz]ed|agreed|offered|sent)\b/i;
const REASON = /\b(because|cause|cuz|cos|since|so that|the reason|in order to)\b/i;
const TRADE = /\b(instead of|rather than|trade-?off|gave up|give up|but|over|at the cost of|meant we|meant i)\b/i;
const PEOPLE = /\b(team|they|them|customers?|clients?|volunteers?|people|everyone|vendors?|manager|boss|staff|sponsors?|users?|members?|partners?)\b/i;
const CONCRETE = /\d|\$|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|tonight|tomorrow|hours?|minutes?|days?|one|two|three|four|five|six|seven|eight|nine|ten|half|dozen)\b/i;
const STOP = new Set(["about", "after", "again", "before", "being", "below", "choice", "chose", "choose", "could", "decide", "decided", "decision", "doing", "every", "explain", "first", "going", "might", "other", "their", "there", "these", "thing", "think", "those", "under", "until", "wanted", "where", "which", "while", "would", "right", "really", "because"]);

/** Content words from the question (5+ letters), so the answer can name the choice it is about. */
function topicWords(question: string) {
  return [...new Set((question.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => !STOP.has(w)))];
}

export function localPracticeFeedback({ question, answer }: PracticeFeedbackInput): PracticeFeedbackOutput {
  const a = answer.replace(FILLER, " ").replace(/\s+/g, " ").trim();
  const clarity = { strengths: [] as string[], tips: [] as string[] };
  const specificity = { strengths: [] as string[], tips: [] as string[] };
  if (!/[a-z]{2,}/i.test(a)) {
    clarity.tips.push("Start with the decision in one line, then say why.");
    specificity.tips.push("Add one concrete detail: a number, a time, or the task you changed.");
    return { clarity, specificity };
  }
  const note = (area: typeof clarity, ok: boolean, strength: string, tip: string) => (ok ? area.strengths : area.tips).push(ok ? strength : tip);
  note(clarity, DECIDED.test(a), "You said plainly what you decided.", "Open with the decision itself: 'I chose X.'");
  note(clarity, REASON.test(a), "You gave the reason for the call.", "Add the reason: 'I did X because Y.'");
  note(clarity, TRADE.test(a), "You named what you gave up, so the trade-off is easy to follow.", "Name what you gave up: 'instead of...' or 'rather than...'.");
  note(specificity, CONCRETE.test(a), "You used a concrete detail (a number, a time or a day).", "Add one concrete detail: a number, a time, or a day.");
  note(specificity, PEOPLE.test(a), "You said who the decision affected.", "Say who the decision affected and how.");
  const topic = topicWords(question);
  if (topic.length) {
    const lower = a.toLowerCase();
    note(specificity, topic.some((w) => lower.includes(w)), "You named the exact choice you were asked about.", "Name the choice itself, so a reader knows which call you mean.");
  }
  return { clarity, specificity };
}

export const practiceFeedbackPrompt: PromptDef<PracticeFeedbackInput, PracticeFeedbackOutput> = {
  id: "practice-feedback",
  version: "1.0.0",
  service: "Candidate Coach",
  tier: "fast",
  system: [
    "A candidate finished a practice run. For one checkpoint answer, give private notes in two areas only: clarity (is the decision, the reason and the trade-off easy to follow) and specificity (concrete details, who it affected, the exact choice).",
    "Up to 3 strengths and up to 3 tips per area. Never give a score, grade, level, count, percentage or hiring opinion. Never comment on grammar, spelling, accent, filler words or fluency.",
  ].join("\n"),
  render: (i) => `Question: ${i.question}\nAnswer: ${i.answer}`,
  schema: PracticeFeedbackOutput,
  local: localPracticeFeedback,
  fallback: () => ({
    clarity: { strengths: [], tips: ["Start with the decision in one line, then say why."] },
    specificity: { strengths: [], tips: ["Add one concrete detail: a number, a time, or the task you changed."] },
  }),
  check: (o) => {
    const all = [...o.clarity.strengths, ...o.clarity.tips, ...o.specificity.strengths, ...o.specificity.tips];
    if (all.some((t) => SCORE_WORDS.test(t))) return "practice feedback looks like a score or judgement";
    return protectedCheck(...all);
  },
  fixtures: [
    { name: "specific", input: { question: "You chose to cut the second weekend. Why?", answer: "I cut the second weekend instead of the vendor spots because vendors were the draw, and I told the 12 volunteers on Monday." } },
    { name: "vague", input: { question: "You chose to cut the second weekend. Why?", answer: "I just picked B." } },
  ],
};

export type PracticeFeedbackItem = { checkpointId: string; feedback: PracticeFeedbackOutput };

/** Feedback for every checkpoint answer of a practice card. Name, email and school are stripped first (G2). */
export function practiceFeedback(card: Card, opts: RunOptions = {}): PracticeFeedbackItem[] {
  const known: Known = { name: card.candidate.displayName, university: card.candidate.university };
  return card.checkpoints.map((c) => ({
    checkpointId: c.id,
    feedback: runSync(practiceFeedbackPrompt, { question: stripPii(c.question, known), answer: stripPii(c.transcript.text, known) }, opts).output,
  }));
}
