import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { makeStore, MemoryKV } from "./store";

const clock = () => {
  let t = Date.parse("2026-11-04T12:00:00Z");
  return () => new Date((t += 1000));
};

describe("local store (M0.5, M0.6)", () => {
  it("defaults the profile and keeps the improvement opt-in off (PV2)", () => {
    const s = makeStore(new MemoryKV());
    const p = s.getProfile();
    expect(p.improvementOptIn).toBe(false);
    expect(p.accommodations.timeMultiplier).toBe(1);
    expect(s.getRole()).toBe("candidate");
  });

  it("saves profile changes and role", () => {
    const s = makeStore(new MemoryKV());
    s.saveProfile({ displayName: "Maya", accommodations: { timeMultiplier: 2, textOnly: false, screenReader: false, reducedMotion: false, lowBandwidth: false } });
    s.setRole("recruiter");
    expect(s.getProfile().accommodations.timeMultiplier).toBe(2);
    expect(s.getRole()).toBe("recruiter");
  });

  it("saves and resumes a run (C2.4)", () => {
    const kv = new MemoryKV();
    const s = makeStore(kv, clock());
    s.saveRun({ attemptId: "a1", challengeId: "ch1", scenarioId: "mini", seed: "a1", state: { nodeId: "c1" }, extra: {}, status: "paused", startedAt: "2026-11-04T12:00:00Z", practice: false });
    // A fresh store over the same storage (a refresh) finds it.
    const again = makeStore(kv);
    expect(again.activeRun("ch1")?.state).toEqual({ nodeId: "c1" });
    again.saveRun({ ...again.getRun("a1")!, status: "finished" });
    expect(again.activeRun("ch1")).toBeUndefined();
  });

  it("stores cards, shares, revokes (C7.3, C7.4)", () => {
    const s = makeStore(new MemoryKV(), clock());
    const card = CardSchema.parse(fixture);
    s.saveCard(card);
    expect(s.getCard(card.attemptId)?.anonId).toBe(card.anonId);
    s.share(card.attemptId, "ch2", true);
    expect(s.sharesFor("ch2")[0].reused).toBe(true);
    s.revokeShare(card.attemptId, "ch2");
    expect(s.sharesFor("ch2")[0].revokedAt).toBeDefined();
    // Sharing again after a revoke makes a fresh, active share.
    s.share(card.attemptId, "ch2", true);
    expect(s.sharesFor("ch2").filter((x) => !x.revokedAt)).toHaveLength(1);
  });

  it("requires a reason to pass (E3.7, F2)", () => {
    const s = makeStore(new MemoryKV(), clock());
    expect(() => s.review({ attemptId: "a", challengeId: "c", decision: "pass" })).toThrow(/reason/);
    expect(() => s.review({ attemptId: "a", challengeId: "c", decision: "pass", reason: "  " })).toThrow(/reason/);
    s.review({ attemptId: "a", challengeId: "c", decision: "pass", reason: "Position filled" });
    s.review({ attemptId: "a", challengeId: "c", decision: "shortlist" });
    expect(s.listReviews()).toHaveLength(1);
    expect(s.reviewFor("a", "c")?.decision).toBe("shortlist");
  });

  it("deletes everything (C7.5)", () => {
    const kv = new MemoryKV();
    kv.setItem("other-app", "keep");
    const s = makeStore(kv, clock());
    s.saveProfile({ displayName: "Maya" });
    s.saveCard(CardSchema.parse(fixture));
    s.share("att_demo_maya", "ch2", false);
    s.setJSON("challenges", [{ id: "ch2" }]);
    s.setJSON("witnesses", [{ id: "w1" }]);
    s.deleteAll();
    expect(kv.getItem("tp:x:challenges")).not.toBeNull(); // employer data stays
    expect(kv.getItem("tp:x:witnesses")).toBeNull();
    expect(s.listShares()).toEqual([]);
    expect(s.listCards()).toEqual([]);
    expect(s.getProfile().displayName).toBe("");
    expect(kv.getItem("other-app")).toBe("keep");
  });

  it("ignores corrupt data instead of crashing", () => {
    const kv = new MemoryKV();
    kv.setItem("tp:profile", "{not json");
    expect(makeStore(kv).getProfile().displayName).toBe("");
  });
});
