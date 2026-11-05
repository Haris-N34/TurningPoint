import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { askCopilot, blindCard, blindWords, copilotPrompt } from "@/lib/ai/services/copilot";
import type { Provider } from "@/lib/ai/providers/types";
import { CardSchema, type Card } from "@/lib/card/types";
import { fromChunks } from "@/lib/checkpoint/transcript";

// QA night (G2): the Copilot's model input must hold no name or school. blindCard stripped the transcript
// text but passed the word timings (every word, the name included), the evidence quotes and the
// recruiter's own question through untouched.
function cardWithName(): Card {
  const card = CardSchema.parse(fixture);
  const text = "Honestly, as Maya Chen from University of Calgary I cut the second weekend because the vendors had paid.";
  const cp = { ...card.checkpoints[0], transcript: { ...fromChunks([{ text, startS: 0, endS: 12 }]), status: "ready" as const } };
  const evidence = card.evidence.map((e, i) =>
    i === 0 ? { ...e, level: "some" as const, source: { type: "clip" as const, checkpointId: cp.id, quote: "as Maya Chen from University of Calgary I cut the second weekend", startS: 0, endS: 6 } } : e,
  );
  return { ...card, checkpoints: [cp, ...card.checkpoints.slice(1)], evidence };
}

describe("QA: Copilot input is blind", () => {
  it("no name or school anywhere in what the model would read", () => {
    let seen = "";
    const spy: Provider = {
      name: "claude",
      generate: async () => ({ output: {}, model: "spy", costUsd: 0 }),
      generateSync: (p, input) => {
        seen = p.render(input);
        return { output: { answer: "x", citations: [], refused: "no_evidence" }, model: "spy", costUsd: 0 };
      },
    };
    askCopilot("Where did Maya show prioritization?", cardWithName(), { provider: spy, log: () => {} });
    expect(seen).toContain("prioritization");
    expect(seen).not.toMatch(/Maya|Chen|Calgary/);
  });

  it("blinded word timings keep the start of what they replaced", () => {
    const words = ["I", "am", "Maya", "Chen", "and", "I", "cut", "it"].map((w, i) => ({ w, start: i }));
    expect(blindWords(words, "I am [name] [name] and I cut it")).toEqual([
      { w: "I", start: 0 }, { w: "am", start: 1 }, { w: "[name]", start: 2 }, { w: "[name]", start: 3 }, { w: "and", start: 4 }, { w: "I", start: 5 }, { w: "cut", start: 6 }, { w: "it", start: 7 },
    ]);
    expect(blindWords(words.slice(0, 5), "I am [name] and").map((x) => x.start)).toEqual([0, 1, 2, 4]);
  });

  it("the blind card still matches the render path", () => {
    expect(copilotPrompt.render({ question: "q", card: blindCard(cardWithName()) })).not.toMatch(/Maya|Chen|Calgary/);
  });
});
