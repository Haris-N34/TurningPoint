import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import raw from "@/content/maps/launch-week.json";
import fixture from "@/fixtures/attempt.json";
import { mapCheckpointQuestion } from "@/lib/ai/questions";
import { buildMapCard } from "@/lib/card/buildMap";
import { CardSchema, type Card, type CardCheckpoint } from "@/lib/card/types";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { availableOptions, newGame, openIssues, step, type GameState } from "@/lib/game/engine";
import { parseMapScenario } from "@/lib/game/schema";
import { dayOf } from "@/lib/game/time";

// Maya's demo card (fixtures/attempt.json) is a real Launch Week run: the sponsor pulls out and she picks
// recovery plan B, exactly what the one-minute demo plays in Tab 1. `WRITE_MAYA=1 pnpm vitest run
// tests/qa/maya-fixture.test.ts` rebuilds the fixture from this script; the tests keep it in sync with the map.

const s = parseMapScenario(raw);
const RECOVERY_B_QUESTION = "You chose B, to keep Saturday and Sunday; cut promotion, decorations and the stage. Walk us through why.";

/** Options Maya picks. Anything else open gets its first option. */
const PICKS: Record<string, string> = {
  roles: "b",
  "vendor-mix": "a",
  "vendor-cut": "a",
  schedule: "b",
  fridge: "b",
  "recovery-plan": "b",
  "team-shaken": "a",
  "vendors-worried": "a",
  feedback: "a",
  signups: "a",
};

const CP1_TEXT =
  "I asked who was free when, because two volunteers already wanted social media and nobody wanted deliveries or set-up. Then I paired Ari, who has run markets before, with a new volunteer on logistics. If I had just assigned it, whoever got stuck alone with logistics would check out by Wednesday. It cost us fifteen minutes on Monday, but I'd rather lose fifteen minutes than lose a volunteer.";
const CP2_TEXT =
  "I kept Saturday and Sunday because the vendors had already paid for two days of stock, and families come for the food, not the stage. So I cut promotion, decorations and the stage, and protected both market days. That hurts the two bands we booked and the market looks plainer, so I called both bands myself that morning. Losing a day would have cost the vendors more than it cost us.";

const words = (t: string) => t.split(/\s+/).length;
const secs = (t: string) => Math.round((words(t) / 2.6) * 100) / 100;

function play() {
  let st: GameState = newGame(s, "att_demo_maya", { turnBased: true });
  st = { ...st, tp: { ...st.tp, disruptionId: "sponsor-pulls-out" } };
  const dues: { due: GameState["checkpointsDue"][number]; st: GameState }[] = [];
  const clear = (x: GameState) => {
    for (const due of x.checkpointsDue) dues.push({ due, st: x });
    return x.checkpointsDue.reduce((y, c) => step(s, y, c.kind === "order" ? { type: "orderAnswer", ranking: openIssues(s, y).map((i) => i.id) } : { type: "checkpointDone", id: c.id }), x);
  };
  for (let guard = 0; guard < 200 && !st.ended; guard++) {
    const open = openIssues(s, st);
    if (!open.length) {
      // Wait for news; end the day only when nothing else is coming today.
      const waited = clear(step(s, st, { type: "wait" }));
      st = waited.t > st.t && dayOf(waited.t) === dayOf(st.t) ? waited : clear(step(s, st, { type: "endDay" }));
      continue;
    }
    // Most urgent first, the way a careful player works the tracker.
    const issue = [...open].sort((a, b) => (st.issues[a.id].deadline ?? Infinity) - (st.issues[b.id].deadline ?? Infinity))[0];
    let x = clear(step(s, st, { type: "talk", issue: issue.id }));
    if (x.dialogue) {
      const node = s.nodes.find((n) => n.id === x.dialogue!.node)!;
      const opts = availableOptions(node, x).map((o) => o.id);
      const want = PICKS[issue.id];
      x = clear(step(s, x, { type: "choose", issue: issue.id, option: (want && opts.includes(want as never) ? want : opts[0]) as never }));
    }
    st = x;
    if (dayOf(st.t) > 4) break;
  }
  return { st, dues };
}

