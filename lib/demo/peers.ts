import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import type { Store } from "@/lib/store/store";
import { answerPicks, syntheticAnswers, syntheticCohort, syntheticName } from "@/lib/impact/seed";

// A handful of synthetic peers next to Maya in the demo inbox, so the recruiter screen looks like a
// real list. Clearly labelled synthetic, never real people, and kept out of the impact numbers.

export const PEER_PREFIX = "att_demo_peer_";
export const PEER_COUNT = 7;
export const isPeer = (attemptId: string) => attemptId.startsWith(PEER_PREFIX);

export function seedPeers(s: Store, challenge: { id: string; title: string; company: string }) {
  const base = CardSchema.parse(fixture);
  const picks = answerPicks();
  const cohort = syntheticCohort().filter((c) => c.finished && c.levels.some((l) => l !== "not_observed")).slice(0, PEER_COUNT);
  cohort.forEach((c, k) => {
    const attemptId = `${PEER_PREFIX}${String(k + 1).padStart(2, "0")}`;
    if (s.getCard(attemptId)) return;
    const { checkpoints, evidence } = syntheticAnswers(base, picks[c.i], c.levels, c.mode);
    const n = String(c.i + 1).padStart(3, "0");
    const card = CardSchema.parse({
      ...base,
      attemptId,
      anonId: `Candidate S${n}`,
      candidate: { displayName: syntheticName(c.i), verified: c.verified },
      challenge,
      scenario: { ...base.scenario, seed: attemptId },
      finishedAt: c.date,
      adjustedTiming: c.adjustedTiming,
      evidence,
      checkpoints,
      realStory: base.realStory
        ? { ...base.realStory, title: "Illustrative story from the demo fixture", witnesses: c.witnessConfirmed ? [{ id: `peer-w-${k}`, relationship: "peer", status: "confirmed", skillsSeen: ["collaboration"] }] : [] }
        : undefined,
      consistency: undefined,
      review: undefined,
    });
    s.saveCard(card);
    s.share(attemptId, challenge.id, false);
  });
}
