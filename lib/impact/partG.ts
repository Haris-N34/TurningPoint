import answers from "@/lib/ai/evals/gold/answers.json";
import { evaluateGold, joinGold } from "@/lib/ai/evals/gold";
import { HALLUCINATION_CASES } from "@/lib/ai/evals/hallucination";
import { LocalProvider } from "@/lib/ai/providers";
import { scanEvidence } from "@/lib/ai/services/scanner";
import { aiHealth, type AiCall } from "@/lib/ai/telemetry";
import { fromChunks } from "@/lib/checkpoint/transcript";
import type { SecondLookEntry } from "@/lib/integrations/store";
import { PRACTICE_TTL_MS } from "@/lib/practice/practice";
import type { SavedRun } from "@/lib/store/store";
import { DEMO_PREFIX, type Source } from "./metrics";
import { median } from "./events";

// Part G metrics that come from sources other than cards and runs (G.1): Second Look, AI telemetry,
// Coach usage and the AI evals. All pure: the dashboard passes in what it read.

const fraction = (a: number, b: number) => (b ? a / b : null);
const inSource = (attemptId: string, source: Source) => source === "all" || attemptId.startsWith(DEMO_PREFIX) === (source === "demo");

/** Second Look rescues: candidates a recruiter restored after an ATS resume reject or no review. */
export function secondLookImpact(entries: Pick<SecondLookEntry, "attemptId" | "challengeId" | "status" | "openedAt" | "decidedAt">[], source: Source = "all", challengeId?: string) {
  const es = entries.filter((e) => inSource(e.attemptId, source) && (!challengeId || e.challengeId === challengeId));
  const decided = es.filter((e) => e.status !== "queued");
  const mins = decided.flatMap((e) => (e.openedAt && e.decidedAt ? [(Date.parse(e.decidedAt) - Date.parse(e.openedAt)) / 60_000] : []));
  const m = median(mins);
  return {
    flagged: es.length,
    rescued: es.filter((e) => e.status === "restored").length,
    confirmedPass: es.filter((e) => e.status === "confirmed_pass").length,
    queued: es.filter((e) => e.status === "queued").length,
    /** Of the flagged candidates a recruiter decided on, how many they restored. */
    rescueRate: fraction(es.filter((e) => e.status === "restored").length, decided.length),
    medianMinutesToDecide: m === null ? null : Math.round(m * 10) / 10,
  };
}

/** AI telemetry on this device: every model or rule call, whether its output passed the guards. */
export function telemetryImpact(calls: AiCall[]) {
  const h = aiHealth(calls).total;
  return { calls: h.calls, validRate: fraction(h.calls - h.failures, h.calls), failures: h.failures, p95Ms: h.calls ? Math.round(h.p95) : null, costUsd: h.costUsd, services: aiHealth(calls).byService.length };
}

export const COACH_SERVICE = "Candidate Coach";

/** Coach usage. Telemetry counts Coach feedback calls (no candidate data); practice runs are the ones still on this device. */
export function coachUsage(calls: AiCall[], runs: Pick<SavedRun, "practice" | "startedAt">[], now: number) {
  const coach = calls.filter((c) => c.service === COACH_SERVICE);
  return {
    feedbackCalls: coach.length,
    validRate: fraction(coach.filter((c) => c.valid).length, coach.length),
    practiceRunsOnDevice: runs.filter((r) => r.practice && now - Date.parse(r.startedAt) <= PRACTICE_TTL_MS).length,
  };
}

/**
 * AI vs human agreement on the gold set, plus the hallucination eval, run live with the local scanner.
 * Human labels live in lib/ai/evals/gold/labels.<rater>.json; import them into `labelFiles` when they land.
 */
export function aiEvalImpact(labelFiles: Record<string, unknown> = {}) {
  const opts = { provider: new LocalProvider(), log: () => {} };
  const gold = evaluateGold(joinGold(answers, labelFiles), opts);
  const notObserved = HALLUCINATION_CASES.filter((c) => {
    const cp = { id: "cp", nodeId: "n", kind: "decision" as const, transcript: fromChunks([{ text: c.transcript, startS: 0, endS: 15 }]) };
    return scanEvidence({ targetSkills: [c.skill], checkpoints: [cp], decisionPath: [], nodeSkills: {} }, {}, opts)[0].level === "not_observed";
  }).length;
  return {
    goldItems: gold.total,
    goldLabelled: gold.labelled,
    /** Null until at least one item has a settled human label. Never a made-up number. */
    goldAccuracy: gold.labelled ? gold.accuracy : null,
    goldKappa: gold.labelled ? gold.kappa : null,
    hallucination: { correct: notObserved, total: HALLUCINATION_CASES.length },
  };
}
