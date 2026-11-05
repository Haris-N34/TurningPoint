import { describe, expect, it } from "vitest";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { extractEvidence, MAX_QUOTE_WORDS } from "./evidence";

// Quote windows end on a clause boundary, and "even though" reads as a trade-off.
const run = (text: string) =>
  extractEvidence({
    targetSkills: ["analytical"],
    checkpoints: [{ id: "c", nodeId: "n", kind: "decision", transcript: fromChunks([{ text, startS: 0, endS: 30 }]) }],
    decisionPath: [],
    nodeSkills: { n: ["analytical"] },
  })[0];

describe("quote windows and trade-off words", () => {
  const long = "I looked at the stockout chart against sales because the other chart was seasonal noise; the trend held in all three stores, so I picked it even though it delayed the deck by a day for the team.";
  it("a long sentence is cut at a clause boundary, never mid-thought", () => {
    const e = run(long);
    expect(e.source?.type).toBe("clip");
    if (e.source?.type === "clip") {
      expect(e.source.quote.split(" ").length).toBeLessThanOrEqual(MAX_QUOTE_WORDS);
      expect(long).toContain(e.source.quote);
      expect(e.source.quote).not.toMatch(/\b(so I picked|and|but|so)$/);
    }
  });
  it("'even though' counts as naming a trade-off", () => {
    expect(run(long).level).toBe("strong");
  });
});
