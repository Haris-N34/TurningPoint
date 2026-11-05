import { describe, expect, it } from "vitest";
import raw from "@/content/maps/client-pivot.json";
import { getMapScenario, MAP_IDS } from "@/content/maps";
import manifest from "@/public/assets/portraits/manifest.json";
import { availableOptions, hiddenAvailable, newGame, openIssues, step, walkMinutes, type GameState } from "./engine";
import { computeKpis } from "./kpis";
import { MapScenarioSchema, parseMapScenario } from "./schema";
import { dayOf, formatTime } from "./time";

const s = parseMapScenario(raw);
const SEED = "cp_test";
const ids = (st: GameState) => openIssues(s, st).map((i) => i.id);
const nodeOf = (issue: string) => s.nodes.find((n) => n.id === s.issues.find((i) => i.id === issue)!.node)!;
const clearDue = (st: GameState) =>
  st.checkpointsDue.reduce((x, c) => step(s, x, c.kind === "order" ? { type: "orderAnswer", ranking: ids(x) } : { type: "checkpointDone", id: c.id }), st);
const handle = (st: GameState, issue: string, option?: "a" | "b" | "c" | "d"): GameState => {
  let x = step(s, st, { type: "talk", issue });
  if (!x.dialogue) return x;
  x = step(s, x, { type: "choose", issue, option: option ?? availableOptions(nodeOf(issue), x)[0].id });
  return clearDue(x);
};
/** Advance with `wait` until the issue is open (or the week ends). */
const until = (st: GameState, issue: string) => {
  for (let g = 0; g < 60 && !st.ended && st.issues[issue].status !== "open"; g++) st = clearDue(step(s, st, { type: "wait" }));
  return st;
};

describe("The Client Pivot map content (A.8)", () => {
  it("is registered, valid, and has 14 to 18 visible issues plus 3 hidden discoveries", () => {
    expect(MAP_IDS).toContain("client-pivot");
    expect(getMapScenario("client-pivot")!.title).toBe(s.title);
    expect(MapScenarioSchema.safeParse(raw).success).toBe(true);
    const visible = s.issues.filter((i) => !i.hidden);
    expect(visible.length).toBeGreaterThanOrEqual(14);
    expect(visible.length).toBeLessThanOrEqual(18);
    const hidden = s.issues.filter((i) => i.hidden);
    expect(hidden.map((i) => i.id).sort()).toEqual(["cafe-chat", "dusty-report", "store-employee"]);
    for (const h of hidden) expect(h.tags).toContain("discovery");
  });

  it("has the zones, remote client site, cast and target skills from the brief", () => {
    expect(s.zones.map((z) => z.id)).toEqual(expect.arrayContaining(["desk", "pod", "partner-office", "client", "whiteboard", "cafe"]));
    expect(s.zones.find((z) => z.id === "client")!.remote).toBe(true);
    expect(walkMinutes(s, "desk", "client")).toBe(30);
    const portraits = new Set(manifest.portraits.map((p) => p.id));
    for (const p of ["developer", "analyst", "partner", "store-manager", "cfo", "former-employee"]) {
      expect(s.npcs.some((n) => n.portrait === p)).toBe(true);
      expect(portraits.has(p)).toBe(true);
    }
    const skills = new Set<string>(s.issues.flatMap((i) => i.skillSignals));
    for (const k of ["communication", "analytical", "curiosity", "adaptability"]) expect(skills.has(k)).toBe(true);
    expect(s.targetSkills).toEqual(["communication", "analytical", "curiosity", "adaptability"]);
  });

  it("has a data issue with 3 charts and correct, partial and wrong readings", () => {
    const data = s.issues.filter((i) => i.tags.includes("data"));
    expect(data).toHaveLength(1);
    const node = nodeOf(data[0].id);
    expect(node.charts).toHaveLength(3);
    expect(node.options.map((o) => o.kpi.insight).sort()).toEqual(["correct", "partial", "wrong"]);
  });

  it("has two pitch issues to the CFO and store manager with good and poor fit, moving their trust", () => {
    const pitches = s.issues.filter((i) => i.tags.includes("pitch"));
    expect(pitches.map((i) => i.npc).sort()).toEqual(["cfo", "manager"]);
    for (const p of pitches) {
      const fits = nodeOf(p.id).options.map((o) => o.kpi.fit);
      expect(fits).toContain("good");
      expect(fits).toContain("poor");
      expect(nodeOf(p.id).options.some((o) => Object.keys(o.effects).includes(`trust.${p.npc}`))).toBe(true);
    }
  });

  it("every turning-point dialogue has at least one explain-on-pick option", () => {
    for (const d of s.turningPoint.disruptions)
      for (const id of d.spawn) expect(nodeOf(id).options.some((o) => o.explainOnPick)).toBe(true);
    expect(s.issues.find((i) => i.tags.includes("recovery"))!.id).toBe("phased-plan");
    expect(s.issues.find((i) => i.tags.includes("feedback"))!.npc).toBe("partner");
  });

  it("never has more than 4 visible issues open at once if nothing is handled", () => {
    let st = newGame(s, SEED, { turnBased: true });
    let max = 0;
    for (let d = 0; d < 5 && !st.ended; d++) {
      for (let k = 0; k < 18 && !st.ended && dayOf(st.t) === d; k++) {
        max = Math.max(max, ids(st).length);
        st = clearDue(step(s, st, { type: "move", zone: k % 2 ? "desk" : "pod" }));
      }
      if (!st.ended) st = clearDue(step(s, st, { type: "endDay" }));
    }
    expect(st.ended).toBe(true);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(4);
  });
});

