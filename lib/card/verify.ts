import type { Card, Evidence } from "./types";

// A failed source drops the skill a level. "Some" with no source would still be an unsourced
// claim, so a dropped "strong" goes to a human instead (PRD fallback: "Needs human review").
const DOWNGRADE: Record<Evidence["level"], Evidence["level"]> = {
  strong: "needs_review",
  some: "not_observed",
  not_observed: "not_observed",
  needs_review: "needs_review",
};

/**
 * Guardrail G1 and E3.8: every quote must be an exact substring of its clip's transcript, and every
 * choice source must exist in the decision path. A failed source is dropped and the skill drops a
 * level. No AI sentence survives without a verified source, and no level above "not observed"
 * stands without one. Returns the cleaned evidence and what was dropped.
 */
export function verifyEvidence(card: Pick<Card, "evidence" | "checkpoints" | "decisionPath">) {
  const dropped: { skill: string; reason: string }[] = [];
  const evidence = card.evidence.map((e): Evidence => {
    if (!e.source) {
      if (e.level === "strong" || e.level === "some") {
        dropped.push({ skill: e.skill, reason: "level above not observed with no source" });
        return { skill: e.skill, level: "not_observed" };
      }
      // Not observed or needs review: keep the level, never an unsourced sentence.
      return { skill: e.skill, level: e.level };
    }
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
    // The sentence described the dropped source, so it goes too.
    return { skill: e.skill, level: DOWNGRADE[e.level] };
  });
  return { evidence, dropped };
}
