import { describe, expect, it } from "vitest";
import { getMapScenario } from "@/content/maps";
import { newGame } from "./engine";
import { paceOf, scriptedRun } from "./pace";

describe("run length at normal pace (A.19)", () => {
  for (const id of ["launch-week", "client-pivot"]) {
    for (const [name, pick] of [
      ["first option", (ids: string[]) => ids[0]],
      ["last option", (ids: string[]) => ids.at(-1)!],
      ["mixed", (ids: string[], i: number) => ids[i % ids.length]],
    ] as const) {
      it(`${id}, ${name}: 12 to 16 minutes`, () => {
        const s = getMapScenario(id)!;
        const start = newGame(s, "pace", { turnBased: true });
        const r = paceOf(s, start, scriptedRun(s, start, pick));
        if (process.env.PACE_DEBUG) console.log(id, name, (r.total / 60).toFixed(1), JSON.stringify(Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, Math.round(v)]))));
        expect(r.total / 60).toBeGreaterThanOrEqual(12);
        expect(r.total / 60).toBeLessThanOrEqual(16);
      });
    }
  }
});
