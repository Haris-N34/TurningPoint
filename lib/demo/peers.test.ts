import { describe, expect, it } from "vitest";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { verifyEvidence } from "@/lib/card/verify";
import { impactReport } from "@/lib/impact/metrics";
import { seedDemo } from "./seed";
import { isPeer, PEER_COUNT } from "./peers";

describe("demo inbox peers", () => {
  it("adds a few clearly synthetic candidates next to Maya, with checked quotes, outside the impact numbers", () => {
    const s = makeStore(new MemoryKV());
    seedDemo(s);
    const peers = s.sharesFor("ch_demo_energy").map((x) => x.attemptId).filter(isPeer);
    expect(peers).toHaveLength(PEER_COUNT);
    for (const id of peers) {
      const card = s.getCard(id)!;
      expect(card.candidate.displayName).toMatch(/^Synthetic candidate \d{3}$/);
      expect(card.candidate.university).toBeUndefined();
      // Every quote is an exact substring of its transcript (G1).
      expect(verifyEvidence(card).evidence).toHaveLength(card.evidence.length);
      // Maya stays the most recent card, so she leads the default inbox order.
      expect(card.finishedAt < s.getCard("att_demo_maya")!.finishedAt).toBe(true);
    }
    // Seeding twice adds nothing new.
    seedDemo(s);
    expect(s.sharesFor("ch_demo_energy").filter((x) => isPeer(x.attemptId))).toHaveLength(PEER_COUNT);
    expect(impactReport(s).finished).toBe(1);
  });
});
