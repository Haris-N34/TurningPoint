import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { LocalProvider } from "./providers";
import { practiceFeedback, practiceFeedbackPrompt } from "./services/coach";
import type { AiCall } from "./telemetry";

// C8.2: after practice, private feedback on clarity and specificity of each answer. Never a score or level.

const calls: AiCall[] = [];
const opts = { provider: new LocalProvider(), log: (c: AiCall) => calls.push(c) };
const Q = "You chose to cut the second weekend. Why?";
const fb = (answer: string) => practiceFeedbackPrompt.local({ question: Q, answer });

const NO_SCORE = /score|grade|rating|level|\d+\s*\/\s*\d+|\d+%|out of|percent|strong|weak|hire|pass|fail|accent|grammar|fluen/i;

describe("practice feedback (C8.2)", () => {
  it("gives notes in exactly two areas, clarity and specificity", () => {
    const out = fb("I just picked B.");
    expect(Object.keys(out)).toEqual(["clarity", "specificity"]);
    for (const area of [out.clarity, out.specificity]) expect(area.strengths.length + area.tips.length).toBeGreaterThan(0);
  });

  it("a vague answer gets tips in both areas", () => {
    const out = fb("I just picked B.");
    expect(out.clarity.tips.length).toBeGreaterThan(0);
    expect(out.specificity.tips.length).toBeGreaterThan(0);
  });

  it("a clear, specific answer gets strengths in both areas and fewer tips", () => {
    const out = fb("I cut the second weekend instead of the vendor spots because the vendors were the draw. I told the 12 volunteers on Monday at 9am.");
    expect(out.clarity.strengths.length).toBeGreaterThanOrEqual(2);
    expect(out.specificity.strengths.length).toBeGreaterThanOrEqual(2);
    expect(out.clarity.tips.length + out.specificity.tips.length).toBeLessThan(fb("I just picked B.").clarity.tips.length + fb("I just picked B.").specificity.tips.length);
  });

  it("never reads like a score, level or judgement, and the guard rejects one that does", () => {
    const answers = ["", "um", "I just picked B.", "Because.", "I cut the second weekend instead of vendors because they were the draw, and told the team on Friday."];
    for (const a of answers) expect(JSON.stringify(fb(a))).not.toMatch(NO_SCORE);
    expect(practiceFeedbackPrompt.check!({ clarity: { strengths: ["Clarity: 4/5"], tips: [] }, specificity: { strengths: [], tips: [] } }, { question: Q, answer: "" })).toMatch(/score/);
    expect(practiceFeedbackPrompt.check!({ clarity: { strengths: [], tips: ["Work on your grammar"] }, specificity: { strengths: [], tips: [] } }, { question: Q, answer: "" })).toBeDefined();
  });

  it("does not depend on grammar, filler words or spelling", () => {
    const tidy = fb("I cut the second weekend because the vendors were the draw.");
    const messy = fb("um so i cut the second weekend uh because like the vendors was the draw");
    expect(messy).toEqual(tidy);
  });

  it("runs per checkpoint over a practice card through the AI runner, with the name and school stripped", () => {
    const card = CardSchema.parse({ ...fixture, challenge: { id: "practice:sample", title: "Practice run", company: "Turning Point practice" } });
    card.checkpoints[0].transcript.text = `I am ${card.candidate.displayName} from ${card.candidate.university}. I picked it.`;
    const before = calls.length;
    const out = practiceFeedback(card, opts);
    expect(out.map((o) => o.checkpointId)).toEqual(card.checkpoints.map((c) => c.id));
    expect(calls.length - before).toBe(card.checkpoints.length);
    expect(calls.every((c) => c.promptId === "practice-feedback" && c.valid)).toBe(true);
    expect(JSON.stringify(out)).not.toContain("Maya");
    expect(JSON.stringify(out)).not.toContain("Calgary");
  });
});
