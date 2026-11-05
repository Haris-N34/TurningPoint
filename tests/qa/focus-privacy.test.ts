import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { buildExport } from "@/lib/ats/ats";
import { compareFor } from "@/lib/card/compare";
import { cardFor, decide, inboxFor } from "@/lib/card/recruiter";
import { CardSchema, type Card } from "@/lib/card/types";
import { resultPayload } from "@/lib/integrations/outbound";
import { summarize } from "@/lib/integrations/summary";
import { makeStore, MemoryKV } from "@/lib/store/store";

// Decision (parent, judge feedback): focus-loss notes ("Window lost focus...") are the candidate's only. They
// never reach an employer view or export. Other integrity notes (retake used) stay as context.
const LEAK = /focus_lost|lost focus|focus/i;

function setup() {
  const s = makeStore(new MemoryKV());
  const base = CardSchema.parse(fixture);
  const mk = (id: string): Card => ({ ...base, attemptId: id, integrity: [...base.integrity, { checkpointId: "cp1", kind: "focus_lost", detail: "Window lost focus for 3 seconds during the answer" }] });
  for (const c of [mk("att_a"), mk("att_b")]) {
    s.saveCard(c);
    s.share(c.attemptId, "ch1", false);
  }
  return { s, base };
}

describe("focus-loss notes never reach an employer", () => {
  it("the recruiter's card keeps retakes but drops focus loss", () => {
    const { s } = setup();
    const v = cardFor(s, "att_a", "ch1");
    expect(v?.status).toBe("ok");
    if (v?.status === "ok") {
      expect(v.card.integrity.map((i) => i.kind)).not.toContain("focus_lost");
      expect(v.card.integrity.map((i) => i.kind)).toContain("retake_used");
    }
  });

  it("compare, inbox, Greenhouse export, ATS result and API summary", () => {
    const { s, base } = setup();
    expect(JSON.stringify(compareFor(s, "ch1", ["att_a", "att_b"], base.targetSkills))).not.toMatch(LEAK);
    expect(JSON.stringify(inboxFor(s, "ch1", base.targetSkills))).not.toMatch(LEAK);
    decide(s, "att_a", "ch1", "shortlist");
    expect(JSON.stringify(buildExport(s, { id: "ch1" }, "https://tp.example"))).not.toMatch(LEAK);
    const sum = summarize(s.getCard("att_a")!);
    expect(JSON.stringify(sum)).not.toMatch(LEAK);
    expect(JSON.stringify(resultPayload(sum, "https://tp.example"))).not.toMatch(LEAK);
  });
});
