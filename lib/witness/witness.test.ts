import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { addWitness, confirmationLine, isSelfWitness, respond, witnessByToken } from "./witness";

const now = new Date("2026-11-04T12:00:00Z");
function setup() {
  const s = makeStore(new MemoryKV());
  const card = CardSchema.parse(fixture);
  s.saveCard({ ...card, realStory: { ...card.realStory!, witnesses: [] } });
  return { s, card };
}
const base = { attemptId: "att_demo_maya", storyTitle: "The garden summer", candidateEmail: "maya.chen@ucalgary.ca" };

describe("witnesses (C6)", () => {
  it("rejects the candidate's own email and aliases (C6.5)", () => {
    expect(isSelfWitness("maya.chen@ucalgary.ca", "Maya.Chen@ucalgary.ca")).toBe(true);
    expect(isSelfWitness("maya.chen@ucalgary.ca", "maya.chen@cpsc.ucalgary.ca")).toBe(true);
    expect(isSelfWitness("maya.chen@ucalgary.ca", "maya@ucalgary.ca")).toBe(true);
    expect(isSelfWitness("maya.chen@gmail.com", "mayachen+ref@googlemail.com")).toBe(true);
    expect(isSelfWitness("maya.chen@ucalgary.ca", "prof.lee@ucalgary.ca")).toBe(false);
    expect(isSelfWitness("maya@gmail.com", "mayab@gmail.com")).toBe(false);
    const { s } = setup();
    expect(() => addWitness(s, { ...base, email: "maya.chen+x@ucalgary.ca", relationship: "peer" }, now, "a")).toThrow(/someone else/);
  });

  it("allows up to 2 witnesses with links that expire in 14 days (C6.1, C6.2)", () => {
    const { s } = setup();
    const a = addWitness(s, { ...base, email: "lead@gardenproject.org", relationship: "community_partner" }, now, "a");
    addWitness(s, { ...base, email: "sam@gmail.com", relationship: "peer" }, now, "b");
    expect(() => addWitness(s, { ...base, email: "third@gmail.com", relationship: "peer" }, now, "c")).toThrow(/Up to 2/);
    expect(a.link).toMatch(/^\/witness\/[a-z2-9]{24}$/);
    expect(a.record.emailHash).not.toMatch(/@/);
    expect(JSON.stringify(a.record)).not.toMatch(/gardenproject/);
    expect(witnessByToken(s, a.record.token, new Date("2026-11-18T11:59:00Z"))?.status).toBe("pending");
    expect(witnessByToken(s, a.record.token, new Date("2026-11-18T12:01:00Z"))?.status).toBe("expired");
    expect(() => respond(s, a.record.token, { confirmed: true }, new Date("2026-11-19T00:00:00Z"))).toThrow(/expired/);
  });

  it("confirms once and shows relationship, skills and sentence on the card, never the email (C6.4)", () => {
    const { s } = setup();
    const a = addWitness(s, { ...base, email: "lead@gardenproject.org", relationship: "supervisor" }, now, "a");
    respond(s, a.record.token, { confirmed: true, skillsSeen: ["resilience", "collaboration", "empathy", "feedback"], sentence: " She kept everyone informed. " }, now);
    expect(() => respond(s, a.record.token, { confirmed: true }, now)).toThrow(/already been used/);
    const card = s.getCard("att_demo_maya")!;
    const w = card.realStory!.witnesses[0];
    expect(w).toMatchObject({ relationship: "supervisor", status: "confirmed", sentence: "She kept everyone informed." });
    expect(w.skillsSeen).toHaveLength(3);
    expect(JSON.stringify(card)).not.toMatch(/gardenproject/);
    expect(confirmationLine(card.realStory!.witnesses)).toBe("Confirmed by 1 supervisor");
    expect(confirmationLine([{ relationship: "peer", status: "confirmed" }, { relationship: "peer", status: "confirmed" }, { relationship: "supervisor", status: "declined" }])).toBe("Confirmed by 2 peers");
  });

  it("records 'I can't confirm this' with no skills or sentence", () => {
    const { s } = setup();
    const a = addWitness(s, { ...base, email: "x@y.org", relationship: "peer" }, now, "a");
    const r = respond(s, a.record.token, { confirmed: false, skillsSeen: ["resilience"], sentence: "no" }, now);
    expect(r).toMatchObject({ status: "declined", skillsSeen: [] });
    expect(r.sentence).toBeUndefined();
  });
});
