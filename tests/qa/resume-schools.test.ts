import { describe, expect, it } from "vitest";
import { redactResume } from "@/lib/integrations/resume/redact";

// QA night (PRD v2 C4): prestige must not survive resume redaction. Only long forms ("University of X",
// "X College") were caught; short names and "X Business School" went straight through.
const RESUME = [
  "Jane Doe",
  "Education",
  "BSc Computer Science, UCalgary (2026)",
  "Exchange term at McGill",
  "SAIT certificate in welding",
  "Harvard Business School Online course",
  "Summer school at U of T",
  "Experience",
  "Barista at Starbucks (2023 – 2024)",
].join("\n");

describe("QA: resume redaction of school names", () => {
  it.each(["UCalgary", "McGill", "SAIT", "Harvard", "U of T"])("removes %s", (school) => {
    expect(redactResume(RESUME).text).not.toContain(school);
  });
  it("keeps ordinary words", () => {
    const { text } = redactResume("Jane Doe\nExperience\nTutor at Westside Library (2024)\n- Taught saint-themed art classes; used Sait-style planning");
    expect(text).toContain("saint-themed");
  });
});
