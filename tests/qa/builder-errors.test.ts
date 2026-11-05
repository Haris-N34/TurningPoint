import { describe, expect, it } from "vitest";
import { friendlyMapErrors, mapForTemplate } from "@/lib/challenge/mapTailor";
import { MapScenarioSchema } from "@/lib/game/schema";

// QA night: emptying a dialogue line in the builder showed "Too small: expected string to have >=1 characters"
// with no hint of where. Errors now name the line, question or option.
const base = mapForTemplate("launch-week")!.map;

describe("QA: builder errors in plain words", () => {
  it("an emptied line names the speaker, the conversation and the line", () => {
    const m = structuredClone(base);
    const i = m.nodes.findIndex((n) => n.id === "n-roles");
    m.nodes[i].lines[0].text = "";
    const r = MapScenarioSchema.safeParse(m);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = friendlyMapErrors(r.error.issues, m);
      expect(msgs.join(" ")).toContain('Line 1 of Priya\'s conversation ("How do you split the roles?") is empty.');
      expect(msgs.join(" ")).not.toMatch(/expected string/);
    }
  });

  it("an emptied option label names the option", () => {
    const m = structuredClone(base);
    const i = m.nodes.findIndex((n) => n.id === "n-roles");
    m.nodes[i].options[1].label = "";
    const r = MapScenarioSchema.safeParse(m);
    if (!r.success) expect(friendlyMapErrors(r.error.issues, m).join(" ")).toMatch(/Option B in Priya's conversation/);
    else throw new Error("expected a validation error");
  });

  it("rule errors keep their own words", () => {
    const m = structuredClone(base);
    for (const x of m.issues) x.checkpointEligible = false;
    const r = MapScenarioSchema.safeParse(m);
    if (!r.success) expect(friendlyMapErrors(r.error.issues, m).join(" ")).toMatch(/checkpoint-eligible/);
    else throw new Error("expected a validation error");
  });
});
