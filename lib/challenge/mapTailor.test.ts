import { describe, expect, it } from "vitest";
import { getMapScenario } from "@/content/maps";
import { getScenario } from "@/content/scenarios";
import { preparePublishedContent, scenarioForRun } from "@/lib/ai/services/publish";
import { replay } from "@/lib/game/engine";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { challengeMap, publish, saveDraft } from "./challenge";
import { applyMapOverrides, diffMap, mapForTemplate, parseMapWithOverrides, tailorMap } from "./mapTailor";
import { INDUSTRIES } from "./tailor";

const map = getMapScenario("launch-week")!;
const ids = (m: typeof map) => JSON.stringify({ n: m.nodes.map((n) => [n.id, n.options.map((o) => [o.id, o.effects, o.unlocks])]), i: m.issues.map((i) => [i.id, i.node, i.spawnAt]) });

describe("map tailoring and edits (E1.3, E1.4 on v2 maps)", () => {
  it("tailors map wording for every industry, keeping ids and effects", () => {
    for (const ind of INDUSTRIES) {
      const r = tailorMap(map, ind, "Prairie Grid");
      expect(r.error).toBeUndefined();
      expect(ids(r.map)).toBe(ids(map));
      if (ind !== "Non-profit") expect(r.changed).toBe(true);
    }
    const energy = tailorMap(map, "Energy").map;
    expect(energy.summary).toMatch(/community energy fair/);
    expect(JSON.stringify(energy.nodes)).not.toMatch(/\bmarket\b/i);
  });

  it("is deterministic", () => {
    expect(tailorMap(map, "Banking", "Bow River")).toEqual(tailorMap(map, "Banking", "Bow River"));
  });

  it("stores a small diff that rebuilds the edited map", () => {
    const edited = structuredClone(tailorMap(map, "Energy").map);
    edited.nodes[0].lines[0].text = "Two field techs asked for the site briefing.";
    edited.issues.find((i) => i.id === "roles")!.checkpointEligible = false;
    const ov = diffMap(map, edited);
    expect(ov.issues.roles).toEqual({ checkpointEligible: false });
    expect(ov.issues["vendor-mix"]).toEqual({ title: "Supplier mix and fees" });
    expect(ov.lines["n-roles:0"]).toBe("Two field techs asked for the site briefing.");
    const back = applyMapOverrides(map, ov);
    expect(back.nodes[0].lines[0].text).toBe("Two field techs asked for the site briefing.");
    expect(back.summary).toBe(edited.summary);
    expect(ids(back)).toBe(ids(map));
  });

  it("rejects edits that leave fewer than 3 checkpoint-eligible issues; play falls back to the original", () => {
    const edited = structuredClone(map);
    for (const i of edited.issues) i.checkpointEligible = false;
    const ov = diffMap(map, edited);
    expect(() => parseMapWithOverrides(map, ov)).toThrow(/at least 3 checkpoint-eligible/);
    expect(applyMapOverrides(map, ov)).toEqual(map);
  });

  it("a challenge on a map template saves its overrides, plays the edited map, and variants keep edited lines", () => {
    const s = makeStore(new MemoryKV());
    const edited = structuredClone(tailorMap(map, "Energy").map);
    edited.nodes[0].lines[0].text = "Two field techs asked for the site briefing.";
    const scenario = getScenario("launch-week")!;
    const base = { company: { name: "Prairie Grid", colour: "#000" }, title: "Analyst", templateId: "launch-week", industry: "Energy", targetSkills: ["adaptability", "resilience", "prioritization"] as ("adaptability" | "resilience" | "prioritization")[], scenario };
    const c = saveDraft(s, { ...base, mapOverrides: diffMap(map, edited) });
    preparePublishedContent(s, c);
    const pub = publish(s, c.id);
    const played = challengeMap(pub)!;
    expect(played.mapId).toBe("launch-week");
    expect(played.map.summary).toMatch(/community energy fair/);
    for (const seed of ["a", "b", "c", "d"]) expect(scenarioForRun(s, c.id, played.map, seed).nodes[0].lines[0].text).toContain("Two field techs asked for the site briefing.");
    // Engine replay on the edited map matches the original's structure.
    const log = [{ type: "wait" as const }, { type: "wait" as const }];
    expect(replay(played.map, "seed", log).t).toBe(replay(map, "seed", log).t);

    const broken = structuredClone(map);
    for (const i of broken.issues) i.checkpointEligible = false;
    expect(() => saveDraft(s, { ...base, mapOverrides: diffMap(map, broken) })).toThrow();
  });

  it("templates without a map have none", () => {
    expect(mapForTemplate("sample")).toBeUndefined();
    expect(challengeMap({ templateId: "sample" })).toBeUndefined();
  });
});

describe("Quick mode title summary is tailored too", () => {
  it("rewrites quick.summary for the industry and keeps it through the stored diff", () => {
    const base = mapForTemplate("launch-week")!.map;
    expect(base.quick?.summary).toMatch(/community market/i);
    const { map } = tailorMap(base, "Energy", "Prairie Grid Energy");
    expect(map.quick?.summary).toMatch(/community energy fair/i);
    const ov = diffMap(base, map);
    expect(ov.quickSummary).toBe(map.quick?.summary);
    expect(applyMapOverrides(base, ov).quick?.summary).toBe(map.quick?.summary);
  });
});
