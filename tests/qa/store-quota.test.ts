import { describe, expect, it } from "vitest";
import { z } from "zod";
import { makeStore, MemoryKV } from "@/lib/store/store";

// QA night: a full localStorage (Safari's 5 MB fills after "Load 200 fictional candidates") made every store
// write throw QuotaExceededError, and the map game crashed right after "Let's go". Writes must not throw:
// the value stays readable for this session, and the app is told storage is full.
class FullKV extends MemoryKV {
  full = false;
  setItem(k: string, v: string) {
    if (this.full) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    super.setItem(k, v);
  }
}

describe("QA: store survives a full disk", () => {
  it("writes never throw, and what was written reads back this session", () => {
    const kv = new FullKV();
    let warned = 0;
    const s = makeStore(kv, undefined, { onFull: () => warned++ });
    kv.full = true;
    const run = { attemptId: "a1", challengeId: "c1", scenarioId: "map:launch-week", seed: "x", state: { t: 1 }, extra: {}, status: "playing" as const, startedAt: "2026-11-05T10:00:00Z", practice: false };
    expect(() => s.saveRun(run)).not.toThrow();
    expect(s.getRun("a1")?.state).toEqual({ t: 1 });
    expect(s.listRuns().map((r) => r.attemptId)).toEqual(["a1"]);
    expect(() => s.setJSON("muted", true)).not.toThrow();
    expect(warned).toBeGreaterThan(0);
  });

  it("a later successful write wins over the session copy, and removal clears it", () => {
    const kv = new FullKV();
    const s = makeStore(kv);
    kv.full = true;
    s.setRole("recruiter");
    expect(s.getRole()).toBe("recruiter");
    kv.full = false;
    s.setRole("admin");
    expect(s.getRole()).toBe("admin");
    kv.full = true;
    s.setJSON("witnesses", []);
    s.deleteAll();
    expect(s.getJSON("witnesses", z.array(z.unknown()))).toBeUndefined();
  });
});
