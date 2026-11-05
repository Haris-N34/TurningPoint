import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { comparisonFor } from "./compare";

describe("side-by-side recruiter comparison", () => {
  it("requires two or three distinct shared cards and honours anonymous review, hidden media and withdrawal", () => {
    const s = makeStore(new MemoryKV());
    const base = CardSchema.parse(fixture);
    for (const id of ["one", "two", "three", "four"]) {
      s.saveCard({ ...base, attemptId: id, checkpoints: base.checkpoints.map((c) => ({ ...c, media: "private-clip", hidden: true })) });
      s.share(id, "challenge", false);
    }
    expect(comparisonFor(s, "challenge", ["one"])).toEqual([]);
    expect(comparisonFor(s, "challenge", ["one", "one"])).toEqual([]);
    expect(comparisonFor(s, "challenge", ["one", "two", "three", "four"])).toEqual([]);
    expect(comparisonFor(s, "other", ["one", "two"])).toEqual([]);
    const cards = comparisonFor(s, "challenge", ["one", "two", "three"]);
    expect(cards).toHaveLength(3);
    expect(cards.every((v) => v.name.anonymous && v.card.checkpoints.every((c) => !c.media))).toBe(true);
    s.revokeShare("two", "challenge");
    expect(comparisonFor(s, "challenge", ["one", "two", "three"])).toHaveLength(2);
  });
  it("drops unsupported quotes before presenting evidence", () => {
    const s = makeStore(new MemoryKV());
    const base = CardSchema.parse(fixture);
    for (const id of ["one", "two"]) {
      s.saveCard({ ...base, attemptId: id, evidence: [{ skill: "collaboration", level: "strong", sentence: "Unsupported claim", source: { type: "clip", checkpointId: base.checkpoints[0].id, quote: "invented quote", startS: 0, endS: 1 } }] });
      s.share(id, "challenge", false);
    }
    expect(comparisonFor(s, "challenge", ["one", "two"]).every((v) => !v.card.evidence[0].sentence)).toBe(true);
  });
});
