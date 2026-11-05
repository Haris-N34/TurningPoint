import { describe, expect, it } from "vitest";
import { fromChunks } from "@/lib/checkpoint/transcript";
import type { Evidence } from "@/lib/card/types";
import type { SkillSlug } from "@/lib/engine/skills";
import { extractEvidence } from "./evidence";
import { onePerQuote, scanEvidence } from "./services/scanner";

// A single quote backs at most one skill per card (judge feedback): the best fit keeps it, the other skill
// uses its next-best quote or reads Not observed.
const cp = (id: string, text: string, nodeId = "n") => ({ id, nodeId, kind: "decision" as const, transcript: fromChunks([{ text, startS: 0, endS: 20 }]) });
const quotes = (ev: Evidence[]) => ev.flatMap((e) => (e.source?.type === "clip" ? [`${e.source.checkpointId}|${e.source.quote}`] : []));

describe("one quote per skill", () => {
  it("two skills that would cite the same sentence get different quotes", () => {
    const ev = extractEvidence({
      targetSkills: ["adaptability", "resilience"],
      checkpoints: [cp("cp2", "I kept both days because the vendors had paid for two days of stock. So I cut the stage. Losing a day would hurt the vendors more than the bands.", "recovery")],
      decisionPath: [{ nodeId: "recovery", optionId: "b", optionLabel: "Keep Saturday and Sunday; cut the stage" }],
      nodeSkills: { recovery: ["adaptability", "resilience"] },
    });
    const q = quotes(ev);
    expect(new Set(q).size).toBe(q.length);
    expect(ev.every((e) => e.level !== "not_observed")).toBe(true);
  });

  it("a skill with no other quote left reads Not observed", () => {
    const ev = extractEvidence({
      targetSkills: ["prioritization", "collaboration"],
      checkpoints: [cp("c", "I picked the vendors first because the team agreed and it cost us the stage.")],
      decisionPath: [],
      nodeSkills: { n: ["prioritization", "collaboration"] },
    });
    expect(new Set(quotes(ev)).size).toBe(quotes(ev).length);
    expect(ev.filter((e) => e.level === "not_observed")).toHaveLength(1);
  });

  it("the guard holds for any provider: the stronger claim keeps a shared quote", () => {
    const src = { type: "clip" as const, checkpointId: "c", quote: "I cut the stage.", startS: 0, endS: 1 };
    const out = onePerQuote([
      { skill: "adaptability", level: "some", sentence: "x", source: src },
      { skill: "prioritization", level: "strong", sentence: "y", source: src },
    ]);
    expect(out.map((e) => e.level)).toEqual(["not_observed", "strong"]);
  });

  it("holds for every card the scanner builds, across many answers", () => {
    const skills: SkillSlug[] = ["prioritization", "collaboration", "adaptability", "resilience", "communication", "empathy"];
    const answers = [
      "I told the team first because they were worried, but it cost us a day. We still finished.",
      "We switched to one day instead of two because the vendors had paid, and I explained it to everyone.",
      "I listened to Dana, changed the plan, and protected the kids' corner even though it cost a vendor slot.",
    ];
    for (const a of answers) {
      const ev = scanEvidence({ targetSkills: skills, checkpoints: [cp("c", a)], decisionPath: [], nodeSkills: { n: skills } }, {}, { log: () => {} });
      expect(new Set(quotes(ev)).size).toBe(quotes(ev).length);
    }
  });
});
