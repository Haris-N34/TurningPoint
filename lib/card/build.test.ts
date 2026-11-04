import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { getScenario } from "@/content/scenarios";
import { advance, choose, startRun, view } from "@/lib/engine/engine";
import { planRun } from "@/lib/engine/seed";
import { fromChunks } from "@/lib/checkpoint/transcript";
import { anonIdFor, buildCard } from "./build";
import { identity, queryInbox, toRow } from "./inbox";
import { CardSchema, type CardCheckpoint } from "./types";

const scenario = getScenario("sample")!;

function playedRun(seed = "att_build") {
  const plan = { ...planRun(scenario, seed), checkpointNodeIds: ["c1", "c4"] };
  let st = startRun(scenario, plan);
  while (st.status === "playing") {
    const v = view(scenario, plan, st);
    st = v.kind === "choice" ? choose(scenario, plan, st, v.node.options[0].id, 1500, new Date("2026-11-04T10:00:00Z")).state : advance(scenario, plan, st);
  }
  return { plan, state: st };
}

const ans = (id: string, nodeId: string, kind: CardCheckpoint["kind"], text: string): CardCheckpoint => ({
  id, nodeId, kind, question: "Q?", questionSource: "generated", mode: "voice", durationS: 10,
  transcript: fromChunks([{ text, startS: 0.5, endS: 9 }]), retakeUsed: false, hidden: false,
});

describe("buildCard (M3)", () => {
  const { plan, state } = playedRun();
  const card = buildCard({
    attemptId: "att_build",
    scenario,
    plan,
    state,
    answers: [
      ans("cp1", "c1", "decision", "I assigned roles myself because nobody wanted logistics, but it cost some morale with the team."),
      ans("rl", "rl", "real_life", "Our funder pulled out in June so we cut the workshops instead of the garden beds because the volunteers cared about the beds."),
    ],
    integrity: [{ checkpointId: "cp1", kind: "retake_used", detail: "Retake used" }],
    realStory: { title: "The garden summer", checkpointId: "rl" },
    challenge: { id: "ch1", title: "Analyst", company: "Prairie Grid (fictional)" },
    candidate: { displayName: "Maya Chen", university: "University of Calgary", verified: true },
    timeMultiplier: 1.5,
    now: new Date("2026-11-04T11:00:00Z"),
  });

  it("is a valid card with the decision path and turning point", () => {
    expect(CardSchema.safeParse(card).success).toBe(true);
    expect(card.decisionPath).toHaveLength(state.log.length);
    expect(card.decisionPath[0].checkpointId).toBe("cp1");
    expect(card.turningPointAfter).toBe(1); // two choices before the sample's turning point
    expect(card.adjustedTiming).toBe(true);
    expect(card.audit.extractor).toBe("local-rules");
  });

  it("every AI sentence links to a real timestamp (M3 done-when, E3.8)", () => {
    for (const e of card.evidence) {
      if (e.sentence) {
        expect(e.source?.type).toBe("clip");
        if (e.source?.type === "clip") {
          const cp = card.checkpoints.find((c) => c.id === (e.source as { checkpointId: string }).checkpointId)!;
          expect(cp.transcript.text).toContain(e.source.quote);
          expect(e.source.startS).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(card.evidence.some((e) => e.level !== "not_observed")).toBe(true);
  });

  it("never puts the name into the extractor's view (G2)", () => {
    expect(JSON.stringify(card.evidence)).not.toMatch(/Maya|Chen|Calgary/);
    expect(anonIdFor("att_build")).toMatch(/^Candidate [A-Z2-9]{4}$/);
    expect(card.anonId).not.toMatch(/Maya/);
  });
});

describe("inbox (E2, E6, E8)", () => {
  const maya = CardSchema.parse(fixture);
  const other = { ...maya, attemptId: "att_2", anonId: "Candidate ZZ22", finishedAt: "2026-11-05T09:00:00Z", evidence: maya.evidence.map((e) => ({ skill: e.skill, level: "not_observed" as const })), realStory: undefined };

  it("hides identity until shortlist when anonymous review is on (E6.1)", () => {
    expect(identity(maya, true)).toEqual({ displayName: maya.anonId, university: undefined, anonymous: true });
    expect(identity(maya, true, "hold").anonymous).toBe(true);
    expect(identity(maya, true, "shortlist").displayName).toBe("Maya Chen");
    expect(identity(maya, false).displayName).toBe("Maya Chen");
  });

  it("builds rows with top skills, witness, reuse coverage and withdrawn status", () => {
    const r = toRow(maya, ["adaptability", "communication"], { reused: true }, undefined);
    expect(r.topSkills.map((s) => s.level)).toEqual(["strong", "strong", "some"]);
    expect(r.witnessConfirmed).toBe(true);
    expect(r.reused).toBe(true);
    expect(r.covers).toEqual(["adaptability"]);
    expect(r.status).toBe("new");
    expect(toRow(maya, [], { reused: false, revokedAt: "2026-11-05T00:00:00Z" }, undefined).status).toBe("withdrawn");
  });

  it("filters by evidence level and sorts by date or skill strength (E2.2)", () => {
    const rows = [toRow(maya, [], undefined, undefined), toRow(other, [], undefined, { decision: "hold" })];
    expect(queryInbox(rows).map((r) => r.attemptId)).toEqual(["att_2", "att_demo_maya"]);
    expect(queryInbox(rows, {}, { by: "skill", skill: "collaboration" })[0].attemptId).toBe("att_demo_maya");
    expect(queryInbox(rows, { skill: "prioritization", minLevel: "strong" }).map((r) => r.attemptId)).toEqual(["att_demo_maya"]);
    expect(queryInbox(rows, { status: "hold" })).toHaveLength(1);
    expect(queryInbox(rows, { witness: true })).toHaveLength(1);
  });
});
