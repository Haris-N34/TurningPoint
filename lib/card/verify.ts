import type { Card, Evidence } from "./types";

const DOWNGRADE: Record<Evidence["level"], Evidence["level"]> = {
  strong: "some",
  some: "not_observed",
  not_observed: "not_observed",
  needs_review: "needs_review",
};

/**
 * Guardrail G1: every quote must be an exact substring of its clip's transcript, and every
 * choice source must exist in the decision path. Anything that fails is dropped and the
 * skill drops a level. Returns the cleaned evidence and what was dropped.
 */
export function verifyEvidence(card: Pick<Card, "evidence" | "checkpoints" | "decisionPath">) {
  const dropped: { skill: string; reason: string }[] = [];
  const evidence = card.evidence.map((e): Evidence => {
    if (!e.source) return e;
    const s = e.source;
    let ok = false;
    if (s.type === "clip") {
      const cp = card.checkpoints.find((c) => c.id === s.checkpointId);
      ok = !!cp && s.quote.length > 0 && cp.transcript.text.includes(s.quote) && s.endS >= s.startS;
    } else {
      ok = card.decisionPath.some((d) => d.nodeId === s.nodeId && d.optionId === s.optionId);
    }
    if (ok) return e;
    dropped.push({ skill: e.skill, reason: s.type === "clip" ? `quote not in transcript: "${s.quote}"` : `choice not in log: ${s.nodeId}/${s.optionId}` });
    const level = DOWNGRADE[e.level];
    return { skill: e.skill, level, sentence: level === "not_observed" ? undefined : e.sentence };
  });
  return { evidence, dropped };
}
