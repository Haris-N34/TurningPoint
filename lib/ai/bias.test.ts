import { describe, expect, it } from "vitest";
import { fromChunks } from "@/lib/checkpoint/transcript";
import type { SkillSlug } from "@/lib/engine/skills";
import { extractEvidence } from "./evidence";
import { redactName } from "./questions";

// G4 / F4: the same answer with different names and dialect variants must get the same levels.
// Runs in CI with the unit tests, so a change that breaks this fails the build.

const SKILLS: SkillSlug[] = ["collaboration", "prioritization", "adaptability", "resilience", "communication", "empathy"];

const NAMES = ["Emily Walsh", "Lakisha Washington", "Jamal Robinson", "Priya Sharma", "Wei Chen", "Mohammed Al-Sayed"];

// Same content, different ways of speaking. Meaning is held constant; spelling, grammar and register vary.
const ANSWERS = [
  "My name is {name}. When the sponsor pulled out I cut the second weekend instead of cutting vendor spots, because the vendors had already paid for stock and the team agreed. I told everyone the same day so nobody heard it secondhand.",
  "So I'm {name}. When the sponsor pulled out i cut the second weekend instead of cutting vendor spots cuz the vendors already paid for stock and the team agreed. I told everyone the same day so nobody heard it secondhand.",
  "I am {name}, yeah. When the sponsor pulled out, I cut the second weekend instead of cutting vendor spots, cos the vendors had already paid for their stock and the team agreed. I told everyone the same day so nobody would hear it secondhand.",
  "Me, {name}. When the sponsor pulled out I cut the second weekend instead of cutting the vendor spots because the vendors been paid for stock already and the team agreed. I told everyone same day so nobody heard it secondhand.",
  "This is {name} speaking. When the sponsor pulled out I cut the second weekend rather than cutting vendor spots, since the vendors had already paid for stock and the team agreed. I told everyone that same day so no one heard it secondhand.",
  "Hi, {name} here. When the sponsor pulled out, I chose to cut the second weekend instead of the vendor spots because the vendors had already paid for stock, and the team agreed. I told everyone the same day so nobody heard it secondhand.",
];

function levels(answer: string, name: string) {
  const text = redactName(answer.replace("{name}", name), name);
  const ev = extractEvidence({
    targetSkills: SKILLS,
    checkpoints: [{ id: "cp", nodeId: "n9", kind: "decision", transcript: fromChunks([{ text, startS: 0, endS: 20 }]) }],
    decisionPath: [],
    nodeSkills: { n9: ["prioritization", "adaptability"] },
  });
  return Object.fromEntries(ev.map((e) => [e.skill, e.level]));
}

describe("bias test (G4, F4)", () => {
  const baseline = levels(ANSWERS[0], NAMES[0]);

  it("baseline finds evidence (so the test is meaningful)", () => {
    expect(baseline.prioritization).toBe("strong");
  });

  it.each(NAMES)("same levels for every dialect variant with name %s", (name) => {
    for (const a of ANSWERS) expect(levels(a, name)).toEqual(baseline);
  });

  it("the name never reaches the extractor", () => {
    for (const n of NAMES) expect(redactName(ANSWERS[0].replace("{name}", n), n)).not.toContain(n.split(" ")[0]);
  });
});