export function buildMaya(): Card {
  const { st } = play();
  const rolesChoice = st.choices.find((c) => c.issue === "roles")!;
  const cp1Q = mapCheckpointQuestion(s, st, { id: "cp1", kind: "action", t: 0, issue: "roles", action: "choose", optionId: rolesChoice.option, optionLabel: rolesChoice.label });
  const recovery = st.choices.find((c) => c.issue === "recovery-plan")!;
  const cp2Q = mapCheckpointQuestion(s, st, { id: "cp2", kind: "explain", t: 0, issue: "recovery-plan", action: "choose", optionId: recovery.option, optionLabel: recovery.label });
  const old = CardSchema.parse(fixture);
  const keep = (id: string) => old.checkpoints.find((c) => c.id === id)!;
  const answers: CardCheckpoint[] = [
    { id: "cp1", nodeId: "roles", kind: "decision", question: cp1Q.question, questionSource: cp1Q.source, mode: "voice", media: "demo/cp1.webm", durationS: secs(CP1_TEXT), transcript: fromChunks([{ text: CP1_TEXT, startS: 0, endS: secs(CP1_TEXT) }]), retakeUsed: false, hidden: false },
    { id: "cp2", nodeId: "recovery-plan", kind: "decision", question: cp2Q.question, questionSource: cp2Q.source, mode: "video", media: "demo/cp2.webm", durationS: secs(CP2_TEXT), transcript: fromChunks([{ text: CP2_TEXT, startS: 0, endS: secs(CP2_TEXT) }]), retakeUsed: true, hidden: false },
    keep("rl"),
    keep("fu"),
  ];
  const card = buildMapCard({
    attemptId: old.attemptId,
    scenario: s,
    state: st,
    answers,
    integrity: [
      { checkpointId: "cp2", kind: "retake_used", detail: "Retake used on checkpoint 2" },
      { checkpointId: "cp1", kind: "focus_lost", detail: "Window lost focus for 3 seconds during the answer" },
    ],
    realStory: { title: old.realStory!.title, checkpointId: "rl", followUpCheckpointId: "fu" },
    challenge: { ...old.challenge, targetSkills: old.targetSkills },
    candidate: old.candidate,
    timeMultiplier: 1,
    now: new Date(old.finishedAt),
  });
  // The demo plays at normal speed; turn-based was only how this script stepped the engine.
  // Evidence keeps the fixture's order: the synthetic impact cohort (lib/impact/seed.ts) maps levels by position.
  const ORDER = ["collaboration", "prioritization", "adaptability", "resilience"];
  const evidence = [...card.evidence].sort((a, b) => ORDER.indexOf(a.skill) - ORDER.indexOf(b.skill));
  // The demo script and pitch name her "Candidate 4F7K" on the anonymous inbox row; keep that id stable.
  return CardSchema.parse({ ...card, anonId: "Candidate 4F7K", evidence, adjustedTiming: false, realStory: { ...card.realStory!, witnesses: old.realStory!.witnesses } });
}

describe("Maya's demo card matches the Launch Week run the demo plays", () => {
  const maya = CardSchema.parse(fixture);

  it.runIf(!!process.env.WRITE_MAYA)("writes fixtures/attempt.json", () => {
    fs.writeFileSync(path.join(process.cwd(), "fixtures/attempt.json"), `${JSON.stringify(buildMaya(), null, 2)}\n`);
  });

  it("is the sponsor run, and her decision path uses real map issues and option labels", () => {
    expect(maya.scenario).toMatchObject({ id: "launch-week", disruptionId: "sponsor-pulls-out" });
    for (const d of maya.decisionPath) {
      const issue = s.issues.find((i) => i.id === d.nodeId);
      expect(issue, d.nodeId).toBeDefined();
      if (/^[a-d]$/.test(d.optionId)) {
        const node = s.nodes.find((n) => n.id === issue!.node)!;
        expect(node.options.find((o) => o.id === d.optionId)?.label).toBe(d.optionLabel);
      }
    }
    expect(maya.decisionPath.find((d) => d.nodeId === "recovery-plan")).toMatchObject({ optionId: "b", optionLabel: "Keep Saturday and Sunday; cut promotion, decorations and the stage" });
  });

  it("checkpoint 2 is the exact explain-on-pick question for recovery plan B", () => {
    expect(maya.checkpoints.find((c) => c.id === "cp2")?.question).toBe(RECOVERY_B_QUESTION);
  });

  it("Prioritization is Strong, from checkpoint 2, with an exact quote", () => {
    const p = maya.evidence.find((e) => e.skill === "prioritization")!;
    expect(p.level).toBe("strong");
    expect(p.source?.type === "clip" && p.source.checkpointId).toBe("cp2");
    for (const e of maya.evidence)
      if (e.source?.type === "clip") {
        const src = e.source;
        expect(maya.checkpoints.find((c) => c.id === src.checkpointId)!.transcript.text).toContain(src.quote);
      }
  });

  it("the fixture is exactly what this script builds", () => {
    expect(JSON.parse(JSON.stringify(buildMaya()))).toEqual(JSON.parse(JSON.stringify(maya)));
  });
});