describe("The Client Pivot discoveries (A.8)", () => {
  it("hidden discoveries are reachable from day one and unlock better options", () => {
    let st = newGame(s, SEED, { turnBased: true });
    st = clearDue(step(s, st, { type: "move", zone: "desk" }));
    expect(hiddenAvailable(s, st).map((i) => i.id).sort()).toEqual(["cafe-chat", "dusty-report", "store-employee"]);
    // Locked before discovery.
    expect(availableOptions(nodeOf("pitch-cfo"), st).map((o) => o.id)).not.toContain("c");
    expect(availableOptions(nodeOf("pitch-manager"), st).map((o) => o.id)).not.toContain("c");
    expect(availableOptions(nodeOf("final-deck"), st).map((o) => o.id)).not.toContain("c");
    let k = computeKpis(s, st).find((x) => x.id === "discoveries")!;
    expect(k.display).toBe("0 of 3");
    for (const id of ["cafe-chat", "store-employee", "dusty-report"]) st = handle(st, id, "a");
    expect(st.discoveries.sort()).toEqual(["cafe-chat", "dusty-report", "store-employee"]);
    expect(hiddenAvailable(s, st)).toHaveLength(0);
    expect(availableOptions(nodeOf("pitch-cfo"), st).map((o) => o.id)).toContain("c");
    expect(availableOptions(nodeOf("pitch-manager"), st).map((o) => o.id)).toContain("c");
    expect(availableOptions(nodeOf("final-deck"), st).map((o) => o.id)).toContain("c");
    k = computeKpis(s, st).find((x) => x.id === "discoveries")!;
    expect(k.display).toBe("3 of 3");
    expect(k.score).toBe(100);
  });
});

describe("The Client Pivot data insight (A.8)", () => {
  const readData = (option: "a" | "b" | "c") => {
    const st = until(newGame(s, SEED, { turnBased: true }), "data-read");
    const node = nodeOf("data-read");
    const opt = node.options.find((o) => o.id === option)!;
    return { st: handle(st, "data-read", option), insight: opt.kpi.insight };
  };

  it("scores correct, partial and wrong readings of the dashboard", () => {
    const scores: Record<string, number> = {};
    for (const o of ["a", "b", "c"] as const) {
      const { st, insight } = readData(o);
      const k = computeKpis(s, st).find((x) => x.id === "data-insight")!;
      scores[insight!] = k.score ?? 0;
    }
    expect(scores.correct).toBeGreaterThan(scores.partial);
    expect(scores.partial).toBeGreaterThan(scores.wrong);
    const none = computeKpis(s, newGame(s, SEED)).find((x) => x.id === "data-insight")!;
    expect(none.value).toBeNull();
  });

  it("a wrong reading spawns a follow-up credibility issue, a correct one does not", () => {
    const wrong = s.nodes.find((n) => n.id === nodeOf("data-read").id)!.options.find((o) => o.kpi.insight === "wrong")!.id;
    const right = s.nodes.find((n) => n.id === nodeOf("data-read").id)!.options.find((o) => o.kpi.insight === "correct")!.id;
    expect(readData(wrong as "a").st.issues["credibility-hit"].status).toBe("open");
    expect(readData(right as "a").st.issues["credibility-hit"].status).not.toBe("open");
  });
});

describe("The Client Pivot turning point (A.8)", () => {
  it("fires Wednesday 09:00: the CFO halves the budget and the phased plan, team and CFO issues spawn", () => {
    let st = newGame(s, SEED, { turnBased: true });
    expect(st.tp.disruptionId).toBe("budget-halved");
    st = clearDue(step(s, st, { type: "endDay" }));
    st = clearDue(step(s, st, { type: "endDay" }));
    expect(formatTime(st.t)).toBe("Wed 09:00");
    st = clearDue(step(s, st, { type: "move", zone: "desk" }));
    expect(st.tp.fired).toBe(true);
    expect(st.tp.budgetAfter).toBe(Math.round(st.tp.budgetBefore! * 0.5));
    for (const id of ["phased-plan", "team-worried", "cfo-call"]) expect(st.issues[id].status).toBe("open");
  });

  it("plays a full week to the end with deterministic KPIs including discoveries and data insight", () => {
    const play = () => {
      let st = newGame(s, SEED, { turnBased: true });
      for (let g = 0; g < 250 && !st.ended; g++) {
        st = clearDue(st);
        const open = ids(st);
        if (open.length) st = handle(st, open[0], "a");
        else st = step(s, st, { type: "wait" });
      }
      return st;
    };
    const a = play();
    expect(a.ended).toBe(true);
    const k = computeKpis(s, a);
    expect(k.map((x) => x.id)).toEqual(expect.arrayContaining(["discoveries", "data-insight", "budget-protected", "feedback-response"]));
    expect(k.find((x) => x.id === "data-insight")!.display).toBe("Picked the finding that mattered");
    expect(k.find((x) => x.id === "budget-protected")!.value).toBe(0.85);
    expect(computeKpis(s, play())).toEqual(k);
  });
});
