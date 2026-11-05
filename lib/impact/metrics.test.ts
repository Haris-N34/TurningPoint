import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { impactReport } from "./metrics";
import { seedImpactDemo } from "./seed";

const fresh = () => makeStore(new MemoryKV());

describe("impact reporting", () => {
  it("uses empty states rather than made-up denominators or review durations", () => {
    const report = impactReport(fresh());
    expect(report.finished).toBe(0);
    expect(report.strongRate).toBeNull();
    expect(report.reviewMinutes).toBeNull();
    expect(report.groups).toEqual([]);
  });
  it("counts cards once, deduplicates completed runs, and respects employer scope", () => {
    const s = fresh();
    const card = CardSchema.parse(fixture);
    s.saveCard(card);
    s.saveRun({ attemptId: card.attemptId, challengeId: card.challenge.id, scenarioId: card.scenario.id, seed: "x", state: {}, status: "finished", startedAt: card.finishedAt, practice: false, extra: {} });
    s.share(card.attemptId, "another", true);
    const r = impactReport(s);
    expect(r.started).toBe(1);
    expect(r.finished).toBe(1);
    expect(impactReport(s, "another").finished).toBe(1);
    expect(impactReport(s, "unknown").finished).toBe(0);
  });
  it("seeds exactly 200 fictional candidates across 3 employers, idempotently without replacing existing data", () => {
    const s = fresh();
    const real = CardSchema.parse(fixture);
    s.saveCard(real);
    seedImpactDemo(s);
    const first = impactReport(s, undefined, "demo");
    expect(first.started).toBe(200);
    expect(first.finished).toBe(160);
    expect(first.employers).toBe(3);
    expect(s.getCard(real.attemptId)).toEqual(real);
    seedImpactDemo(s);
    expect(impactReport(s, undefined, "demo")).toEqual(first);
    expect(impactReport(s, undefined, "live").finished).toBe(1);
    expect(first.groups.some((g) => g.warning)).toBe(true);
    s.deleteAll();
    expect(impactReport(s).started).toBe(0);
  });
  it("flags strictly below four-fifths and uses completed candidates as the denominator", () => {
    const s = fresh();
    const base = CardSchema.parse(fixture);
    for (const [index, mode] of (["text", "voice", "video"] as const).entries()) {
      for (let i = 0; i < 10; i++) {
        const id = `${mode}-${i}`;
        s.saveCard({ ...base, attemptId: id });
        s.saveRun({ attemptId: id, challengeId: base.challenge.id, scenarioId: "launch-week", seed: id, state: {}, status: "finished", startedAt: base.finishedAt, practice: false, extra: { impactParticipation: { mode, adjustedTiming: false } } });
        if (i < [10, 8, 7][index]) s.review({ attemptId: id, challengeId: base.challenge.id, decision: "shortlist" });
      }
    }
    const r = impactReport(s);
    expect(r.groups.find((g) => g.label === "text")).toMatchObject({ rate: 1, warning: false });
    expect(r.groups.find((g) => g.label === "voice")).toMatchObject({ rate: 0.8, warning: false });
    expect(r.groups.find((g) => g.label === "video")).toMatchObject({ rate: 0.7, warning: true });
  });
  it("suppresses fairness comparisons below ten completed candidates and never guesses demographics", () => {
    const s = fresh();
    s.saveCard(CardSchema.parse(fixture));
    const r = impactReport(s);
    expect(r.groups.every((g) => g.rate === null && !g.warning)).toBe(true);
    expect(r.demographics).toEqual([]);
  });
});
