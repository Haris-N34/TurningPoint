import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { SKILL_SLUGS, type SkillSlug } from "@/lib/engine/skills";
import { extractEvidence, summaryLine } from "./evidence";
import { protectedCheck } from "./guards/protected";

// AI summary lines are specific to each skill and its own quote, and never repeat across skills on a card.
describe("AI summary lines", () => {
  it("Maya's card: every summary differs and names something from its own quote", () => {
    const card = CardSchema.parse(fixture);
    const lines = card.evidence.flatMap((e) => (e.sentence ? [e.sentence] : []));
    expect(lines.length).toBeGreaterThan(1);
    expect(new Set(lines).size).toBe(lines.length);
    for (const e of card.evidence)
      if (e.source?.type === "clip" && e.sentence) {
        const words = e.sentence.split(": ")[1]?.replace(/\.$/, "").split(", ") ?? [];
        for (const w of words) expect(e.source.quote.toLowerCase()).toContain(w.toLowerCase());
      }
  });

  it("never repeats across skills for the same quote and level, and stays short", () => {
    const quote = "So I cut promotion, decorations and the stage.";
    const lines = SKILL_SLUGS.map((s) => summaryLine(s, "strong", quote));
    expect(new Set(lines).size).toBe(SKILL_SLUGS.length);
    for (const l of lines) expect(l.split(" ").length).toBeLessThanOrEqual(20);
  });

  it("never uses a redaction placeholder as a topic", () => {
    expect(summaryLine("collaboration", "some", "I asked [name] and the volunteers to split the shifts.")).not.toMatch(/name/);
  });

  it("never echoes a word the protected-trait guard flags", () => {
    const l = summaryLine("collaboration", "some", "We sketched it on the white board with the older volunteers.");
    expect(protectedCheck(l)).toBeUndefined();
  });

  it("a whole card's summaries are unique", () => {
    const skills: SkillSlug[] = ["prioritization", "collaboration", "adaptability", "resilience"];
    const ev = extractEvidence({
      targetSkills: skills,
      checkpoints: [{ id: "c", nodeId: "n", kind: "decision", transcript: fromChunks([{ text: "I kept both days because the vendors had paid for two days of stock. So I cut the stage and the posters. Losing a day would hurt the vendors more than the bands. We still opened on time, and I told the team the same day.", startS: 0, endS: 20 }]) }],
      decisionPath: [],
      nodeSkills: { n: skills },
    });
    const lines = ev.flatMap((e) => (e.sentence ? [e.sentence] : []));
    expect(new Set(lines).size).toBe(lines.length);
  });
});
