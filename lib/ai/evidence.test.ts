import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { extractEvidence, MAX_QUOTE_WORDS, type ExtractInput } from "./evidence";

const card = CardSchema.parse(fixture);
const input = (over: Partial<ExtractInput> = {}): ExtractInput => ({
  targetSkills: card.targetSkills,
  checkpoints: card.checkpoints,
  decisionPath: card.decisionPath,
  nodeSkills: { n3: ["collaboration", "prioritization"], n9: ["prioritization", "adaptability"] },
  ...over,
});

const tx = (text: string) => fromChunks([{ text, startS: 0, endS: text.split(" ").length / 2.5 }]);

describe("extractEvidence (AI.2, rubric)", () => {
  it("finds verbatim, timestamped evidence in Maya's answers", () => {
    const ev = extractEvidence(input());
    expect(ev).toHaveLength(4);
    for (const e of ev) {
      if (e.level === "strong" || e.level === "some") {
        const src = e.source;
        expect(src?.type).toBe("clip");
        if (src?.type === "clip") {
          const cp = card.checkpoints.find((c) => c.id === src.checkpointId)!;
          expect(cp.transcript.text).toContain(src.quote);
          expect(src.quote.split(" ").length).toBeLessThanOrEqual(MAX_QUOTE_WORDS);
          expect(src.endS).toBeGreaterThanOrEqual(src.startS);
        }
        expect(e.sentence!.split(" ").length).toBeLessThanOrEqual(20);
      }
    }
    expect(ev.find((e) => e.skill === "collaboration")?.level).toBe("strong");
  });

  it("rates a reason without a trade-off as Some, and a full trade-off as Strong", () => {
    const strong = extractEvidence(
      input({
        targetSkills: ["prioritization"],
        checkpoints: [{ id: "c", nodeId: "x", kind: "decision", transcript: tx("I cut the second weekend instead of vendor spots because the vendors had already paid and the team agreed.") }],
      }),
    );
    expect(strong[0].level).toBe("strong");
    const some = extractEvidence(
      input({
        targetSkills: ["prioritization"],
        checkpoints: [{ id: "c", nodeId: "x", kind: "decision", transcript: tx("I picked the first option because it seemed the most important thing.") }],
      }),
    );
    expect(some[0].level).toBe("some");
  });

  it("says Not observed when there is no relevant evidence, never a negative judgment", () => {
    const ev = extractEvidence(input({ targetSkills: ["empathy"], checkpoints: [{ id: "c", nodeId: "x", kind: "decision", transcript: tx("It was fine.") }] }));
    expect(ev[0]).toEqual({ skill: "empathy", level: "not_observed" });
  });

  it("sends the skill to a human when no transcript exists", () => {
    const ev = extractEvidence(input({ checkpoints: card.checkpoints.map((c) => ({ ...c, transcript: { text: "", words: [], status: "unavailable" as const } })) }));
    expect(ev.every((e) => e.level === "needs_review" && !e.sentence)).toBe(true);
  });

  it("ignores spelling and grammar (F1): the same idea scores the same", () => {
    const a = extractEvidence(input({ targetSkills: ["prioritization"], checkpoints: [{ id: "c", nodeId: "x", kind: "decision", transcript: tx("I cut the second weekend instead of vendor spots because the team needed the vendors.") }] }));
    const b = extractEvidence(input({ targetSkills: ["prioritization"], checkpoints: [{ id: "c", nodeId: "x", kind: "decision", transcript: tx("i cut the second weekend instead of vendor spots cuz the team needed the vendors") }] }));
    expect(b[0].level).toBe(a[0].level);
  });
});
