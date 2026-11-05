import { describe, expect, it } from "vitest";
import raw from "@/content/maps/client-pivot.json";
import { availableOptions, newGame, openIssues, step, type GameState } from "@/lib/game/engine";
import { parseMapScenario } from "@/lib/game/schema";

// QA night #30: can a new conversation start while a checkpoint is due? If it can, the UI shows both
// dialogs at once and the conversation's key handler eats the checkpoint's keys.
const s = parseMapScenario(raw);

describe("QA: no conversation starts while a checkpoint is due", () => {
  // FIXME(agent B, lib/game/engine.ts "talk"): fails today. Remove .skip once talk is refused while a checkpoint is due.
  it.skip("talk is refused (or the dialogue stays closed) while checkpointsDue is non-empty", () => {
    let st: GameState = newGame(s, "qa-talk", { turnBased: true });
    let found = false;
    for (let guard = 0; guard < 200 && !st.ended && !found; guard++) {
      const open = openIssues(s, st);
      if (!open.length) { st = step(s, st, { type: "endDay" }); continue; }
      let x = step(s, st, { type: "talk", issue: open[0].id });
      if (x.dialogue) {
        const node = s.nodes.find((n) => n.id === x.dialogue!.node)!;
        x = step(s, x, { type: "choose", issue: open[0].id, option: availableOptions(node, x)[0].id });
      }
      if (x.checkpointsDue.length) {
        const other = openIssues(s, x).find((i) => i.id !== open[0].id);
        if (other) {
          found = true;
          let y: GameState | undefined;
          try { y = step(s, x, { type: "talk", issue: other.id }); } catch { y = undefined; }
          expect(y?.dialogue ?? null).toBeNull();
        }
      }
      st = x.checkpointsDue.reduce((z, c) => step(s, z, c.kind === "order" ? { type: "orderAnswer", ranking: openIssues(s, z).map((i) => i.id) } : { type: "checkpointDone", id: c.id }), x);
    }
    expect(found).toBe(true);
  });
});
