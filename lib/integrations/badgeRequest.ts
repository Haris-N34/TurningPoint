import type { Card } from "@/lib/card/types";

// Client-safe: the body for POST /api/credentials (no node:crypto here). The browser sends the answers, never
// levels; Turning Point re-scores them server-side and signs only what it finds (QA night).
export function badgeRequestBody(card: Card, withName = false) {
  return {
    attemptId: card.attemptId,
    challengeTitle: card.challenge.title,
    company: card.challenge.company,
    finishedAt: card.finishedAt,
    ...(withName && card.candidate.displayName ? { name: card.candidate.displayName } : {}),
    evidence: {
      scenarioId: card.scenario.id,
      targetSkills: card.targetSkills,
      checkpoints: card.checkpoints.map((c) => ({ id: c.id, nodeId: c.nodeId, kind: c.kind, question: c.question, text: c.transcript.text })),
      decisionPath: card.decisionPath.map(({ nodeId, optionId, optionLabel, prompt }) => ({ nodeId, optionId, optionLabel, prompt })),
    },
  };
}
