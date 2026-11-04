import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { cardFor, decide, inboxFor } from "./recruiter";
import { CardSchema } from "./types";

function setup() {
  const s = makeStore(new MemoryKV());
  const card = CardSchema.parse(fixture);
  s.saveCard(card);
  s.share(card.attemptId, "ch1", false);
  return { s, card };
}

describe("recruiter data APIs (AI.3, E3.7, E6.1, C7.2, C7.4)", () => {
  it("lists shared cards anonymously and reveals the name after shortlist", () => {
    const { s, card } = setup();
    expect(inboxFor(s, "ch1", card.targetSkills)[0].displayName).toBe(card.anonId);
    decide(s, card.attemptId, "ch1", "shortlist");
    expect(inboxFor(s, "ch1", card.targetSkills)[0]).toMatchObject({ displayName: "Maya Chen", status: "shortlist" });
    expect(inboxFor(s, "other", card.targetSkills)).toEqual([]);
  });

  it("needs a reason to pass", () => {
    const { s, card } = setup();
    expect(() => decide(s, card.attemptId, "ch1", "pass")).toThrow(/reason/);
    decide(s, card.attemptId, "ch1", "pass", "Position filled");
    expect(inboxFor(s, "ch1", [])[0].status).toBe("pass");
  });

  it("strips hidden clips and blocks withdrawn cards", () => {
    const { s, card } = setup();
    s.saveCard({ ...card, checkpoints: card.checkpoints.map((c) => (c.id === "cp2" ? { ...c, hidden: true } : c)) });
    const v = cardFor(s, card.attemptId, "ch1");
    expect(v?.status).toBe("ok");
    if (v?.status === "ok") {
      expect(v.hiddenClipIds).toEqual(["cp2"]);
      expect(v.card.checkpoints.find((c) => c.id === "cp2")?.media).toBeUndefined();
      // Transcripts are never editable or removed by hiding (C7.2).
      expect(v.card.checkpoints.find((c) => c.id === "cp2")?.transcript.text).toBe(card.checkpoints[1].transcript.text);
    }
    s.revokeShare(card.attemptId, "ch1");
    expect(cardFor(s, card.attemptId, "ch1")).toEqual({ status: "withdrawn" });
  });
});
