import { describe, expect, it } from "vitest";
import { getScenario } from "@/content/scenarios";
import { getChallenge, saveDraft } from "@/lib/challenge/challenge";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { LocalProvider } from "./providers";
import { mapTerm, mapValues, splitTerms } from "./services/valueMapper";

// B.5: the Value Mapper maps employer competency names onto the framework with a confidence; the admin decides.

const opts = { provider: new LocalProvider(), log: () => {} };

describe("Value Mapper (B.5)", () => {
  it("maps the demo terms with confidence", () => {
    const m = mapValues(splitTerms("Communicate tech and business, Analytical thinking\nMake new discoveries"), opts);
    expect(m.map((x) => x.skill)).toEqual(["communication", "analytical", "curiosity"]);
    for (const x of m) {
      expect(x.confidence).toBeGreaterThanOrEqual(0.7);
      expect(x.why.length).toBeGreaterThan(5);
    }
    expect(m[1].confidence).toBeGreaterThan(m[2].confidence);
  });
  it("common employer phrasings", () => {
    const cases: [string, string][] = [
      ["Team player", "collaboration"],
      ["Customer obsession", "empathy"],
      ["Bias for action under uncertainty", "ambiguity"],
      ["Grit", "resilience"],
      ["Growth mindset", "feedback"],
      ["Time management", "prioritization"],
      ["Resourcefulness", "creativity"],
      ["Data-driven decisions", "analytical"],
      ["Embrace change", "adaptability"],
      ["Root cause problem solving", "problem-solving"],
    ];
    for (const [term, skill] of cases) expect(mapTerm(term).skill, term).toBe(skill);
  });
  it("unknown terms map to nothing with zero confidence, for the admin to pick", () => {
    expect(mapTerm("Synergy")).toMatchObject({ skill: null, confidence: 0 });
  });
  it("the admin's decisions are saved with the challenge", () => {
    const s = makeStore(new MemoryKV());
    const c = saveDraft(s, {
      company: { name: "Acme", colour: "#000" },
      title: "Analyst",
      templateId: "launch-week",
      industry: "Tech",
      targetSkills: ["communication", "analytical", "curiosity"],
      scenario: getScenario("launch-week")!,
      customSkills: [
        { term: "Communicate tech and business", skill: "communication", confidence: 0.9, status: "accepted" },
        { term: "Make new discoveries", skill: "creativity", confidence: 0.8, status: "changed" },
        { term: "Synergy", skill: null, confidence: 0, status: "rejected" },
      ],
    });
    expect(getChallenge(s, c.id)!.customSkills.map((x) => x.status)).toEqual(["accepted", "changed", "rejected"]);
  });
});
