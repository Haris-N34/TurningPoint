import { describe, expect, it } from "vitest";
import { fromChunks } from "@/lib/checkpoint/transcript";
import type { SkillSlug } from "@/lib/engine/skills";
import { extractEvidence, isSpecific } from "./evidence";

// Strong needs specificity (QA night): a generic answer that would fit any decision caps at Some.
const ROLES = { nodeId: "roles", optionId: "b", optionLabel: "Ask who's free when, then pair people on logistics", prompt: "Mon 09:20 · Nobody wants logistics" };
const RECOVERY = { nodeId: "recovery-plan", optionId: "b", optionLabel: "Keep Saturday and Sunday; cut promotion, decorations and the stage", prompt: "Wed 09:40 · Recovery plan" };

const level = (skill: SkillSlug, text: string, d = ROLES, question?: string) =>
  extractEvidence({
    targetSkills: [skill],
    checkpoints: [{ id: "cp", nodeId: d.nodeId, kind: "decision", question, transcript: fromChunks([{ text, startS: 0, endS: 15 }]) }],
    decisionPath: [d],
    nodeSkills: { [d.nodeId]: [skill] },
  })[0].level;

const GENERIC = [
  "I picked this because the team needed it first, but it cost us time with the suppliers.",
  "I chose this option because it was the most important priority for the team, but it was a difficult trade-off and I considered how it would affect everyone involved.",
  "I made this decision because communication and collaboration are key, rather than rushing, so the team felt included even though it cost us some time.",
];

describe("specificity caps generic answers at Some", () => {
  it.each(GENERIC)("generic: %s", (text) => {
    for (const skill of ["prioritization", "collaboration"] as SkillSlug[]) expect(level(skill, text)).not.toBe("strong");
    expect(level("prioritization", text, RECOVERY)).not.toBe("strong");
  });

  it("a specific answer to the same decision is Strong", () => {
    expect(level("collaboration", "I asked who was free when and paired Ari with Jess on logistics, because a new volunteer stuck alone on deliveries would quit. It cost us fifteen minutes, but the team kept both people.")).toBe("strong");
    expect(
      level(
        "prioritization",
        "I kept both days rather than one because the vendors had already paid for two days of stock. Cutting the stage and the decorations hurts the families who come for the music, but losing a market day would hurt the vendors more.",
        RECOVERY,
      ),
    ).toBe("strong");
  });

  it("the checkpoint question counts as the decision's context", () => {
    expect(isSpecific("The permit could wait until morning, the vendor could not.", ["You deferred the permit problem. Why that order?"])).toBe(true);
    expect(isSpecific("It needed to happen first, but it cost us time.", ["You deferred the permit problem. Why that order?"])).toBe(false);
  });

  it("ignores case and typos (F1): lower case and no punctuation score the same", () => {
    const a = "I kept both days because the vendors had already paid for two days of stock. Cutting the stage hurts the families, but losing a day hurts the vendors more.";
    const b = a.toLowerCase().replace(/[.,]/g, "").replace("because", "cuz");
    expect(level("prioritization", b, RECOVERY)).toBe(level("prioritization", a, RECOVERY));
  });
});
