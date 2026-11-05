import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema, type Card } from "@/lib/card/types";
import { cardFor, inboxFor } from "@/lib/card/recruiter";
import { impactReport } from "@/lib/impact/metrics";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { isPracticeChallenge, PRACTICE_CHALLENGE, PRACTICE_TTL_MS, practiceExpiresAt, purgeExpiredPractice, purgePracticeData } from "./practice";

// C8.1: practice runs use the same mechanics, are never shared with employers, and are deleted after 24 h.

const T0 = Date.parse("2026-11-05T09:00:00Z");
function clockAt() {
  let t = T0;
  const now = () => new Date(t);
  return { now, set: (ms: number) => (t = ms) };
}

function practiceCard(attemptId = "att_practice1"): Card {
  return CardSchema.parse({ ...fixture, attemptId, challenge: { id: PRACTICE_CHALLENGE.id, title: PRACTICE_CHALLENGE.title, company: PRACTICE_CHALLENGE.company } });
}

function savePractice(s: ReturnType<typeof makeStore>, attemptId: string, startedAt: string) {
  s.saveRun({ attemptId, challengeId: PRACTICE_CHALLENGE.id, scenarioId: "sample", seed: attemptId, state: {}, extra: {}, status: "finished", startedAt, practice: false });
  s.saveCard(practiceCard(attemptId));
}

describe("practice mode (C8.1)", () => {
  it("marks a run as practice from its challenge id, whatever the caller passed", () => {
    const s = makeStore(new MemoryKV());
    expect(isPracticeChallenge(PRACTICE_CHALLENGE.id)).toBe(true);
    expect(isPracticeChallenge("ch_demo_energy")).toBe(false);
    savePractice(s, "att_p", new Date(T0).toISOString());
    expect(s.getRun("att_p")?.practice).toBe(true);
  });

  it("never shares a practice card with an employer", () => {
    const s = makeStore(new MemoryKV());
    savePractice(s, "att_p", new Date(T0).toISOString());
    expect(s.share("att_p", PRACTICE_CHALLENGE.id, false)).toBeUndefined();
    expect(s.share("att_p", "ch_demo_energy", true)).toBeUndefined();
    expect(s.listShares()).toEqual([]);
    expect(inboxFor(s, "ch_demo_energy", ["adaptability"])).toEqual([]);
    expect(cardFor(s, "att_p", PRACTICE_CHALLENGE.id)).toBeUndefined();
    expect(cardFor(s, "att_p", "ch_demo_energy")).toBeUndefined();
  });

  it("keeps practice out of employer lists and impact counts, but the candidate can still open it", () => {
    const s = makeStore(new MemoryKV());
    savePractice(s, "att_p", new Date(T0).toISOString());
    expect(s.listCards()).toEqual([]);
    expect(s.listCards({ practice: true }).map((c) => c.attemptId)).toEqual(["att_p"]);
    expect(s.getCard("att_p")?.attemptId).toBe("att_p");
    expect(impactReport(s).started).toBe(0);
    expect(impactReport(s).finished).toBe(0);
  });

  it("deletes practice runs and cards after 24 hours (injected clock)", async () => {
    const c = clockAt();
    const s = makeStore(new MemoryKV(), c.now);
    const started = new Date(T0).toISOString();
    savePractice(s, "att_p", started);
    // A real run and card sit next to it and must survive.
    s.saveRun({ attemptId: "att_real", challengeId: "ch_demo_energy", scenarioId: "launch-week", seed: "x", state: {}, extra: {}, status: "finished", startedAt: started, practice: false });
    s.saveCard(CardSchema.parse({ ...fixture, attemptId: "att_real" }));

    expect(practiceExpiresAt(s.getRun("att_p")!)).toBe(new Date(T0 + PRACTICE_TTL_MS).toISOString());

    c.set(T0 + PRACTICE_TTL_MS - 60_000);
    expect(purgeExpiredPractice(s, c.now())).toEqual([]);
    expect(s.getCard("att_p")).toBeDefined();

    c.set(T0 + PRACTICE_TTL_MS + 1);
    const deletedMedia: string[] = [];
    const removed = await purgePracticeData(s, { deletePrefix: async (p) => void deletedMedia.push(p) }, c.now());
    expect(removed).toEqual(["att_p"]);
    expect(deletedMedia).toEqual(["att_p/"]);
    expect(s.getRun("att_p")).toBeUndefined();
    expect(s.getCard("att_p")).toBeUndefined();
    expect(s.getRun("att_real")).toBeDefined();
    expect(s.getCard("att_real")).toBeDefined();
  });

  it("also deletes an orphaned practice card (no run) once it is 24 hours old", () => {
    const s = makeStore(new MemoryKV());
    s.saveCard(practiceCard("att_orphan"));
    const finished = Date.parse(practiceCard().finishedAt);
    expect(purgeExpiredPractice(s, new Date(finished + 1000))).toEqual([]);
    expect(purgeExpiredPractice(s, new Date(finished + PRACTICE_TTL_MS + 1))).toEqual(["att_orphan"]);
  });
});
