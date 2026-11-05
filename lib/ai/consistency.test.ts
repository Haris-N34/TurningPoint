import { describe, expect, it } from "vitest";
import { seedDemo } from "@/lib/demo/seed";
import { makeStore, MemoryKV } from "@/lib/store/store";

// B.4: said vs did reaches the card as context. No evidence level depends on it.

describe("said vs did on cards (B.4)", () => {
  it("the demo card carries explanation and story comparisons", () => {
    const s = makeStore(new MemoryKV());
    seedDemo(s);
    const card = s.getCard("att_demo_maya")!;
    const kinds = (card.consistency ?? []).map((c) => c.kind);
    expect(kinds).toContain("explanation");
    expect(kinds).toContain("story");
    for (const c of card.consistency!.filter((x) => x.kind !== "order")) {
      const all = card.checkpoints.map((cp) => cp.transcript.text).join("\n");
      expect(all).toContain(c.said);
    }
  });
  it("consistency never changes evidence levels", () => {
    const s = makeStore(new MemoryKV());
    seedDemo(s);
    const card = s.getCard("att_demo_maya")!;
    const flipped = { ...card, consistency: card.consistency!.map((c) => ({ ...c, consistent: !c.consistent })) };
    expect(flipped.evidence).toEqual(card.evidence);
  });
});
