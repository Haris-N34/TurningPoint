import { describe, expect, it } from "vitest";
import { parseScenario, ScenarioSchema } from "./schema";
import { miniScenario } from "@/tests/fixtures/mini-scenario";

const problems = (json: unknown) => {
  const r = ScenarioSchema.safeParse(json);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("scenario schema (S.1)", () => {
  it("accepts a valid scenario", () => {
    expect(problems(miniScenario())).toEqual([]);
    expect(parseScenario(miniScenario()).nodes).toHaveLength(8);
  });

  it("rejects an option pointing to a missing node", () => {
    const s = miniScenario();
    s.nodes[1].options![0].next = "nope";
    expect(problems(s).join()).toMatch(/points to missing node "nope"/);
  });

  it("rejects unreachable nodes", () => {
    const s = miniScenario();
    s.nodes.push({ id: "orphan", type: "scene", text: "Nobody gets here.", next: "end" });
    expect(problems(s).join()).toMatch(/"orphan" is unreachable/);
  });

  it("rejects runs with no path to end", () => {
    const s = miniScenario();
    // c5 option b loops back to c4 and option a goes to a scene that loops to c5: no end reachable.
    s.nodes[5].options = [
      { id: "a", label: "Loop", effects: {}, next: "c4" },
      { id: "b", label: "Loop again", effects: {}, next: "c4" },
    ];
    expect(problems(s).join()).toMatch(/no path to an end/);
  });

  it("rejects fewer than 3 checkpoint-eligible nodes", () => {
    const s = miniScenario();
    s.nodes[1].checkpointEligible = false;
    s.nodes[2].checkpointEligible = false;
    expect(problems(s).join()).toMatch(/at least 3 checkpoint-eligible/);
  });

  it("rejects unknown resources, unknown skills and bad disruption pools", () => {
    const s = miniScenario();
    s.nodes[1].options![0].effects = { gold: 5 } as never;
    expect(problems(s).join()).toMatch(/unknown resource "gold"/);

    const t = miniScenario();
    t.targetSkills = ["juggling"];
    expect(problems(t).length).toBeGreaterThan(0);

    const u = miniScenario();
    u.disruptionPool = ["meteor"];
    expect(problems(u).join()).toMatch(/unknown disruption "meteor"/);
  });

  it("requires 2 to 4 options per choice", () => {
    const s = miniScenario();
    s.nodes[1].options = s.nodes[1].options!.slice(0, 1);
    expect(problems(s).length).toBeGreaterThan(0);
  });

  it("parseScenario throws a readable error", () => {
    const s = miniScenario();
    s.start = "missing";
    expect(() => parseScenario(s)).toThrow(/start node "missing" does not exist/);
  });
});
