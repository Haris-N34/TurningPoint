import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { reportFinished, saveInvite } from "@/lib/integrations/client";
import { PRACTICE_CHALLENGE } from "@/lib/practice/practice";
import { makeStore, MemoryKV } from "@/lib/store/store";

// QA night: opening the results page posted the evidence summary to the employer side for every finished
// card, invited or not, practice included. The server kept it and served it on /api/v1/attempts.
const card = CardSchema.parse(fixture);
const spy = () => {
  const calls: unknown[] = [];
  return { calls, post: async (b: unknown) => (calls.push(b), {}) };
};

describe("QA: results are reported to an ATS only for an invited, real attempt", () => {
  it("no invite: nothing is sent", async () => {
    const s = makeStore(new MemoryKV());
    const { calls, post } = spy();
    await reportFinished(card, s, post);
    expect(calls).toHaveLength(0);
  });

  it("practice: nothing is sent, even with an invite", async () => {
    const s = makeStore(new MemoryKV());
    const practice = CardSchema.parse({ ...fixture, attemptId: "att_p", challenge: { ...fixture.challenge, id: PRACTICE_CHALLENGE.id } });
    s.setJSON(`invite:${PRACTICE_CHALLENGE.id}`, "inv_x");
    const { calls, post } = spy();
    await reportFinished(practice, s, post);
    expect(calls).toHaveLength(0);
  });

  it("invited: sent once, with the invite token", async () => {
    const s = makeStore(new MemoryKV());
    s.setJSON(`invite:${card.challenge.id}`, "inv_123");
    const { calls, post } = spy();
    await reportFinished(card, s, post);
    await reportFinished(card, s, post);
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(calls[0])).toContain("inv_123");
    void saveInvite;
  });
});
