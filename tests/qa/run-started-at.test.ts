import { describe, expect, it } from "vitest";
import { purgeExpiredPractice } from "@/lib/practice/practice";
import { makeStore, MemoryKV } from "@/lib/store/store";

// QA night: the map game saves after every move with startedAt = now, so a run's start moved forward on every
// save. The 24-hour practice purge (C8.1) counts from startedAt and could never fire on an active run, and
// "started" timing in reports was wrong. saveRun keeps the first start.
const run = (startedAt: string) => ({ attemptId: "a1", challengeId: "practice:sample", scenarioId: "sample", seed: "s", state: {}, extra: {}, status: "playing" as const, startedAt, practice: true });

describe("QA: a run keeps its first start time", () => {
  it("later saves never move startedAt", () => {
    const s = makeStore(new MemoryKV());
    s.saveRun(run("2026-11-04T08:00:00.000Z"));
    s.saveRun(run("2026-11-05T09:00:00.000Z"));
    expect(s.getRun("a1")?.startedAt).toBe("2026-11-04T08:00:00.000Z");
  });

  it("so the practice purge fires 24 hours after the real start", () => {
    const s = makeStore(new MemoryKV());
    s.saveRun(run("2026-11-04T08:00:00.000Z"));
    s.saveRun(run("2026-11-05T09:00:00.000Z"));
    expect(purgeExpiredPractice(s, new Date("2026-11-05T09:30:00.000Z"))).toEqual(["a1"]);
  });
});
