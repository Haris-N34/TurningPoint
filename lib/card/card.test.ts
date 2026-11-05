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
    // KPIs carry their own 0 to 100 score (Part D inputs). Nothing else on the card is a score, and nothing is overall.
    const { kpis, ...rest } = fixture as typeof fixture & { kpis?: unknown[] };
    expect(JSON.stringify(rest)).not.toMatch(/"(score|overall|rating)"/i);
    expect(JSON.stringify(kpis ?? [])).not.toMatch(/"(overall|rating)"/i);
  });

  it("never exposes a witness email (C6.4)", () => {
    expect(JSON.stringify(card.realStory)).not.toMatch(/@/);
  });
});

describe("review contract (E3.7)", () => {
  it("rejects a pass with no reason or a blank reason", () => {
    const base = { ...fixture, review: { decision: "pass", at: "2026-11-04T18:00:00Z" } };
    expect(CardSchema.safeParse(base).success).toBe(false);
    expect(CardSchema.safeParse({ ...base, review: { ...base.review, reason: "   " } }).success).toBe(false);
    expect(CardSchema.safeParse({ ...base, review: { ...base.review, reason: "Position filled" } }).success).toBe(true);
    expect(CardSchema.safeParse({ ...base, review: { decision: "hold", at: "2026-11-04T18:00:00Z" } }).success).toBe(true);
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
    expect(evidence[0].level).toBe("needs_review");
    expect(evidence[0].source).toBeUndefined();
    // The AI sentence described the invented quote, so it must not survive (E3.8).
    expect(evidence[0].sentence).toBeUndefined();
  });

  it("drops a quote that is close but not exact", () => {
    const bad = structuredClone(card);
    const e = bad.evidence[1];
    expect(e.level).toBe("strong");
    // One word changed: no longer an exact substring.
    if (e.source?.type === "clip") e.source.quote = e.source.quote.replace("protected", "kept");
    expect(verifyEvidence(bad).evidence[1].level).toBe("needs_review");
  });

  it("never lets an unsourced AI sentence or level through (E3.8)", () => {
    const bad = structuredClone(card);
    bad.evidence = [
      { skill: "collaboration", level: "strong", sentence: "Great team player." },
      { skill: "prioritization", level: "some", sentence: "Prioritised well." },
      { skill: "adaptability", level: "needs_review", sentence: "Unclear." },
      { skill: "resilience", level: "not_observed", sentence: "Nothing here." },
    ];
    const { evidence, dropped } = verifyEvidence(bad);
    expect(evidence.map((e) => e.level)).toEqual(["not_observed", "not_observed", "needs_review", "not_observed"]);
    expect(evidence.every((e) => e.sentence === undefined)).toBe(true);
    expect(dropped).toHaveLength(2);
  });

  it("keeps a verified choice source with its sentence", () => {
    const ok = structuredClone(card);
    const step = ok.decisionPath[1];
    ok.evidence = [{ skill: "collaboration", level: "some", sentence: "Let the team decide.", source: { type: "choice", nodeId: step.nodeId, optionId: step.optionId, optionLabel: step.optionLabel } }];
    expect(verifyEvidence(ok).evidence[0]).toEqual(ok.evidence[0]);
  });

  it("drops a choice source that is not in the log", () => {
    const bad = structuredClone(card);
    bad.evidence[2] = { skill: "adaptability", level: "some", sentence: "x", source: { type: "choice", nodeId: "n99", optionId: "z", optionLabel: "?" } };
    const r = verifyEvidence(bad);
    expect(r.evidence[2].level).toBe("not_observed");
    expect(r.evidence[2].sentence).toBeUndefined();
  });
});
