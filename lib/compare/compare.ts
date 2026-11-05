import { cardFor } from "@/lib/card/recruiter";
import { verifyEvidence } from "@/lib/card/verify";
import type { Store } from "@/lib/store/store";

/** Apply the same share, anonymity and quote guards as individual recruiter review. */
export function comparisonFor(s: Store, challengeId: string, ids: string[], anonymous = true) {
  const unique = [...new Set(ids)];
  if (unique.length < 2 || unique.length > 3) return [];
  return unique.flatMap((id) => {
    const view = cardFor(s, id, challengeId, anonymous);
    return view?.status === "ok" ? [{ ...view, card: { ...view.card, evidence: verifyEvidence(view.card).evidence } }] : [];
  });
}
