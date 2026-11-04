import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extractEvidence } from "@/lib/ai/evidence";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { SKILLS } from "@/lib/engine/skills";

const rubric = readFileSync("content/rubric-examples.md", "utf8");
for (const skill of SKILLS) {
  const section = rubric.split(`## ${skill.slug}\n`)[1]?.split("\n## ")[0] ?? "";
  for (const [label, level] of [["Strong", "strong"], ["Some", "some"], ["Not observed", "not_observed"]] as const) {
    it(`calibrates ${skill.name}: ${label} with verbatim evidence`, () => {
      const text = section.match(new RegExp(`\\*\\*${label}:\\*\\* “([^”]+)”`))?.[1];
      expect(text).toBeTruthy();
      const result = extractEvidence({ targetSkills: [skill.slug], decisionPath: [], nodeSkills: {}, checkpoints: [{ id: "example", nodeId: "example", kind: "real_life", transcript: fromChunks([{ text: text!, startS: 0, endS: 30 }]) }] })[0];
      expect(result.level).toBe(level);
      if (result.source?.type === "clip") expect(text).toContain(result.source.quote);
    });
  }
}
