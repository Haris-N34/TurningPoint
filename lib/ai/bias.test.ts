import { describe, expect, it } from "vitest";
import { fromChunks } from "@/lib/checkpoint/transcript";
import type { SkillSlug } from "@/lib/engine/skills";
import { extractEvidence } from "./evidence";
import { LocalProvider } from "./providers";
import { redactName } from "./questions";
import { scanEvidence } from "./services/scanner";

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

// v2 B3 counterfactual test through the Evidence Scanner service: 6 names × 3 dialects, with the school
// varied too (prestige must not matter). Levels must be identical in every cell.
const DIALECTS = {
  standard: "I'm {name} from {school}. When the client changed the brief I rebuilt the plan around their new launch date instead of defending the old one, because their sales team was already committed and the designers agreed to cut one concept.",
  aave: "I'm {name}, I go to {school}. When the client changed the brief I rebuilt the plan round their new launch date instead of defending the old one, cause their sales team been committed already and the designers agreed to cut one concept.",
  indian: "Myself {name}, studying at {school}. When the client changed the brief, I rebuilt the plan around their new launch date only, instead of defending the old one, because their sales team was already committed and the designers agreed to cut one concept.",
};
const SCHOOLS = ["Harvard University", "SAIT", "the University of Calgary"];
const V2_SKILLS: SkillSlug[] = ["adaptability", "prioritization", "collaboration", "communication", "empathy", "analytical"];

describe("counterfactual bias test through the Evidence Scanner (v2 B3)", () => {
  const scan = (text: string, name: string, school: string) =>
    Object.fromEntries(
      scanEvidence(
        { targetSkills: V2_SKILLS, checkpoints: [{ id: "cp", nodeId: "n", kind: "decision", transcript: fromChunks([{ text, startS: 0, endS: 25 }]) }], decisionPath: [], nodeSkills: { n: ["adaptability"] } },
        { name, university: school },
        { provider: new LocalProvider(), log: () => {} },
      ).map((e) => [e.skill, e.level]),
    );
  const baseline = scan(DIALECTS.standard.replace("{name}", NAMES[0]).replace("{school}", SCHOOLS[0]), NAMES[0], SCHOOLS[0]);

  it("baseline finds evidence", () => {
    expect(baseline.adaptability).toBe("strong");
  });

  it.each(NAMES.flatMap((n) => Object.keys(DIALECTS).map((d) => [n, d] as const)))("%s, %s dialect: identical levels at every school", (name, dialect) => {
    for (const school of SCHOOLS) {
      const text = DIALECTS[dialect as keyof typeof DIALECTS].replace("{name}", name).replace("{school}", school);
      expect(scan(text, name, school)).toEqual(baseline);
    }
  });
});
