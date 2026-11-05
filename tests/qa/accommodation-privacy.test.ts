import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { buildExport } from "@/lib/ats/ats";
import { compareFor } from "@/lib/card/compare";
import { cardFor, decide, inboxFor } from "@/lib/card/recruiter";
import { CardSchema, type Card } from "@/lib/card/types";
import { resultPayload } from "@/lib/integrations/outbound";
import { summarize } from "@/lib/integrations/summary";
import { makeStore, MemoryKV } from "@/lib/store/store";

// Privacy guard (judge feedback): whether a candidate used extra time or turn-based play (an accommodation)
// never reaches an employer. Not in the inbox, the card a recruiter opens, the compare view, the Greenhouse
// export, the ATS result or the public API summary. Only aggregate fairness reporting (admin) uses it.
const LEAK = /adjusted|timeMultiplier|accommodation|extra time|turnBased/i;

function setup() {
  const s = makeStore(new MemoryKV());
  const base = CardSchema.parse(fixture);
  const a: Card = { ...base, attemptId: "att_a", adjustedTiming: true };
  const b: Card = { ...base, attemptId: "att_b", anonId: "Candidate B", adjustedTiming: false };
  for (const c of [a, b]) {
    s.saveCard(c);
    s.share(c.attemptId, "ch1", false);
  }
  s.saveProfile({ accommodations: { timeMultiplier: 2, textOnly: true, screenReader: false, reducedMotion: false, lowBandwidth: false } });
  return { s, a, b };
}

describe("QA: accommodation status never reaches an employer", () => {
  it("inbox rows", () => {
    const { s, a } = setup();
    expect(JSON.stringify(inboxFor(s, "ch1", a.targetSkills))).not.toMatch(LEAK);
  });

  it("the card a recruiter opens", () => {
    const { s } = setup();
    const v = cardFor(s, "att_a", "ch1");
    expect(v?.status).toBe("ok");
    if (v?.status === "ok") {
      expect(v.card.adjustedTiming).toBe(false);
      const { adjustedTiming: _drop, ...rest } = v.card;
      void _drop;
      expect(JSON.stringify(rest)).not.toMatch(LEAK);
    }
  });

  it("the compare view", () => {
    const { s, a } = setup();
    const c = compareFor(s, "ch1", ["att_a", "att_b"], a.targetSkills);
    expect(c.ok).toBe(true);
    expect(JSON.stringify(c)).not.toMatch(LEAK);
  });

  it("the Greenhouse export, the ATS result and the API summary", () => {
    const { s, a } = setup();
    decide(s, "att_a", "ch1", "shortlist");
    expect(JSON.stringify(buildExport(s, { id: "ch1", anonymousReview: true }, "https://tp.example"))).not.toMatch(LEAK);
    const summary = summarize(a);
    expect(JSON.stringify(summary)).not.toMatch(LEAK);
    expect(JSON.stringify(resultPayload(summary, "https://tp.example"))).not.toMatch(LEAK);
  });
});
