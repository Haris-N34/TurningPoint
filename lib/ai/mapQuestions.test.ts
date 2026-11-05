import { describe, expect, it } from "vitest";
import raw from "@/content/maps/launch-week.json";
import { newGame, step } from "@/lib/game/engine";
import { parseMapScenario } from "@/lib/game/schema";
import { mapCheckpointQuestion, MAX_QUESTION_WORDS } from "./questions";

const s = parseMapScenario(raw);
const base = () => step(s, newGame(s, "q", { turnBased: true }), { type: "wait" });

describe("map checkpoint questions (A9, C4.2)", () => {
  it("quotes a deferral and its reason", () => {
    const st = base();
    const q = mapCheckpointQuestion(s, st, { id: "cp1", kind: "action", t: 0, issue: "roles", action: "defer", reason: "Something more urgent first" });
    expect(q.question).toMatch(/^You deferred "Nobody wants logistics" \("Something more urgent first"\), with ".+" still open\. Why that order\?$/);
  });
  it("quotes the explain-on-pick option with its letter", () => {
    const q = mapCheckpointQuestion(s, base(), { id: "cp1", kind: "explain", t: 0, issue: "roles", action: "choose", optionId: "c", optionLabel: "Take logistics myself so the team stays happy" });
    expect(q.question).toBe("You chose C, to take logistics myself so the team stays happy. Walk us through why.");
  });
  it("names the volunteer for a delegation and the choice for a talk", () => {
    expect(mapCheckpointQuestion(s, base(), { id: "x", kind: "action", t: 0, issue: "roles", action: "delegate", to: "Priya" }).question).toContain("to Priya instead of handling it yourself");
    expect(mapCheckpointQuestion(s, base(), { id: "x", kind: "action", t: 0, issue: "roles", action: "choose", optionLabel: "Let the team vote" }).question).toContain('"Let the team vote"');
  });
  it("asks the order question with the open problems, under 30 words", () => {
    const q = mapCheckpointQuestion(s, base(), { id: "order", kind: "order", t: 0 });
    expect(q.question).toMatch(/^You've got \d open problems: .+\. Which are you going to first, and why\?$/);
    expect(q.question.split(/\s+/).length).toBeLessThanOrEqual(MAX_QUESTION_WORDS);
  });
});

import pivotRaw from "@/content/maps/client-pivot.json";

// Every issue's question reads as a sentence: titles are quoted as written, never lower-cased into the
// sentence ("For nobody wants logistics, you chose ..." was the bug).
describe("map checkpoint questions read naturally for every issue (QA night)", () => {
  for (const [name, map] of [["launch-week", s], ["client-pivot", parseMapScenario(pivotRaw)]] as const) {
    it(`${name}: choose, defer and delegate`, () => {
      const st = step(map, newGame(map, "q", { turnBased: true }), { type: "wait" });
      for (const issue of map.issues) {
        const node = map.nodes.find((n) => n.id === issue.node)!;
        const qs = [
          ...node.options.map((o) => mapCheckpointQuestion(map, st, { id: "x", kind: "action", t: 0, issue: issue.id, action: "choose", optionId: o.id, optionLabel: o.label }).question),
          mapCheckpointQuestion(map, st, { id: "x", kind: "action", t: 0, issue: issue.id, action: "defer", reason: "Something more urgent first" }).question,
          mapCheckpointQuestion(map, st, { id: "x", kind: "action", t: 0, issue: issue.id, action: "delegate", to: "Priya" }).question,
        ];
        for (const q of qs) {
          expect(q, q).not.toMatch(/^For [a-z]/);
          expect(q, q).toContain(`"${issue.title}"`);
          expect(q, q).toMatch(/[?]$/);
          expect(q.split(/\s+/).length, q).toBeLessThanOrEqual(MAX_QUESTION_WORDS);
        }
      }
    });
  }
});

