import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { inboxFor } from "@/lib/card/recruiter";
import { CardSchema } from "@/lib/card/types";
import { makeStore, MemoryKV } from "@/lib/store/store";

// QA night: after a candidate revokes a share (C7.4) "nothing from it is shown". The inbox row still
// carried the name and university (once shortlisted), skill levels, witness status and the Final score,
// and the skill filter still matched on the withdrawn card's levels.
function setup() {
  const s = makeStore(new MemoryKV());
  const card = CardSchema.parse(fixture);
  s.saveCard(card);
  s.share(card.attemptId, "ch1", false);
  s.review({ attemptId: card.attemptId, challengeId: "ch1", decision: "shortlist" });
  s.revokeShare(card.attemptId, "ch1");
  return { s, card };
}

describe("QA: withdrawn card rows", () => {
  it("carry nothing from the card", () => {
    const { s, card } = setup();
    const [row] = inboxFor(s, "ch1", card.targetSkills);
    expect(row.status).toBe("withdrawn");
    expect(row.displayName).toBe(card.anonId);
    expect(row.university).toBeUndefined();
    expect(row.levels).toEqual({});
    expect(row.topSkills).toEqual([]);
    expect(row.finalScore).toBeUndefined();
    expect(row.witnessConfirmed).toBe(false);
    expect(JSON.stringify(row)).not.toContain("Maya");
  });

  it("are not matched by a skill filter on the withdrawn card's levels", () => {
    const { s, card } = setup();
    const rows = inboxFor(s, "ch1", card.targetSkills, { filter: { skill: "collaboration", minLevel: "some" } });
    expect(rows).toEqual([]);
  });
});
