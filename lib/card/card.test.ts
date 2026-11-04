import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "./types";
import { verifyEvidence } from "./verify";

describe("fixtures/attempt.json (M0.4)", () => {
  const card = CardSchema.parse(fixture);

  it("matches the card schema", () => {
    expect(card.targetSkills).toHaveLength(4);
  });

  it("every evidence quote is verbatim and timestamped", () => {
    const { dropped } = verifyEvidence(card);
    expect(dropped).toEqual([]);
  });

  it("never has an overall score (F2)", () => {
    expect(JSON.stringify(fixture)).not.toMatch(/"(score|overall|rating)"/i);
  });

  it("never exposes a witness email (C6.4)", () => {
    expect(JSON.stringify(card.realStory)).not.toMatch(/@/);
  });
});

describe("verifyEvidence (G1)", () => {
  const card = CardSchema.parse(fixture);

  it("drops an invented quote and downgrades the skill", () => {
    const bad = structuredClone(card);
    const e = bad.evidence[0];
    if (e.source?.type === "clip") e.source.quote = "I am a natural leader.";
    const { evidence, dropped } = verifyEvidence(bad);
    expect(dropped).toHaveLength(1);
    expect(evidence[0].level).toBe("some");
    expect(evidence[0].source).toBeUndefined();
  });

  it("drops a quote that is close but not exact", () => {
    const bad = structuredClone(card);
    const e = bad.evidence[1];
    expect(e.level).toBe("strong");
    if (e.source?.type === "clip") e.source.quote = e.source.quote.replace("instead of", "rather than");
    expect(verifyEvidence(bad).evidence[1].level).toBe("some");
  });

  it("drops a choice source that is not in the log", () => {
    const bad = structuredClone(card);
    bad.evidence[2] = { skill: "adaptability", level: "some", sentence: "x", source: { type: "choice", nodeId: "n99", optionId: "z", optionLabel: "?" } };
    const r = verifyEvidence(bad);
    expect(r.evidence[2].level).toBe("not_observed");
    expect(r.evidence[2].sentence).toBeUndefined();
  });
});
