import { describe, expect, it } from "vitest";
import { makeStore, MemoryKV } from "@/lib/store/store";

// QA night (C7.5, "candidates own their data"): Delete everything left `tp:camera-check:<attempt>` behind, the
// per-run record of how the candidate chose to answer (video, voice or text).
describe("QA: delete everything leaves no candidate key", () => {
  it("removes the camera-check choice with everything else", () => {
    const kv = new MemoryKV();
    const s = makeStore(kv);
    s.saveProfile({ displayName: "Sam" });
    kv.setItem("tp:camera-check:att_1", "text");
    kv.setItem("tp:x:challenges", "[]"); // employer data stays
    s.deleteAll();
    expect(kv.getItem("tp:camera-check:att_1")).toBeNull();
    expect(kv.getItem("tp:profile")).toBeNull();
    expect(kv.getItem("tp:x:challenges")).toBe("[]");
  });

  it("deleting one attempt removes its camera-check choice", () => {
    const kv = new MemoryKV();
    const s = makeStore(kv);
    kv.setItem("tp:camera-check:att_1", "voice");
    kv.setItem("tp:camera-check:att_2", "text");
    s.deleteAttempt("att_1");
    expect(kv.getItem("tp:camera-check:att_1")).toBeNull();
    expect(kv.getItem("tp:camera-check:att_2")).toBe("text");
  });
});
