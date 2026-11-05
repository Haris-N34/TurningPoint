import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { compareFor } from "./compare";
import { CardSchema, type Card } from "./types";

const CH = "ch_demo_energy";
const SKILLS = ["adaptability", "resilience", "prioritization", "collaboration"] as const;

function setup() {
  const s = makeStore(new MemoryKV());
  const base = CardSchema.parse(fixture);
  const make = (id: string, patch: Partial<Card> = {}) => {
    s.saveCard({ ...base, attemptId: id, anonId: `Candidate ${id}`, candidate: { displayName: `Synthetic ${id}`, verified: true }, ...patch });
    s.share(id, CH, false);
  };
  make("a");
  make("b", { evidence: base.evidence.map((e) => ({ skill: e.skill, level: "not_observed" as const })) });
  make("c", { evidence: base.evidence.map((e, i) => (i === 0 && e.source?.type === "clip" ? { ...e, source: { ...e.source, quote: "words never said" } } : e)) });
  make("d");
  return { s, base };
}

describe("E4.1 compare view", () => {
  it("takes 2 or 3 shared cards only", () => {
    const { s } = setup();
    expect(compareFor(s, CH, ["a"], [...SKILLS]).ok).toBe(false);
    expect(compareFor(s, CH, ["a", "a"], [...SKILLS]).ok).toBe(false);
    expect(compareFor(s, CH, ["a", "b", "c", "d"], [...SKILLS]).ok).toBe(false);
    expect(compareFor(s, CH, ["a", "nope"], [...SKILLS]).ok).toBe(false);
    expect(compareFor(s, CH, ["a", "b"], [...SKILLS]).ok).toBe(true);
    expect(compareFor(s, CH, ["a", "b", "c"], [...SKILLS]).ok).toBe(true);
  });

  it("keeps the recruiter's order: no ranking, no overall score", () => {
    const { s } = setup();
    for (const order of [["b", "a", "c"], ["c", "b", "a"]]) {
      const r = compareFor(s, CH, order, [...SKILLS]);
      if (!r.ok) throw new Error(r.reason);
      expect(r.columns.map((c) => c.attemptId)).toEqual(order);
    }
    const r = compareFor(s, CH, ["a", "b"], [...SKILLS]);
    expect(JSON.stringify(r)).not.toMatch(/"(score|rank|overall|total)"/i);
  });

  it("shows skill strips in the employer's skill order, with only verified quotes", () => {
    const { s, base } = setup();
    const r = compareFor(s, CH, ["a", "b", "c"], [...SKILLS]);
    if (!r.ok) throw new Error(r.reason);
    for (const col of r.columns) expect(col.skills.map((x) => x.skill)).toEqual([...SKILLS]);
    const a = r.columns[0];
    for (const x of a.skills) if (x.quote) expect(base.checkpoints.some((c) => c.transcript.text.includes(x.quote!))).toBe(true);
    expect(r.columns[1].skills.every((x) => x.level === "not_observed" && !x.quote)).toBe(true);
    const tampered = base.evidence[0].skill;
    expect(r.columns[2].skills.find((x) => x.skill === tampered)!.quote).toBeUndefined();
  });

  it("lines up answers to the same checkpoint type side by side", () => {
    const { s, base } = setup();
    const r = compareFor(s, CH, ["a", "b"], [...SKILLS]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.rows.map((x) => x.kind)).toEqual(["decision", "decision", "real_life", "follow_up"]);
    for (const row of r.rows) {
      expect(row.answers).toHaveLength(2);
      const cp = base.checkpoints.filter((c) => c.kind === row.kind)[row.slot];
      expect(row.answers[0]).toMatchObject({ question: cp.question, text: cp.transcript.text });
    }
  });

  it("respects anonymous review and blocks withdrawn cards", () => {
    const { s } = setup();
    const r = compareFor(s, CH, ["a", "b"], [...SKILLS]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.columns.map((c) => c.displayName)).toEqual(["Candidate a", "Candidate b"]);
    expect(JSON.stringify(r)).not.toContain("Synthetic");
    s.review({ attemptId: "a", challengeId: CH, decision: "shortlist" });
    const after = compareFor(s, CH, ["a", "b"], [...SKILLS]);
    expect(after.ok && after.columns[0].displayName).toBe("Synthetic a");
    s.revokeShare("b", CH);
    expect(compareFor(s, CH, ["a", "b"], [...SKILLS])).toEqual({ ok: false, reason: "One of these candidates withdrew their card." });
  });
});
