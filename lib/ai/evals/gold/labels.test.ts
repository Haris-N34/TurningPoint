import { describe, expect, it } from "vitest";
import answers from "./answers.json";
import labels from "./labels.haris.json";

describe("independent Haris-side gold proposals", () => {
  it("labels every fixed answer exactly once using only rubric levels", () => {
    const ids = answers.answers.map((answer) => answer.id);
    expect(new Set(ids).size).toBe(48);
    expect(Object.keys(labels).sort()).toEqual([...ids].sort());
    expect(Object.values(labels).every((level) => ["strong", "some", "not_observed"].includes(level))).toBe(true);
    expect(new Set(answers.answers.map((answer) => answer.skill)).size).toBe(12);
  });
});
