import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import type { AiCall } from "@/lib/ai/telemetry";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { listReviewSessions, listSurveyResponses, logReviewSession, MAX_SESSION_MS, median, reviewStopwatch, saveSurveyResponse } from "./events";
import { DEMO_PREFIX, impactReport } from "./metrics";
import { aiEvalImpact, coachUsage, secondLookImpact, telemetryImpact } from "./partG";
import { listDemoSecondLook, seedImpactDemo, syntheticCohort } from "./seed";

// G.1: every Part G metric comes from recorded local data, computed by pure functions.

const fresh = () => makeStore(new MemoryKV());
const call = (over: Partial<AiCall> = {}): AiCall => ({ service: "Evidence Scanner", promptId: "p", promptVersion: "1", model: "local-rules", mode: "off", latencyMs: 10, costUsd: 0, valid: true, at: "2026-11-01T00:00:00Z", ...over });

describe("event logs", () => {
  it("median handles empty, odd and even counts", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("stopwatch counts visible time only", () => {
    let t = 0;
    const w = reviewStopwatch(() => t);
    t = 5000; w.pause(); t = 60_000; w.resume(); t = 62_000;
    expect(w.take()).toBe(7000);
  });
  it("review sessions drop bounces and cap a forgotten tab", () => {
    const s = fresh();
    logReviewSession(s, { attemptId: "a", challengeId: "c", ms: 400 });
    logReviewSession(s, { attemptId: "a", challengeId: "c", ms: 10 * 60 * 60 * 1000 });
    expect(listReviewSessions(s).map((x) => x.ms)).toEqual([MAX_SESSION_MS]);
  });
  it("one survey answer per attempt, 1 to 5 only, removed with the attempt", () => {
    const s = fresh();
    const card = CardSchema.parse(fixture);
    s.saveCard(card);
    saveSurveyResponse(s, card.attemptId, 2);
    saveSurveyResponse(s, card.attemptId, 4);
    expect(() => saveSurveyResponse(s, card.attemptId, 6)).toThrow();
    expect(listSurveyResponses(s).map((r) => r.rating)).toEqual([4]);
    logReviewSession(s, { attemptId: card.attemptId, challengeId: card.challenge.id, ms: 90_000 });
    s.deleteAttempt(card.attemptId);
    expect(listSurveyResponses(s)).toEqual([]);
    expect(listReviewSessions(s)).toEqual([]);
  });
});

describe("impactReport Part G fields", () => {
  it("recruiter minutes are the median of summed visible time per candidate, scoped to the employer", () => {
    const s = fresh();
    const base = CardSchema.parse(fixture);
    for (const id of ["a1", "a2", "a3"]) s.saveCard({ ...base, attemptId: id });
    logReviewSession(s, { attemptId: "a1", challengeId: base.challenge.id, ms: 60_000 });
    logReviewSession(s, { attemptId: "a1", challengeId: base.challenge.id, ms: 60_000 });
    logReviewSession(s, { attemptId: "a2", challengeId: base.challenge.id, ms: 4 * 60_000 });
    logReviewSession(s, { attemptId: "a3", challengeId: "other", ms: 9 * 60_000 });
    expect(impactReport(s, base.challenge.id)).toMatchObject({ reviewMinutes: 3, timedCandidates: 2 });
  });
  it("resume claims backed, survey and practice come from stored records", () => {
    const s = fresh();
    const base = CardSchema.parse(fixture);
    s.saveCard({ ...base, resume: { source: "upload", consentAt: base.finishedAt, redactions: 0, claims: [
      { id: "rc1", text: "Led a team", roleLabel: "Role", action: "Led a team", hasNumber: false, skills: ["collaboration"], backed: true, link: { type: "choice", skill: "collaboration", nodeId: "n", optionLabel: "A" } },
      { id: "rc2", text: "Wrote a newsletter", roleLabel: "Role", action: "Wrote a newsletter", hasNumber: false, skills: ["communication"], backed: false },
    ] } });
    saveSurveyResponse(s, base.attemptId, 4);
    const r = impactReport(s);
    expect(r.resume).toEqual({ cards: 1, claims: 2, backed: 1, rate: 0.5 });
    expect(r.survey).toMatchObject({ responses: 1, mean: 4, responseRate: 1 });
    expect(r.survey.counts).toEqual([0, 0, 0, 1, 0]);
    expect(r.practicedFirst).toEqual({ count: 0, rate: null });
  });
});

describe("Second Look, telemetry, Coach and evals", () => {
  it("counts rescues and decision minutes; queued entries are not decided", () => {
    const e = [
      { attemptId: "x1", challengeId: "c", status: "restored" as const, openedAt: "2026-11-01T10:00:00Z", decidedAt: "2026-11-01T10:04:00Z" },
      { attemptId: "x2", challengeId: "c", status: "confirmed_pass" as const, openedAt: "2026-11-01T10:00:00Z", decidedAt: "2026-11-01T10:02:00Z" },
      { attemptId: "x3", challengeId: "d", status: "queued" as const },
    ];
    expect(secondLookImpact(e)).toEqual({ flagged: 3, rescued: 1, confirmedPass: 1, queued: 1, rescueRate: 0.5, medianMinutesToDecide: 3 });
    expect(secondLookImpact(e, "all", "d")).toMatchObject({ flagged: 1, rescued: 0, rescueRate: null, medianMinutesToDecide: null });
    expect(secondLookImpact(e, "demo").flagged).toBe(0);
  });
  it("telemetry and Coach usage read the AI call log; no calls means no number", () => {
    expect(telemetryImpact([])).toMatchObject({ calls: 0, validRate: null, p95Ms: null });
    const calls = [call(), call({ valid: false, latencyMs: 30 }), call({ service: "Candidate Coach" }), call({ service: "Candidate Coach" })];
    expect(telemetryImpact(calls)).toMatchObject({ calls: 4, validRate: 0.75, failures: 1, p95Ms: 30, services: 2 });
    const now = Date.parse("2026-11-02T00:00:00Z");
    const runs = [{ practice: true, startedAt: "2026-11-01T12:00:00Z" }, { practice: true, startedAt: "2026-10-01T00:00:00Z" }, { practice: false, startedAt: "2026-11-01T12:00:00Z" }];
    expect(coachUsage(calls, runs, now)).toEqual({ feedbackCalls: 2, validRate: 1, practiceRunsOnDevice: 1 });
  });
  it("gold agreement stays null without human labels; hallucination eval runs live", () => {
    const r = aiEvalImpact();
    expect(r.goldItems).toBeGreaterThan(0);
    expect(r.goldLabelled).toBe(0);
    expect(r.goldAccuracy).toBeNull();
    expect(r.hallucination.total).toBe(20);
    expect(r.hallucination.correct).toBeGreaterThanOrEqual(19);
  });
  it("gold agreement is computed once labels exist", () => {
    const labels = Object.fromEntries(aiEvalImpact().goldItems ? [["g01", "strong"]] : []);
    const r = aiEvalImpact({ div: labels });
    expect(r.goldLabelled).toBe(1);
    expect(r.goldAccuracy).not.toBeNull();
  });
});

describe("seeded cohort: every Part G metric has data, labelled synthetic", () => {
  it("is deterministic and keeps the original cohort unchanged", () => {
    expect(syntheticCohort()).toEqual(syntheticCohort());
    expect(syntheticCohort().filter((c) => c.finished)).toHaveLength(160);
  });
  it("fills recruiter minutes, Second Look, resume, survey and practice for the demo source only", () => {
    const s = fresh();
    seedImpactDemo(s);
    const demo = impactReport(s, undefined, "demo");
    expect(demo.reviewMinutes).toBeGreaterThan(1);
    expect(demo.reviewMinutes).toBeLessThan(8);
    expect(demo.timedCandidates).toBe(demo.reviewed);
    expect(demo.resume.claims).toBeGreaterThan(0);
    expect(demo.resume.rate).not.toBeNull();
    expect(demo.survey.responses).toBeGreaterThan(80);
    expect(demo.survey.mean).toBeGreaterThanOrEqual(3);
    expect(demo.practicedFirst.count).toBeGreaterThan(0);
    expect(demo.consistencyChecks).toBeGreaterThan(80);
    expect(demo.consistencyRate).toBeGreaterThan(0.6);
    const sl = secondLookImpact(listDemoSecondLook(s), "demo");
    expect(sl.rescued).toBeGreaterThan(0);
    expect(listDemoSecondLook(s).every((e) => e.attemptId.startsWith(DEMO_PREFIX) && e.strongSkills.length >= 2)).toBe(true);
    const live = impactReport(s, undefined, "live");
    expect(live.reviewMinutes).toBeNull();
    expect(live.survey.responses).toBe(0);
  });
  it("is idempotent and delete-all removes the synthetic events", () => {
    const s = fresh();
    seedImpactDemo(s);
    const n = [listReviewSessions(s).length, listSurveyResponses(s).length, listDemoSecondLook(s).length];
    seedImpactDemo(s);
    expect([listReviewSessions(s).length, listSurveyResponses(s).length, listDemoSecondLook(s).length]).toEqual(n);
    s.deleteAll();
    expect([listReviewSessions(s).length, listSurveyResponses(s).length, listDemoSecondLook(s).length]).toEqual([0, 0, 0]);
  });
});
