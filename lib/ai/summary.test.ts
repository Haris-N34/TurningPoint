import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { SKILL_SLUGS, type SkillSlug } from "@/lib/engine/skills";
import { extractEvidence, summaryLine } from "./evidence";
import { protectedCheck } from "./guards/protected";

// AI summary lines (judge feedback): one plain sentence per skill and level, never a keyword list, never
// repeated across skills on a card, never a protected trait.
const one = (text: string, skills: SkillSlug[], nodeSkills: SkillSlug[] = skills) =>
  extractEvidence({
    targetSkills: skills,
    checkpoints: [{ id: "c", nodeId: "n", kind: "decision", transcript: fromChunks([{ text, startS: 0, endS: 20 }]) }],
    decisionPath: [],
    nodeSkills: { n: nodeSkills },
  });

describe("AI summary lines", () => {
  it("Maya's card: every summary differs and reads as a sentence, not a list", () => {
    const card = CardSchema.parse(fixture);
    const lines = card.evidence.flatMap((e) => (e.sentence ? [e.sentence] : []));
    expect(lines.length).toBeGreaterThan(1);
    expect(new Set(lines).size).toBe(lines.length);
    for (const l of lines) {
      expect(l).not.toMatch(/:\s*\w+,\s*\w+/);
      expect(l).toMatch(/\.$/);
    }
  });

  it("distinct for every skill at each level, short, deterministic, and clean", () => {
    for (const level of ["strong", "some"] as const) {
      const lines = SKILL_SLUGS.map((s) => summaryLine(s, level));
      expect(new Set(lines).size).toBe(SKILL_SLUGS.length);
      for (const l of lines) {
        expect(l.split(" ").length).toBeLessThanOrEqual(12);
        expect(protectedCheck(l)).toBeUndefined();
      }
    }
    expect(summaryLine("prioritization", "strong")).toBe(summaryLine("prioritization", "strong"));
  });

  it("a whole card's summaries are unique", () => {
    const skills: SkillSlug[] = ["prioritization", "collaboration", "adaptability", "resilience"];
    const ev = one("I kept both days because the vendors had paid for two days of stock. So I cut the stage and the posters. Losing a day would hurt the vendors more than the bands. We still opened on time, and I told the team the same day.", skills);
    const lines = ev.flatMap((e) => (e.sentence ? [e.sentence] : []));
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe("Collaboration needs a person or team action", () => {
  it("a generic answer that only mentions the team earns no Collaboration", () => {
    const ev = one("I picked this because the team needed it first, but it cost us time with the suppliers.", ["collaboration"]);
    expect(ev[0].level).toBe("not_observed");
  });

  it.each([
    "I asked who was free when, then paired Ari with a new volunteer on logistics, because nobody should be stuck alone.",
    "I called everyone in the same day because people deserved to hear it from me, even though it cost an hour.",
    "I delegated the permit to Theo because he knew the forms, so I could deal with the vendor.",
  ])("an answer that brings people in can: %s", (text) => {
    const ev = one(text, ["collaboration"]);
    expect(["strong", "some"]).toContain(ev[0].level);
  });
});
