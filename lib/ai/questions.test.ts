import { describe, expect, it } from "vitest";
import { parseScenario } from "@/lib/engine/schema";
import { planRun } from "@/lib/engine/seed";
import { advance, choose, startRun } from "@/lib/engine/engine";
import { miniScenario } from "@/tests/fixtures/mini-scenario";
import { checkpointQuestion, followUpQuestion, FOLLOW_UP_FALLBACK, MAX_QUESTION_WORDS, pickDetail, redactName } from "./questions";
import { timing } from "@/lib/checkpoint/timing";
import { fromChunks, fromTyping, locateQuote } from "@/lib/checkpoint/transcript";

const s = parseScenario(miniScenario());

function dueAfter(optionId: string, seed = "q") {
  const plan = { ...planRun(s, seed), checkpointNodeIds: ["c1"] };
  const st = advance(s, plan, startRun(s, plan));
  return choose(s, plan, st, optionId, 2000).checkpoint!;
}

describe("checkpoint question (C4.2)", () => {
  it("quotes the choice the candidate just made", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const q = checkpointQuestion(s, dueAfter("b", seed), seed);
      expect(q.source).toBe("generated");
      expect(q.question).toContain('"Let the team vote"');
      expect(q.question.split(/\s+/).length).toBeLessThanOrEqual(MAX_QUESTION_WORDS);
    }
  });

  it("never quotes an option they did not pick as their choice", () => {
    const q = checkpointQuestion(s, dueAfter("a"), "x");
    expect(q.question).toMatch(/^You (chose|picked|went with) "Assign roles yourself"/);
  });

  it("is deterministic per seed", () => {
    expect(checkpointQuestion(s, dueAfter("a", "z"), "z")).toEqual(checkpointQuestion(s, dueAfter("a", "z"), "z"));
  });

  it("falls back when the choice is missing", () => {
    const due = { ...dueAfter("a"), recentChoices: [] };
    expect(checkpointQuestion(s, due, "x").source).toBe("fallback");
  });
});

describe("follow-up question (C5.2)", () => {
  it("asks about a specific detail the candidate said, verbatim", () => {
    const t = "Two summers ago I ran a community garden. In June our funder pulled out and we had half the money.";
    const q = followUpQuestion(t);
    expect(q.source).toBe("generated");
    const quoted = q.question.match(/"([^"]+)"/)![1];
    expect(t.toLowerCase()).toContain(quoted.toLowerCase());
    expect(quoted).toMatch(/funder pulled out/);
  });

  it("uses the fallback for empty or tiny answers", () => {
    expect(followUpQuestion("").question).toBe(FOLLOW_UP_FALLBACK);
    expect(followUpQuestion("Yes.").question).toBe(FOLLOW_UP_FALLBACK);
  });

  it("keeps long details short", () => {
    const d = pickDetail("At the very end of a long and tiring summer of work with the whole team our biggest sponsor suddenly pulled out of the whole project without warning")!;
    expect(d.split(" ").length).toBeLessThanOrEqual(12);
    expect(d).toContain("pulled");
  });
});

describe("redactName (G2)", () => {
  it("removes the candidate's name", () => {
    expect(redactName("I'm Maya Chen and Maya likes gardens", "Maya Chen")).toBe("I'm [name] [name] and [name] likes gardens");
  });
});

describe("timing (C4.3, C5.1, C1.4)", () => {
  it("uses 15/60 for decisions and 30/120 for real life, times the multiplier", () => {
    expect(timing("decision")).toEqual({ thinkS: 15, answerS: 60 });
    expect(timing("real_life")).toEqual({ thinkS: 30, answerS: 120 });
    expect(timing("decision", 1.5)).toEqual({ thinkS: 23, answerS: 90 });
    expect(timing("real_life", 2)).toEqual({ thinkS: 60, answerS: 240 });
    expect(timing("follow_up").answerS).toBe(60);
  });
});

describe("transcripts", () => {
  it("spreads word times across speech chunks and locates quotes", () => {
    const t = fromChunks([
      { text: "I let the team vote", startS: 1, endS: 3 },
      { text: "because nobody wanted logistics", startS: 3.5, endS: 5.5 },
    ]);
    expect(t.text).toBe("I let the team vote because nobody wanted logistics");
    expect(t.words).toHaveLength(9);
    expect(t.words[0].start).toBe(1);
    const loc = locateQuote(t, "nobody wanted logistics")!;
    expect(loc.startS).toBeGreaterThanOrEqual(3.5);
    expect(loc.endS).toBeLessThanOrEqual(5.5);
    expect(locateQuote(t, "I am a leader")).toBeUndefined();
  });

  it("marks an empty recognition as unavailable", () => {
    expect(fromChunks([]).status).toBe("unavailable");
  });

  it("timestamps typed answers by when each word was typed", () => {
    const t = fromTyping("cut the second weekend", [2, 2.5, 3.1, 4]);
    expect(t.words.map((w) => w.start)).toEqual([2, 2.5, 3.1, 4]);
  });
});
