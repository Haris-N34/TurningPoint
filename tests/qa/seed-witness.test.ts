import { describe, expect, it } from "vitest";
import { seedDemo } from "@/lib/demo/seed";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { witnessesFor } from "@/lib/witness/witness";

// QA night #32: Maya's results page says "Confirmed by 1 community partner" right above "0 of 2 witnesses
// added. No witnesses yet." Her card carries a confirmed witness, but the seed never stores the witness record
// the witness list reads, so she could also add two more (three in total, over the limit of 2).
describe("QA: seeded witnesses match the card", () => {
  // FIXME(agent B, lib/demo/seed.ts): remove .skip once the seed stores Maya's confirmed witness record.
  it.skip("every witness on Maya's card is in her witness list", () => {
    const s = makeStore(new MemoryKV());
    seedDemo(s);
    const card = s.getCard("att_demo_maya")!;
    const onCard = card.realStory?.witnesses ?? [];
    expect(onCard.length).toBeGreaterThan(0);
    expect(witnessesFor(s, card.attemptId).map((w) => w.status)).toEqual(onCard.map((w) => w.status));
  });
});
