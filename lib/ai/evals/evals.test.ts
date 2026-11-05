import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { LocalProvider } from "../providers";
import { scannerPrompt, scanEvidence } from "../services/scanner";
import { evaluateGold, GOLD_MIN_ACCURACY, GOLD_MIN_ITEMS, joinGold, type GoldItem } from "./gold";
import { HALLUCINATION_CASES } from "./hallucination";
import { agreement, cohensKappa } from "./metrics";

// B.7: AI evals run with the unit tests in CI, so a prompt, rule or model change that drops accuracy fails
// the build. `pnpm evals:report` (WRITE_EVALS=1) also rewrites docs/EVALS.md.

const opts = { provider: new LocalProvider(), log: () => {} };
const GOLD_DIR = path.join(process.cwd(), "lib/ai/evals/gold");
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(GOLD_DIR, f), "utf8"));
const gold: GoldItem[] = joinGold(
  readJson("answers.json"),
  Object.fromEntries(
    fs
      .readdirSync(GOLD_DIR)
      .filter((f) => /^labels\.[a-z]+\.json$/.test(f))
      .map((f) => [f.split(".")[1], readJson(f)]),
  ),
);

function hallucination() {
  const results = HALLUCINATION_CASES.map((c) => {
    const ev = scanEvidence(
      { targetSkills: [c.skill], checkpoints: [{ id: "cp", nodeId: "n", kind: "decision", transcript: fromChunks([{ text: c.transcript, startS: 0, endS: 15 }]) }], decisionPath: [], nodeSkills: {} },
      {},
      opts,
    )[0];
    return { id: c.id, skill: c.skill, level: ev.level };
  });
  return { results, correct: results.filter((r) => r.level === "not_observed").length };
}

describe("metrics", () => {
  it("Cohen's kappa: perfect, chance and a worked example", () => {
    expect(cohensKappa(["strong", "some", "not_observed"], ["strong", "some", "not_observed"])).toBe(1);
    // 10 items: 7 agree; marginals give pe = 0.34, so kappa = (0.7 - 0.34) / 0.66 = 0.545.
    const a = ["strong", "strong", "strong", "some", "some", "some", "not_observed", "not_observed", "not_observed", "not_observed"] as const;
    const b = ["strong", "strong", "some", "some", "some", "not_observed", "not_observed", "not_observed", "not_observed", "strong"] as const;
    expect(cohensKappa([...a], [...b])).toBeCloseTo(0.545, 2);
  });
  it("counts items off by two levels", () => {
    expect(agreement(["strong", "some"], ["not_observed", "some"])).toMatchObject({ n: 2, accuracy: 0.5, offByTwo: 1 });
  });
});

describe("hallucination eval (B3): 20 Not observed answers", () => {
  it("has 20 fixtures", () => expect(HALLUCINATION_CASES).toHaveLength(20));
  it("scanner says Not observed on 19 or more", () => {
    const h = hallucination();
    expect(h.correct, JSON.stringify(h.results.filter((r) => r.level !== "not_observed"))).toBeGreaterThanOrEqual(19);
  });
  it("an invented quote never survives the guard", () => {
    for (const c of HALLUCINATION_CASES) {
      const input = { targetSkills: [c.skill], checkpoints: [{ id: "cp", nodeId: "n", kind: "decision" as const, transcript: fromChunks([{ text: c.transcript, startS: 0, endS: 15 }]) }], decisionPath: [], nodeSkills: {} };
      const fake = { evidence: [{ skill: c.skill, level: "strong" as const, sentence: "Shows it.", source: { type: "clip" as const, checkpointId: "cp", quote: "I weighed the trade-off carefully", startS: 0, endS: 2 } }] };
      expect(scannerPrompt.check!(fake, input)).toMatch(/quote/);
    }
  });
});

describe("gold-set accuracy eval (B3, B.10)", () => {
  const r = evaluateGold(gold, opts);
  const msg = `Gold set has ${r.labelled} human-labelled items of ${r.total}; B.10 needs ${GOLD_MIN_ITEMS}+ scored by both team members (lib/ai/evals/gold/README.md).`;

  it("gold files parse", () => expect(gold.length).toBeGreaterThan(0));

  it("the harness scores labelled items, flags disputes and computes inter-rater kappa", () => {
    const items = gold.slice(0, 4).map((g, i) => ({ ...g, labels: { div: i === 3 ? "strong" : "not_observed", haris: i === 3 ? "some" : "not_observed" } as GoldItem["labels"] }));
    const e = evaluateGold(items, opts);
    expect(e).toMatchObject({ total: 4, labelled: 3, disputed: 1 });
    expect(e.n).toBe(3);
    expect(typeof e.interRater).toBe("number");
    expect(e.misses.length).toBe(Math.round((1 - e.accuracy) * 3));
  });

  it.skipIf(r.labelled === 0)(`scanner matches humans on ${GOLD_MIN_ACCURACY * 100}%+ with none off by two`, () => {
    expect(r.accuracy, JSON.stringify(r.misses)).toBeGreaterThanOrEqual(GOLD_MIN_ACCURACY);
    expect(r.offByTwo, JSON.stringify(r.misses)).toBe(0);
  });

  it("reports progress toward 40 labelled items", () => {
    if (r.labelled < GOLD_MIN_ITEMS) console.warn(msg);
    expect(r.total).toBeGreaterThan(0);
  });

  it.runIf(!!process.env.WRITE_EVALS)("writes docs/EVALS.md", () => {
    const h = hallucination();
    const now = new Date().toISOString().slice(0, 10);
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const md = [
      "# AI evals",
      "",
      `Generated ${now} by \`pnpm evals:report\` (lib/ai/evals). Scanner: \`${scannerPrompt.id}@${scannerPrompt.version}\`, local rules. These run in CI with the unit tests; a drop below the bars fails the build.`,
      "",
      "| Eval | Bar | Result | Status |",
      "| --- | --- | --- | --- |",
      `| Counterfactual bias (6 names × 3 dialects × 3 schools) | identical levels | enforced by \`lib/ai/bias.test.ts\` | blocks CI on any difference |`,
      `| Hallucination (20 Not observed answers) | 19+ correct | ${h.correct}/20 | ${h.correct >= 19 ? "pass" : "fail"} |`,
      r.labelled
        ? `| Gold set accuracy (${r.labelled} items) | 80%+, none off by two | ${pct(r.accuracy)}, ${r.offByTwo} off by two, kappa ${r.kappa} | ${r.accuracy >= GOLD_MIN_ACCURACY && r.offByTwo === 0 ? "pass" : "fail"} |`
        : `| Gold set accuracy | 80%+, none off by two | waiting for human labels (0 of ${r.total}) | pending (B.10) |`,
      "",
      "## Gold set",
      "",
      `- Items: ${r.total}; labelled: ${r.labelled}; disputed: ${r.disputed}. Target ${GOLD_MIN_ITEMS}+ (B.10, both team members).`,
      `- Inter-rater kappa (Div vs Haris): ${r.interRater ?? "not yet (needs items with both labels)"}.`,
      `- Scanner vs human kappa: ${r.labelled ? r.kappa : "not yet"}.`,
      "",
      "## Hallucination misses",
      "",
      ...(h.results.filter((x) => x.level !== "not_observed").map((x) => `- ${x.id} (${x.skill}): scanner said ${x.level}`) || []),
      ...(h.correct === 20 ? ["None."] : []),
      "",
    ].join("\n");
    fs.writeFileSync(path.join(process.cwd(), "docs/EVALS.md"), md);
  });
});
