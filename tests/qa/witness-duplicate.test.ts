import { describe, expect, it } from "vitest";
import { addWitness, confirmationLine, respond, witnessesFor } from "@/lib/witness/witness";
import { makeStore, MemoryKV } from "@/lib/store/store";

// QA night (C6): the same person could fill both witness slots, under the same address or an alias
// (Gmail dots, +tags, googlemail). Two confirmations from one person read as "Confirmed by 2 supervisors".
const base = { attemptId: "att1", storyTitle: "Food bank move", relationship: "supervisor" as const, candidateEmail: "me@example.com" };

describe("QA: one witness, one slot", () => {
  it.each([
    ["sam.lee@gmail.com", "sam.lee@gmail.com"],
    ["sam.lee@gmail.com", "SamLee+tp@googlemail.com"],
    ["sam@foodbank.org", " Sam@FoodBank.org "],
  ])("rejects %s then %s", (a, b) => {
    const s = makeStore(new MemoryKV());
    addWitness(s, { ...base, email: a });
    expect(() => addWitness(s, { ...base, email: b })).toThrow(/already/i);
    expect(witnessesFor(s, "att1")).toHaveLength(1);
  });

  it("still allows two different people", () => {
    const s = makeStore(new MemoryKV());
    const one = addWitness(s, { ...base, email: "sam@foodbank.org" });
    const two = addWitness(s, { ...base, email: "kim@foodbank.org", relationship: "peer" });
    respond(s, one.record.token, { confirmed: true });
    respond(s, two.record.token, { confirmed: true });
    expect(confirmationLine(witnessesFor(s, "att1"))).toBe("Confirmed by 1 supervisor, 1 peer");
  });
});
