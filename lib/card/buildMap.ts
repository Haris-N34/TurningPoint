import { EXTRACTOR } from "@/lib/ai/evidence";
import { checkConsistency, consistencyInput } from "@/lib/ai/services/consistency";
import { scanEvidence } from "@/lib/ai/services/scanner";
import type { GameState } from "@/lib/game/engine";
import { computeKpis } from "@/lib/game/kpis";
import type { MapScenario } from "@/lib/game/schema";
import { formatTime } from "@/lib/game/time";
import type { SkillSlug } from "@/lib/engine/skills";
import { anonIdFor } from "./build";
import { CardSchema, type Card, type CardCheckpoint } from "./types";

// Turn a finished map run into a Capability Card (v2 M3 additions: KPIs, said vs did).
export type MapBuildInput = {
  attemptId: string;
  scenario: MapScenario;
  state: GameState;
  answers: CardCheckpoint[];
  integrity: Card["integrity"];
  realStory?: { title: string; checkpointId: string; followUpCheckpointId?: string };
  challenge: { id: string; title: string; company: string; targetSkills?: SkillSlug[] };
  candidate: { displayName: string; university?: string; verified: boolean };
  timeMultiplier: number;
  now?: Date;
};

export function orderConsistency(s: MapScenario, st: GameState): Card["consistency"] {
  if (!st.order.ranking?.length || !st.order.did.length) return [];
  const title = (id: string) => s.issues.find((i) => i.id === id)?.title.toLowerCase() ?? id;
  const said = st.order.ranking[0];
  const did = st.order.did[0];
  return [
    {
      kind: "order",
      said: `Said they'd go to ${title(said)} first`,
      did: said === did ? `Went to ${title(did)} first` : `Went to ${title(did)} first instead`,
      consistent: said === did,
    },
  ];
}

export function buildMapCard(i: MapBuildInput): Card {
  const s = i.scenario, st = i.state;
  const now = (i.now ?? new Date()).toISOString();
  const targetSkills = (i.challenge.targetSkills?.length ? i.challenge.targetSkills : s.targetSkills) as SkillSlug[];
  const cpByIssue = new Map(i.answers.filter((a) => a.kind === "decision").map((a) => [a.nodeId, a.id]));
  const steps = st.events
    .filter((e) => ["resolved", "delegated", "deferred"].includes(e.kind) && e.issue)
    .map((e) => {
      const issue = s.issues.find((x) => x.id === e.issue)!;
      const choice = st.choices.find((c) => c.issue === e.issue);
      const label =
        e.kind === "resolved" ? choice?.label ?? "Handled" : e.kind === "delegated" ? `Delegated to ${s.npcs.find((n) => n.id === e.detail)?.name}` : `Deferred: ${e.detail}`;
      return {
        nodeId: issue.id,
        prompt: `${formatTime(e.t)} · ${issue.title}`,
        optionId: e.kind === "resolved" ? choice?.option ?? "a" : e.kind,
        optionLabel: label,
        decidedMs: 0,
        at: formatTime(e.t),
        t: e.t,
        checkpointId: cpByIssue.get(issue.id),
      };
    });
  const turningPointAfter = st.tp.at === undefined ? -1 : steps.filter((x) => x.t < st.tp.at!).length - 1;
  const nodeSkills: Record<string, SkillSlug[]> = Object.fromEntries(s.issues.map((x) => [x.id, x.skillSignals as SkillSlug[]]));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const decisionPath = steps.map(({ t, ...rest }) => rest);
  const known = { name: i.candidate.displayName, university: i.candidate.university };
  // Evidence Scanner (B2): blind inputs, verified quotes.
  const evidence = scanEvidence(
    { targetSkills, checkpoints: i.answers.map(({ id, nodeId, kind, transcript }) => ({ id, nodeId, kind, transcript })), decisionPath, nodeSkills },
    known,
  );
  return CardSchema.parse({
    attemptId: i.attemptId,
    anonId: anonIdFor(i.attemptId),
    candidate: i.candidate,
    challenge: { id: i.challenge.id, title: i.challenge.title, company: i.challenge.company },
    scenario: { id: s.id, version: s.version, seed: st.seed, disruptionId: st.tp.disruptionId },
    finishedAt: now,
    adjustedTiming: i.timeMultiplier !== 1 || st.turnBased,
    targetSkills,
    evidence,
    decisionPath,
    turningPointAfter,
    checkpoints: i.answers,
    realStory: i.realStory ? { ...i.realStory, witnesses: [] } : undefined,
    integrity: i.integrity,
    kpis: computeKpis(s, st),
    // Consistency Checker (B2): said vs did, context only.
    consistency: checkConsistency(consistencyInput(s, st, i.answers, i.realStory ? { ...i.realStory, witnesses: [] } : undefined, known)),
    audit: { extractor: EXTRACTOR.name, version: EXTRACTOR.version, createdAt: now },
  });
}
