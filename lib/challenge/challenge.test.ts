import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { getScenario } from "@/content/scenarios";
import { CardSchema } from "@/lib/card/types";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { challengeScenario, challengeUrl, getChallengeBySlug, publish, qrDataUrl, reusableFor, saveDraft } from "./challenge";
import { INDUSTRIES, tailorScenario } from "./tailor";

const base = getScenario("sample")!;

describe("tailorScenario (E1.3)", () => {
  it("rewrites names and setting for every industry and stays schema-valid", () => {
    for (const ind of INDUSTRIES) {
      const r = tailorScenario(base, ind, "Prairie Grid");
      expect(r.error).toBeUndefined();
      expect(r.scenario.nodes).toHaveLength(base.nodes.length);
      if (ind !== "Non-profit") {
        expect(r.changed).toBe(true);
        expect(JSON.stringify(r.scenario)).not.toMatch(/food market/i);
      }
    }
    const energy = tailorScenario(base, "Energy").scenario;
    expect(energy.nodes[0].text).toMatch(/community energy fair/);
    // Structure is untouched: same ids, effects, checkpoints.
    expect(energy.nodes.map((n) => n.id)).toEqual(base.nodes.map((n) => n.id));
  });

  it("keeps the original when the result would be invalid", () => {
    const broken = { ...base, nodes: base.nodes.map((n) => (n.type === "choice" ? { ...n, options: n.options.map((o) => ({ ...o, next: "missing" })) } : n)) };
    const r = tailorScenario(broken as typeof base, "Energy");
    expect(r.changed).toBe(false);
    expect(r.error).toMatch(/missing/);
    expect(r.scenario).toBe(broken);
  });
});

describe("challenges (E1.1, E1.6, C7.3)", () => {
  const draft = (s = makeStore(new MemoryKV())) =>
    saveDraft(s, {
      company: { name: "Prairie Grid Energy", colour: "#0f766e" },
      title: "Field Operations Analyst",
      templateId: "sample",
      industry: "Energy",
      targetSkills: ["adaptability", "resilience", "prioritization", "collaboration"],
      scenario: tailorScenario(base, "Energy").scenario,
    });

  it("requires 3 or 4 skills", () => {
    const s = makeStore(new MemoryKV());
    expect(() =>
      saveDraft(s, { company: { name: "X", colour: "#000" }, title: "T", templateId: "sample", industry: "Energy", targetSkills: ["adaptability", "resilience"], scenario: base }),
    ).toThrow(/3 or 4/);
  });

  it("publishes with a public link, job code and QR", async () => {
    const s = makeStore(new MemoryKV());
    const c = draft(s);
    expect(c.status).toBe("draft");
    const p = publish(s, c.id);
    expect(p.status).toBe("published");
    expect(p.publicSlug).toMatch(/^prairie-grid-energy-field-operations-[a-z0-9-]+$/);
    expect(p.jobCode).toMatch(/^TP-[A-Z2-9]{5}$/);
    expect(publish(s, c.id).publicSlug).toBe(p.publicSlug); // stable
    expect(getChallengeBySlug(s, p.publicSlug!)?.id).toBe(c.id);
    expect(challengeScenario(p).nodes[0].text).toMatch(/energy fair/);
    const url = challengeUrl("https://tp.example/", p);
    expect(url).toBe(`https://tp.example/c/${p.publicSlug}`);
    expect(await qrDataUrl(url)).toMatch(/^data:image\/png;base64,/);
  });

  it("lists other published challenges with overlapping skills for reuse", () => {
    const s = makeStore(new MemoryKV());
    const a = publish(s, draft(s).id);
    const b = publish(
      s,
      saveDraft(s, { company: { name: "Bow Credit Union", colour: "#1d4ed8" }, title: "Member Analyst", templateId: "sample", industry: "Banking", targetSkills: ["communication", "empathy", "resilience"], scenario: tailorScenario(base, "Banking").scenario }).id,
    );
    saveDraft(s, { company: { name: "Draft Co", colour: "#000" }, title: "Hidden", templateId: "sample", industry: "Tech", targetSkills: ["resilience", "adaptability", "empathy"], scenario: base });
    const card = { ...CardSchema.parse(fixture), challenge: { id: a.id, title: a.title, company: a.company.name } };
    const r = reusableFor(s, card);
    expect(r.map((x) => x.challenge.id)).toEqual([b.id]);
    expect(r[0].overlap).toEqual(["resilience"]);
    expect(reusableFor(s, card, [b.id])).toEqual([]);
  });
});
