import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENARIO_IDS, getScenario } from "./scenarios";
import { checkpointQuestion } from "@/lib/ai/questions";
import { SKILLS } from "@/lib/engine/skills";

describe("editorial fallback coverage (AI.1)", () => {
  for (const id of SCENARIO_IDS) {
    const scenario = getScenario(id)!;
    for (const node of scenario.nodes) {
      if (node.type !== "choice" || !node.checkpointEligible) continue;
      it(`${id}/${node.id}: short question is usable when choice context is missing`, () => {
        expect(node.fallbackQuestion!.trim().split(/\s+/).length).toBeLessThan(30);
        const result = checkpointQuestion(scenario, { nodeId: node.id, recentChoices: [], resources: {} } as Parameters<typeof checkpointQuestion>[1], "editorial-review");
        expect(result).toEqual({ question: node.fallbackQuestion, source: "fallback" });
      });
    }
  }
  it("provides three evidence examples for every shared skill", () => {
    const rubric = readFileSync("content/rubric-examples.md", "utf8");
    for (const skill of SKILLS) {
      const section = rubric.split(`## ${skill.slug}\n`)[1]?.split("\n## ")[0];
      expect(section, skill.slug).toBeTruthy();
      for (const level of ["Strong", "Some", "Not observed"]) expect(section).toContain(`**${level}:**`);
    }
  });
});
