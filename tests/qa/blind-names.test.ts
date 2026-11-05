import { describe, expect, it } from "vitest";
import { stripPii } from "@/lib/ai/guards/pii";

// QA night (G2): the candidate's name must be stripped before any AI job sees a transcript.
// `\b` in a JS regex without the u flag treats accented letters as non-word, so names that start or
// end with one (José, Zoë, Ångström, Nguyễn) slipped through.
describe("QA: name redaction for non-ASCII names", () => {
  it.each([
    ["José Álvarez", "My manager told José he did well, and Álvarez is on my badge."],
    ["Zoë Li", "Everyone calls me Zoë at work. Li is my family name."],
    ["Nguyễn Thị Ánh", "I am Nguyễn and the team calls me Ánh."],
    ["Siobhán O'Neill", "Siobhán from the team, that's me, O'Neill."],
  ])("strips %s", (name, text) => {
    const out = stripPii(text, { name });
    for (const part of name.split(/\s+/).filter((p) => p.length >= 2)) expect(out).not.toContain(part);
    expect(out).toContain("[name]");
  });

  it("still leaves other words alone (no partial-word hits)", () => {
    expect(stripPii("Ann annotated the plan", { name: "Ann Lee" })).toBe("[name] annotated the plan");
    expect(stripPii("Léa called Léandre", { name: "Léa" })).toBe("[name] called Léandre");
  });
});
