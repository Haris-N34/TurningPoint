import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { ADDON_MINUTES, addonQuestion, addonsForAttempt, completeAddon, getAddon, missingSkills, requestAddon } from "./addon";

const card = CardSchema.parse(fixture);
const setup = () => {
  const s = makeStore(new MemoryKV(), () => new Date("2026-11-05T10:00:00Z"));
  s.saveCard(card);
  s.share(card.attemptId, "ch_other", true);
  return s;
};
// An employer asking for one skill the card covers and two it does not.
const covered = card.targetSkills[0];
const notCovered = (["curiosity", "analytical", "feedback", "empathy"] as const).filter((x) => !card.targetSkills.includes(x)).slice(0, 2);
const employerSkills = [covered, ...notCovered];

describe("E8.2 short add-on", () => {
  it("missing skills are the employer's skills the card does not cover", () => {
    expect(missingSkills(card, employerSkills)).toEqual(notCovered);
  });

  it("a request covers only the missing skills and is one per card and employer", () => {
    const s = setup();
    const a = requestAddon(s, card.attemptId, "ch_other", employerSkills)!;
    expect(a.skills).toEqual(notCovered);
    expect(a.status).toBe("requested");
    expect(requestAddon(s, card.attemptId, "ch_other", employerSkills)!.id).toBe(a.id);
    expect(addonsForAttempt(s, card.attemptId)).toHaveLength(1);
    expect(ADDON_MINUTES).toBe(5);
    for (const sk of a.skills) expect(addonQuestion(sk).length).toBeGreaterThan(10);
  });

  it("no request when nothing is missing, or the card is not shared with that employer", () => {
    const s = setup();
    expect(requestAddon(s, card.attemptId, "ch_other", [covered])).toBeUndefined();
    expect(requestAddon(s, card.attemptId, "ch_not_shared", employerSkills)).toBeUndefined();
    s.revokeShare(card.attemptId, "ch_other");
    expect(requestAddon(s, card.attemptId, "ch_other", employerSkills)).toBeUndefined();
  });

  it("completing it extracts evidence for the missing skills only, quotes are exact substrings, no score", () => {
    const s = setup();
    const a = requestAddon(s, card.attemptId, "ch_other", employerSkills)!;
    const answers = Object.fromEntries(
      a.skills.map((sk) => [sk, "I looked into the numbers because the trend was unclear, so I asked the team and compared it with last week instead of guessing."]),
    );
    const done = completeAddon(s, a.id, answers);
    expect(done.status).toBe("done");
    expect(done.evidence.map((e) => e.skill).sort()).toEqual([...a.skills].sort());
    for (const e of done.evidence) {
      if (e.source?.type === "clip") expect(answers[e.skill]).toContain(e.source.quote);
    }
    expect(JSON.stringify(done)).not.toMatch(/"score"|overall/i);
    expect(getAddon(s, a.id)?.status).toBe("done");
  });

  it("blank answers give needs_review, never a negative level", () => {
    const s = setup();
    const a = requestAddon(s, card.attemptId, "ch_other", employerSkills)!;
    const done = completeAddon(s, a.id, {});
    expect(done.evidence.every((e) => e.level === "needs_review")).toBe(true);
  });

  it("delete everything removes add-ons too (C7.5)", () => {
    const s = setup();
    requestAddon(s, card.attemptId, "ch_other", employerSkills);
    s.deleteAll();
    expect(addonsForAttempt(s, card.attemptId)).toEqual([]);
  });
});
