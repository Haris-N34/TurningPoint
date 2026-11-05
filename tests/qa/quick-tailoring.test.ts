import { describe, expect, it } from "vitest";
import { applyMapOverrides, diffMap, mapForTemplate, tailorMap } from "@/lib/challenge/mapTailor";
import { forLength } from "@/lib/game/engine";

// QA night: Quick mode (the default length) showed the authored "Three weekdays to get a community market
// ready..." brief on every employer's challenge link. Tailoring and admin edits changed `summary` only, and
// Quick mode reads `quick.summary` first, so "community energy fair" and "financial literacy week" vanished.
const base = mapForTemplate("launch-week")!.map;

describe("QA: employer tailoring survives Quick mode", () => {
  it("industry tailoring reaches the Quick brief", () => {
    const tailored = tailorMap(base, "Energy", "Prairie Grid Energy").map;
    const ov = diffMap(base, tailored);
    const played = forLength(applyMapOverrides(base, ov), "quick");
    expect(played.summary).toMatch(/community energy fair/i);
    expect(played.summary).toMatch(/three weekdays/i);
  });

  it("an admin's own summary edit shows in Quick mode too", () => {
    const edited = { ...structuredClone(base), summary: "Our own brief for the fair." };
    const played = forLength(applyMapOverrides(base, diffMap(base, edited)), "quick");
    expect(played.summary).toBe("Our own brief for the fair.");
  });

  it("the full week keeps its own brief", () => {
    const tailored = tailorMap(base, "Energy", "Prairie Grid Energy").map;
    const played = forLength(applyMapOverrides(base, diffMap(base, tailored)), "full");
    expect(played.summary).toMatch(/five weekdays/i);
    expect(played.summary).toMatch(/community energy fair/i);
  });
});
