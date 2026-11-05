import { describe, expect, it, vi } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { scoreCard } from "@/lib/scoring/score";
import { analyzeResume, BACKED, extractClaims, NOT_YET_SHOWN, realLifeSuggestion, redactResume, resumeSignals } from "./index";

const card = CardSchema.parse(fixture);

const resume = (name: string, school: string, company: string, extra = "") => `${name}
${name.split(" ")[0].toLowerCase()}.${name.split(" ")[1].toLowerCase()}@example.com | (403) 555-0182 | linkedin.com/in/${name.split(" ")[0].toLowerCase()}
1204 Maple Street NW, Calgary, AB T2N 1N4
Photo: headshot.jpg

Education
Bachelor of Commerce, ${school}, Class of 2027 (2023 - 2027)

Experience
Volunteer Coordinator at ${company} (May 2025 - Aug 2025)
- Led a team of 50 volunteers and kept every volunteer informed when funding was cut
- Cut the workshop series to protect the core program when the budget dropped by half
- Negotiated donated supplies from a local store, saving $2,000
Sales Associate, Northwind Retail Inc. (2024)
- Organized weekly stock counts with three coworkers
${extra}`;

const MAYA = resume("Maya Chen", "University of Calgary", "Bow Valley Food Bank");

describe("Resume Analyzer redaction (C.5)", () => {
  it("strips names, contact, photo, address and graduation years before analysis", () => {
    const r = redactResume(MAYA);
    for (const s of ["Maya", "Chen", "@example.com", "555-0182", "linkedin.com", "Maple Street", "T2N 1N4", "headshot", "2027", "2023", "2025", "2024"]) {
      expect(r.text).not.toContain(s);
    }
    expect(r.total).toBeGreaterThanOrEqual(8);
  });

  it("turns schools into University and companies into Company A, B", () => {
    const r = redactResume(MAYA);
    expect(r.text).not.toMatch(/Calgary|Bow Valley|Northwind/);
    expect(r.text).toContain("University");
    expect(r.text).toContain("Company A");
    expect(r.text).toContain("Company B");
  });

  it("the analyzer only ever receives redacted text", () => {
    const analyzer = vi.fn(extractClaims);
    analyzeResume(MAYA, card, { source: "upload", analyzer });
    expect(analyzer).toHaveBeenCalledTimes(1);
    const input = analyzer.mock.calls[0][0] as string;
    expect(input).not.toMatch(/Maya|Chen|Calgary|Bow Valley|Northwind|example\.com|555|Maple|2027/);
  });
});

describe("claim extraction and linking (C.6)", () => {
  it("extracts role, action, result, has-number and claimed skills", () => {
    const claims = extractClaims(redactResume(MAYA).text);
    expect(claims).toHaveLength(4);
    const lead = claims[0];
    expect(lead.roleLabel).toBe("Volunteer Coordinator");
    expect(lead.hasNumber).toBe(true);
    expect(lead.skills).toEqual(expect.arrayContaining(["collaboration", "communication"]));
    expect(claims[2].result).toMatch(/saving/);
    expect(claims[2].skills).toContain("creativity");
    expect(claims[3].roleLabel).toBe("Sales Associate");
  });

  it("links claims to game evidence or says Not yet shown, never false", () => {
    const a = analyzeResume(MAYA, card, { source: "upload" });
    const lead = a.claims[0];
    expect(lead.backed).toBe(true);
    expect(lead.link?.type).toBe("clip");
    const labels = a.claims.map((c) => (c.backed ? BACKED : NOT_YET_SHOWN));
    expect(labels).toContain(BACKED);
    expect(labels).toContain(NOT_YET_SHOWN);
    expect(JSON.stringify(a)).not.toMatch(/\bfalse claim\b|\bfalsified\b|\blie\b/i);
    expect(BACKED).toBe("Backed by game evidence");
    expect(NOT_YET_SHOWN).toBe("Not yet shown");
  });

  it("stores the result as an optional card field that passes the schema and feeds the Final score", () => {
    const a = analyzeResume(MAYA, card, { source: "upload", now: "2026-11-05T10:00:00Z" });
    const withResume = CardSchema.parse({ ...card, resume: a });
    expect(withResume.resume?.claims.length).toBe(4);
    const f = scoreCard(withResume, { claims: withResume.resume!.claims });
    expect(f.hasResume).toBe(true);
    expect(f.resumeWeight).toBe(0.25);
  });

  it("gives the candidate a private real-life suggestion drawn from their own resume", () => {
    const a = analyzeResume(MAYA, card, { source: "upload" });
    const s = realLifeSuggestion(a.claims);
    expect(s).toMatch(/^You might talk about /);
    expect(s).not.toMatch(/Maya|Calgary|Bow Valley/);
  });
});

describe("counterfactual (C.8)", () => {
  it("same resume with different names, schools and companies gives identical resume signals", () => {
    const variants = [
      MAYA,
      resume("Jamal Washington", "Harvard University", "Goldman Sachs Group"),
      resume("Nguyen Thi Lan", "Mount Royal University", "Calgary Food Bank Society"),
      resume("Priya Raghunathan", "SAIT Polytechnic", "Acme Corp"),
      resume("José Álvarez", "Stanford University", "Bow Valley Food Bank"),
    ];
    const signals = variants.map((v) => JSON.stringify(resumeSignals(analyzeResume(v, card, { source: "upload", now: "x" }))));
    for (const s of signals) expect(s).toBe(signals[0]);
  });
});
