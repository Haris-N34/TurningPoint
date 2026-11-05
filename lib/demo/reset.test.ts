import { describe, expect, it } from "vitest";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { listChallenges } from "@/lib/challenge/challenge";
import { clearDemoKeys, DEMO_JUMPS, resetDemo } from "./reset";
import { isPeer } from "./peers";

describe("P.2 demo reset", () => {
  it("clears every tp: key, keeps other keys, clears media and reloads the seed", async () => {
    const kv = new MemoryKV();
    const s = makeStore(kv);
    s.setRole("admin");
    s.saveProfile({ displayName: "Someone" });
    s.setJSON("witnesses", [{ id: "w1" }]);
    kv.setItem("tp:run:att_x", "{}");
    kv.setItem("other-app", "keep");
    let mediaCleared = 0;
    await resetDemo(s, kv, { clear: async () => void mediaCleared++ });

    expect(mediaCleared).toBe(1);
    expect(kv.getItem("other-app")).toBe("keep");
    expect(kv.getItem("tp:run:att_x")).toBeNull();
    // The visitor's witnesses are gone; only the seeded demo witness (on Maya's card) is back.
    expect((JSON.parse(kv.getItem("tp:x:witnesses") ?? "[]") as { attemptId?: string }[]).map((w) => w.attemptId)).toEqual(["att_demo_maya"]);
    expect(s.getRole()).toBe("candidate");
    expect(s.getProfile().displayName ?? "").toBe("");
    // Seed is back: two demo employers, Maya's card shared with the first, plus the labelled synthetic peers.
    expect(listChallenges(s).map((c) => c.id).sort()).toEqual(["ch_demo_bank", "ch_demo_energy"]);
    expect(s.getCard("att_demo_maya")).toBeTruthy();
    expect(s.sharesFor("ch_demo_energy").map((x) => x.attemptId).filter((id) => !isPeer(id))).toEqual(["att_demo_maya"]);
  });

  it("still reseeds when media cannot be cleared (no IndexedDB)", async () => {
    const kv = new MemoryKV();
    const s = makeStore(kv);
    await resetDemo(s, kv, { clear: async () => { throw new Error("no idb"); } });
    expect(s.getCard("att_demo_maya")).toBeTruthy();
  });

  it("clearDemoKeys removes only tp: keys", () => {
    const kv = new MemoryKV();
    kv.setItem("tp:a", "1");
    kv.setItem("tp:b", "2");
    kv.setItem("x", "3");
    expect(clearDemoKeys(kv)).toBe(2);
    expect(kv.length).toBe(1);
  });

  it("jump links cover game, turning point, results, recruiter card and admin impact", () => {
    expect(DEMO_JUMPS.map((j) => j.href)).toEqual([
      "/game/launch-week",
      "/game/launch-week?jump=turning-point",
      "/results/att_demo_maya",
      "/recruiter/card/att_demo_maya?challenge=ch_demo_energy",
      "/admin/impact",
    ]);
  });
});
