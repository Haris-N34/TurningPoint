import { describe, expect, it } from "vitest";
import { getMapScenario } from "@/content/maps";
import { getScenario } from "@/content/scenarios";
import attempt from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { newGame, nodeById } from "@/lib/game/engine";
import { stripPii } from "./guards/pii";
import { protectedCheck, protectedMentions } from "./guards/protected";
import { fixturesOf, PROMPTS, SERVICES } from "./prompts/registry";
import { LocalProvider } from "./providers";
import { runSync } from "./run";
import { coach, coachPrompt } from "./services/coach";
import { checkConsistency, localConsistency } from "./services/consistency";
import { fairnessReport } from "./services/fairness";
import { checkpointQuestionPrompt, followUp, interviewQuestion } from "./services/interviewer";
import { scanEvidence } from "./services/scanner";
import { sameStructure, tailor, tailorPrompt } from "./services/tailor";
import { PENDING, transcribeWithRetry } from "./services/transcriber";
import { applyVariants, makeVariants, variantsPrompt } from "./services/variants";
import type { AiCall } from "./telemetry";

// B.2: every B2 service exists with a Zod schema, fixtures and a fallback.

const log = (call: AiCall) => void call;
const opts = { provider: new LocalProvider(), log };

describe("registry", () => {
  it("covers all ten services", () => {
    expect(new Set(PROMPTS.map((p) => p.service))).toEqual(new Set(SERVICES));
  });
  it.each(PROMPTS.map((p) => [p.id, p] as const))("%s has a version, schema, fixtures and a valid fallback", (_, p) => {
    expect(p.version).toMatch(/^\d+\.\d+\.\d+/);
    const fx = fixturesOf(p);
    expect(fx.length).toBeGreaterThan(0);
    for (const f of fx) {
      const local = p.schema.safeParse(p.local(f.input));
      expect(local.success, `${p.id}/${f.name} local output`).toBe(true);
      expect(p.check?.(local.data, f.input), `${p.id}/${f.name} guard`).toBeUndefined();
      expect(p.schema.safeParse(p.fallback(f.input)).success, `${p.id}/${f.name} fallback`).toBe(true);
    }
  });
  it("ids are unique", () => {
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length);
  });
});

describe("guards", () => {
  it("pii: strips name, email, phone, address, postcode and school", () => {
    const t = "I'm Priya Sharma, priya@ucalgary.ca, 403-555-0199, 12 Maple Grove Drive NW, T2N 1N4, at the University of Calgary and SAIT.";
    const out = stripPii(t, { name: "Priya Sharma" });
    for (const bad of ["Priya", "Sharma", "priya@", "403-555", "Maple Grove", "T2N", "Calgary", "SAIT"]) expect(out).not.toContain(bad);
    expect(out).toContain("[email]");
    expect(out).toContain("[university]");
  });
  it("pii: leaves ordinary numbers alone", () => {
    expect(stripPii("We had 3 vendors and $400 left on day 2.")).toBe("We had 3 vendors and $400 left on day 2.");
  });
  it("protected: flags each trait and ignores quoted candidate words", () => {
    for (const q of ["How old is she?", "Is English their first language?", "What religion are they?", "Is she pregnant?", "Where is he from originally? What nationality?", "Do they have a disability?", "What race are they?", "Is that a man or a woman?", "What is their ethnicity?", "Their accent was strong"]) {
      expect(protectedMentions(q).length, q).toBeGreaterThan(0);
    }
    expect(protectedMentions("Where did she show prioritization?")).toEqual([]);
    expect(protectedCheck("They said “my accent”")).toBeUndefined();
  });
});

describe("Scenario Tailor", () => {
  const base = getScenario("launch-week")!;
  it("rewrites wording and keeps structure", () => {
    const r = tailor(base, "Energy", "Prairie Grid", opts);
    expect(r.changed).toBe(true);
    expect(sameStructure(base, r.scenario)).toBe(true);
  });
  it("rejects a rewrite that changes structure and keeps the original", () => {
    const bad = structuredClone(base);
    const choice = bad.nodes.find((n) => n.type === "choice")!;
    if (choice.type === "choice") choice.options[0].effects = { budget: 999999 };
    expect(tailorPrompt.check!(bad, { scenario: base, industry: "Energy" })).toMatch(/structure/);
  });
});

