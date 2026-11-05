import { describe, expect, it } from "vitest";
import attempt from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { LocalProvider, type Provider } from "./providers";
import { askCopilot, askCopilotAsync, blindCard, copilotPrompt, REFUSAL } from "./services/copilot";
import type { AiCall } from "./telemetry";

// B.6: the Recruiter Copilot answers only with citations and refuses protected-trait and hire/no-hire questions.

const card = CardSchema.parse(attempt);
const log = (c: AiCall) => void c;
const opts = { provider: new LocalProvider(), log };

const PROTECTED_QS = [
  "How old is she?",
  "Is this a man or a woman?",
  "What race is the candidate?",
  "What's their ethnicity?",
  "Do they have a disability?",
  "Do they have an accent? Is English their first language?",
  "What religion are they?",
  "Is she pregnant or planning to have kids?",
  "What is their nationality? Where is she from?",
];
const DECISION_QS = ["Should I hire her?", "Is she a good fit?", "Should we reject this candidate?", "Give me an overall score", "Is this the best candidate?", "Yes or no: worth hiring?"];

describe("Recruiter Copilot (B.6)", () => {
  it("answers where a skill was shown, citing the clip and second", () => {
    const r = askCopilot("Where did they show prioritization?", card, opts);
    expect(r.refused).toBeNull();
    const ev = r.citations.find((c) => c.kind === "evidence")!;
    expect(ev).toMatchObject({ skill: "prioritization", checkpointId: "cp2" });
    const cp = card.checkpoints.find((c) => c.id === ev.checkpointId)!;
    expect(cp.transcript.text).toContain(ev.quote);
    expect(ev.t).toBeGreaterThanOrEqual(0);
    expect(r.answer).toContain(ev.quote);
  });

  it.each(PROTECTED_QS)("refuses protected-trait question: %s", (q) => {
    const r = askCopilot(q, card, opts);
    expect(r).toEqual({ answer: REFUSAL.protected, citations: [], refused: "protected" });
  });

  it.each(DECISION_QS)("refuses hire/no-hire question: %s", (q) => {
    const r = askCopilot(q, card, opts);
    expect(r).toEqual({ answer: REFUSAL.decision, citations: [], refused: "decision" });
  });

  it("every answer cites, or says it found nothing", () => {
    for (const q of ["How did they handle the turning point?", "What did they say about the vendors?", "Tell me about collaboration", "How was their adaptability?", "What about quantum physics?"]) {
      const r = askCopilot(q, card, opts);
      if (r.refused === null) {
        expect(r.citations.length, q).toBeGreaterThan(0);
        for (const c of r.citations.filter((x) => x.quote)) expect(card.checkpoints.find((k) => k.id === c.checkpointId)!.transcript.text).toContain(c.quote);
      } else expect(r.refused, q).toBe("no_evidence");
    }
  });

  it("a model answer without citations, or with an invented quote, is replaced", async () => {
    const uncited: Provider = { name: "claude", generate: async () => ({ output: { answer: "She is great.", citations: [], refused: null }, model: "claude-opus-5-5", costUsd: 0 }) };
    expect((await askCopilotAsync("Tell me about collaboration", card, { provider: uncited, log })).refused).toBe("no_evidence");
    const invented: Provider = {
      name: "claude",
      generate: async () => ({ output: { answer: "x", citations: [{ kind: "transcript", label: "x", checkpointId: "cp1", quote: "I am a natural leader", t: 0 }], refused: null }, model: "m", costUsd: 0 }),
    };
    expect((await askCopilotAsync("Tell me about collaboration", card, { provider: invented, log })).refused).toBe("no_evidence");
  });

  it("refusals never reach a model", async () => {
    let called = 0;
    const p: Provider = { name: "claude", generate: async () => (called++, { output: {}, model: "m", costUsd: 0 }) };
    await askCopilotAsync("Should I hire her?", card, { provider: p, log });
    await askCopilotAsync("How old is she?", card, { provider: p, log });
    expect(called).toBe(0);
  });

  it("the model input is blind: no name, email or school", () => {
    const text = copilotPrompt.render({ question: "Where did they show prioritization?", card: blindCard(card) });
    expect(text).not.toContain(card.candidate.displayName.split(" ")[0]);
    if (card.candidate.university) expect(text).not.toContain(card.candidate.university);
    expect(text).not.toMatch(/displayName|email/);
  });
});
