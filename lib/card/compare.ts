import type { SkillSlug } from "@/lib/engine/skills";
import type { Store } from "@/lib/store/store";
import { cardFor } from "./recruiter";
import type { Card, CardCheckpoint, Evidence } from "./types";
import { verifyEvidence } from "./verify";

// E4.1 Compare view: 2 or 3 Capability Cards side by side, evidence first.
// No overall score and no ranking: columns keep the order the recruiter picked them in.

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 3;

export type CompareColumn = {
  attemptId: string;
  displayName: string;
  anonymous: boolean;
  adjustedTiming: boolean;
  witnessConfirmed: boolean;
  /** One entry per employer skill, in the employer's order. Only verified quotes survive. */
  skills: { skill: SkillSlug; level: Evidence["level"]; quote?: string }[];
};

export type CompareAnswer = { checkpointId: string; question: string; mode: CardCheckpoint["mode"]; text: string } | undefined;

/** One row per checkpoint slot (first decision, second decision, real life, follow-up). */
export type CompareRow = { kind: CardCheckpoint["kind"]; slot: number; answers: CompareAnswer[] };

export type Comparison =
  | { ok: true; columns: CompareColumn[]; rows: CompareRow[] }
  | { ok: false; reason: string };

const KIND_ORDER: CardCheckpoint["kind"][] = ["decision", "real_life", "follow_up"];

export function compareFor(s: Store, challengeId: string, attemptIds: string[], employerSkills: SkillSlug[], anonymous = true): Comparison {
  const ids = [...new Set(attemptIds)];
  if (ids.length < COMPARE_MIN || ids.length > COMPARE_MAX) return { ok: false, reason: `Pick ${COMPARE_MIN} or ${COMPARE_MAX} candidates to compare.` };
  const cards: { card: Card; name: { displayName: string; anonymous: boolean } }[] = [];
  for (const id of ids) {
    const view = cardFor(s, id, challengeId, anonymous);
    if (!view) return { ok: false, reason: "One of these cards is not shared with this challenge." };
    if (view.status === "withdrawn") return { ok: false, reason: "One of these candidates withdrew their card." };
    cards.push({ card: view.card, name: view.name });
  }
  const columns = cards.map(({ card, name }): CompareColumn => {
    const evidence = verifyEvidence(card).evidence;
    return {
      attemptId: card.attemptId,
      displayName: name.displayName,
      anonymous: name.anonymous,
      adjustedTiming: card.adjustedTiming,
      witnessConfirmed: !!card.realStory?.witnesses.some((w) => w.status === "confirmed"),
      skills: employerSkills.map((skill) => {
        const e = evidence.find((x) => x.skill === skill);
        return { skill, level: e?.level ?? "not_observed", quote: e?.source?.type === "clip" ? e.source.quote : undefined };
      }),
    };
  });
  const rows: CompareRow[] = [];
  for (const kind of KIND_ORDER) {
    const perCard = cards.map(({ card }) => card.checkpoints.filter((c) => c.kind === kind));
    const slots = Math.max(0, ...perCard.map((x) => x.length));
    for (let slot = 0; slot < slots; slot++) {
      rows.push({
        kind,
        slot,
        answers: perCard.map((list) => {
          const c = list[slot];
          return c ? { checkpointId: c.id, question: c.question, mode: c.mode, text: c.transcript.text } : undefined;
        }),
      });
    }
  }
  return { ok: true, columns, rows };
}
