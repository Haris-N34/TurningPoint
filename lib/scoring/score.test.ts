import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { queryInbox, toRow } from "@/lib/card/inbox";
import { clampResumeWeight, SCORING_CONFIG } from "./config";
import { finalScore, gameSkillScore, resumeSkillScore, scoreCard } from "./score";

describe("game score per skill (D.1)", () => {
  it("combines KPI and transcript parts 50/50", () => {
    expect(gameSkillScore("prioritization", 80, "strong")).toMatchObject({ score: 85, confidence: "High" });
    expect(gameSkillScore("prioritization", 80, "some")).toMatchObject({ score: 70, confidence: "Medium" });
  });
  it("is KPI-only with Low confidence when there is no transcript evidence", () => {
    expect(gameSkillScore("collaboration", 64, "not_observed")).toMatchObject({ score: 64, transcriptPart: null, confidence: "Low" });
    expect(gameSkillScore("collaboration", 64, "needs_review")).toMatchObject({ confidence: "Low" });
  });
  it("uses the transcript alone when no KPI maps to the skill, and None when nothing does", () => {
    expect(gameSkillScore("empathy", undefined, "some")).toMatchObject({ score: 60, confidence: "Medium" });
    expect(gameSkillScore("empathy", undefined, undefined)).toMatchObject({ score: null, confidence: "None" });
  });
});

describe("resume score (D.1)", () => {
  it("counts backed claims fully and unbacked claims at half", () => {
    expect(resumeSkillScore("collaboration", [{ skills: ["collaboration"], backed: true }])).toBe(100);
    expect(resumeSkillScore("collaboration", [{ skills: ["collaboration"], backed: false }])).toBe(50);
    expect(resumeSkillScore("collaboration", [{ skills: ["collaboration"], backed: true }, { skills: ["collaboration"], backed: false }])).toBe(75);
    expect(resumeSkillScore("empathy", [{ skills: ["collaboration"], backed: true }])).toBeNull();
  });
});

describe("final score (D.1)", () => {
  const game = [gameSkillScore("prioritization", 80, "strong"), gameSkillScore("collaboration", 60, "some")];
  it("is game only, with no penalty, when there is no resume", () => {
    const f = finalScore({ targetSkills: ["prioritization", "collaboration"], game });
    expect(f).toMatchObject({ value: Math.round((85 + 60) / 2), resumeWeight: 0, gameWeight: 1, hasResume: false });
  });
  it("weights game 75 / resume 25 by default", () => {
    const f = finalScore({ targetSkills: ["prioritization"], game, claims: [{ skills: ["prioritization"], backed: false }] });
    expect(f.resumeWeight).toBe(0.25);
    expect(f.value).toBe(Math.round(85 * 0.75 + 50 * 0.25));
  });
  it("caps the resume weight at 40%, never higher", () => {
    expect(clampResumeWeight(0.9)).toBe(SCORING_CONFIG.maxResumeWeight);
    expect(clampResumeWeight(-1)).toBe(0);
    const f = finalScore({ targetSkills: ["prioritization"], game, claims: [{ skills: ["prioritization"], backed: true }], resumeWeight: 0.95 });
    expect(f.resumeWeight).toBe(0.4);
    expect(f.gameWeight).toBeCloseTo(0.6);
  });
  it("applies employer skill weights and records the config version", () => {
    const even = finalScore({ targetSkills: ["prioritization", "collaboration"], game });
    const tilted = finalScore({ targetSkills: ["prioritization", "collaboration"], game, skillWeights: { prioritization: 3, collaboration: 1 } });
    expect(tilted.value).toBeGreaterThan(even.value);
    expect(tilted.configVersion).toBe(SCORING_CONFIG.version);
    expect(tilted.breakdown.map((b) => b.weight)).toEqual([0.75, 0.25]);
  });
  it("scores Maya's card from its evidence", () => {
    const card = CardSchema.parse(fixture);
    const f = scoreCard(card);
    expect(f.breakdown).toHaveLength(4);
    expect(f.value).toBeGreaterThan(0);
    expect(f.breakdown.every((b) => b.confidence !== "Low")).toBe(true);
  });
});

describe("no score threshold anywhere (D.2)", () => {
  it("inbox queries never drop a candidate by score", () => {
    const card = CardSchema.parse(fixture);
    const low = { ...card, attemptId: "low", evidence: card.evidence.map((e) => ({ skill: e.skill, level: "not_observed" as const })) };
    const rows = [toRow(card, [], undefined, undefined), toRow(low, [], undefined, undefined)];
    expect(queryInbox(rows)).toHaveLength(2);
    expect(queryInbox(rows, {}, { by: "date" })).toHaveLength(2);
    expect(queryInbox(rows, {}, { by: "final" })).toHaveLength(2);
  });

  it("no source file defines a score threshold, hide-below or auto-reject setting", () => {
    const roots = ["lib/card", "lib/scoring", "lib/integrations", "components/recruiter", "app/api"];
    const files: string[] = [];
    const walk = (d: string) => {
      let entries: string[] = [];
      try {
        entries = readdirSync(d);
      } catch {
        return;
      }
      for (const f of entries) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f)) files.push(p);
      }
    };
    roots.forEach(walk);
    expect(files.length).toBeGreaterThan(5);
    const banned = /(scoreThreshold|minScore|maxScore|hideBelow|autoReject|auto_reject|finalScore\??\.value\s*[<>])/i;
    const hits = files.filter((f) => banned.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