describe("Dialogue Variants", () => {
  const map = getMapScenario("launch-week")!;
  it("three wordings per line, numbers unchanged, picked by seed", () => {
    const table = makeVariants(map, opts);
    const keys = Object.keys(table);
    expect(keys.length).toBe(map.nodes.reduce((a, n) => a + n.lines.length, 0));
    for (const k of keys) expect(table[k]).toHaveLength(3);
    const a = applyVariants(map, table, "seed-a");
    expect(applyVariants(map, table, "seed-a")).toEqual(a);
    const differs = ["s1", "s2", "s3", "s4", "s5"].some((sd) => JSON.stringify(applyVariants(map, table, sd).nodes) !== JSON.stringify(a.nodes));
    expect(differs).toBe(true);
    // Structure untouched.
    expect(a.nodes.map((n) => n.options)).toEqual(map.nodes.map((n) => n.options));
  });
  it("a variant that changes a number is rejected", () => {
    const input = { lines: [{ key: "k", who: "maya", text: "We're $400 short." }] };
    expect(variantsPrompt.check!({ variants: [{ key: "k", texts: ["We're $400 short.", "We are $500 short.", "Okay. We're $400 short."] }] }, input)).toMatch(/number/);
  });
});

describe("Checkpoint Interviewer", () => {
  const map = getMapScenario("launch-week")!;
  const issue = map.issues.find((i) => i.spawnAt !== undefined)!;
  const opt = nodeById(map, issue.node).options[1];
  const state = newGame(map, "q-seed");
  const due = { id: "d1", kind: "explain" as const, t: 0, issue: issue.id, action: "choose" as const, optionId: opt.id, optionLabel: opt.label };
  it("quotes the action in 30 words or fewer", () => {
    const q = interviewQuestion(map, state, due, opts);
    expect(q.question.split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(checkpointQuestionPrompt.check!(q, { scenario: map, state, due })).toBeUndefined();
  });
  it("rejects a question that does not quote the action", () => {
    expect(checkpointQuestionPrompt.check!({ question: "Tell me about yourself and your goals.", source: "generated" }, { scenario: map, state, due })).toMatch(/quote/);
  });
  it("falls back to the template after 4 seconds", async () => {
    const { interviewQuestionAsync } = await import("./services/interviewer");
    const slow = { name: "claude" as const, generate: () => new Promise<never>(() => {}) };
    const t0 = Date.now();
    const q = await interviewQuestionAsync(map, state, { ...due, id: "slow" }, { provider: slow, log, timeoutMs: 30 });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(q.source).toBe("fallback");
    expect(q.question.toLowerCase()).toContain(issue.title.toLowerCase());
  });
  it("follow-up never sees the name", () => {
    const q = followUp("My name is Jamal and our garden at Riverside Community College lost its water, so I organised a rota.", { name: "Jamal Robinson" }, opts);
    expect(q.question).not.toContain("Jamal");
  });
});

describe("Transcriber", () => {
  it("retries once, then marks the transcript pending", async () => {
    let calls = 0;
    const flaky = { transcribe: async () => { calls++; throw new Error("no speech service"); } };
    expect(await transcribeWithRetry(flaky, [])).toEqual(PENDING);
    expect(calls).toBe(2);
  });
  it("succeeds on retry", async () => {
    let calls = 0;
    const t = { transcribe: async () => { if (calls++ === 0) throw new Error("x"); return fromChunks([{ text: "hello there", startS: 0, endS: 1 }]); } };
    expect((await transcribeWithRetry(t, [])).text).toBe("hello there");
  });
});

describe("Evidence Scanner", () => {
  const cp = (text: string) => ({ id: "cp1", nodeId: "n1", kind: "decision" as const, transcript: fromChunks([{ text, startS: 0, endS: 20 }]) });
  it("blind input: same levels with or without the name; quotes have real timestamps", () => {
    const text = "I cut the second weekend instead of the vendor spots, because the vendors had already paid and the team agreed.";
    const a = scanEvidence({ targetSkills: ["prioritization"], checkpoints: [cp(text)], decisionPath: [], nodeSkills: {} }, {}, opts);
    const b = scanEvidence({ targetSkills: ["prioritization"], checkpoints: [cp(`I'm Wei Chen. ${text}`)], decisionPath: [], nodeSkills: {} }, { name: "Wei Chen" }, opts);
    expect(a[0].level).toBe("strong");
    expect(b[0].level).toBe(a[0].level);
    expect(b[0].source?.type === "clip" && b[0].source.startS).toBeGreaterThan(0);
  });
  it("an invented quote is rejected by the guard", async () => {
    const { scannerPrompt } = await import("./services/scanner");
    const input = { targetSkills: ["prioritization" as const], checkpoints: [cp("I picked B.")], decisionPath: [], nodeSkills: {} };
    expect(scannerPrompt.check!({ evidence: [{ skill: "prioritization", level: "strong", sentence: "x", source: { type: "clip", checkpointId: "cp1", quote: "made up", startS: 0, endS: 1 } }] }, input)).toMatch(/quote/);
  });
});

describe("Consistency Checker", () => {
  it("order, explanation and story", () => {
    const out = localConsistency({
      order: { saidFirst: "the vendor deposit", didFirst: "the sponsor call" },
      explanations: [
        { checkpointId: "a", transcript: "I went with the cheaper venue because the deposit was due.", picked: { id: "b", label: "Book the cheaper venue" }, others: [{ id: "a", label: "Keep the original hall" }] },
        { checkpointId: "b", transcript: "Keeping the original hall mattered most to me.", picked: { id: "b", label: "Book the cheaper venue" }, others: [{ id: "a", label: "Keep the original hall" }] },
      ],
      story: { story: "Our community garden lost water access so I organised a rota with neighbours.", followUp: "The hardest part was asking the neighbours to commit to the rota every week.", title: "The garden rota" },
    });
    expect(out.items.map((i) => [i.kind, i.consistent])).toEqual([["order", false], ["explanation", true], ["explanation", false], ["story", true]]);
  });
  it("said is always a verbatim excerpt", () => {
    const items = checkConsistency({ explanations: [{ checkpointId: "a", transcript: "I picked option A. It was safer.", picked: { id: "a", label: "Stay" }, others: [] }] }, opts);
    expect("I picked option A. It was safer.").toContain(items[0].said);
  });
});

describe("Candidate Coach", () => {
  it("gives tips and strengths, never a score", () => {
    const out = coach("I just picked B.", {}, opts);
    expect(out.tips.length).toBeGreaterThan(0);
    expect(Object.keys(out)).toEqual(["strengths", "tips"]);
    expect(JSON.stringify(out)).not.toMatch(/score|\d+%|level/i);
  });
  it("rejects output that looks like a score", () => {
    expect(coachPrompt.check!({ strengths: ["Strong answer, 8/10"], tips: [] }, { answer: "" })).toMatch(/score/);
  });
});

describe("Fairness Monitor", () => {
  it("shortlist rate by mode with the four-fifths warning and min group 10", () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => ({ mode: "voice" as const, group: "A", shortlisted: i < 10 })),
      ...Array.from({ length: 20 }, (_, i) => ({ mode: "text" as const, group: "B", shortlisted: i < 6 })),
      ...Array.from({ length: 4 }, () => ({ mode: "video" as const, group: "C", shortlisted: true })),
    ];
    const r = fairnessReport(rows);
    const text = r.byMode.find((g) => g.name === "text")!;
    expect(text).toMatchObject({ n: 20, rate: 0.3, ratio: 0.6, warning: true });
    expect(r.byMode.find((g) => g.name === "video")).toMatchObject({ suppressed: true, rate: null });
    expect(r.warnings.join(" ")).toMatch(/text.*four-fifths/);
  });
});

describe("services run through the provider", () => {
  it("each call is logged with its prompt id and version", () => {
    const calls: AiCall[] = [];
    runSync(variantsPrompt, fixturesOf(variantsPrompt)[0].input as never, { provider: new LocalProvider(), log: (c) => calls.push(c) });
    expect(calls[0]).toMatchObject({ promptId: "dialogue-variants", promptVersion: "1.0.1", service: "Dialogue Variants", valid: true });
  });
  it("the fixture card parses", () => {
    expect(CardSchema.safeParse(attempt).success).toBe(true);
  });
});
