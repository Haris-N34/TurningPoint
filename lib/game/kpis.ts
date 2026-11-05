import type { SkillSlug } from "@/lib/engine/skills";
import type { GameState } from "./engine";
import { issueById, nodeById } from "./engine";
import type { MapScenario } from "./schema";

// In-game KPIs (PRD v2, A8 and A12). Deterministic, computed from engine state only: game time and
// outcomes, never real-time speed, path efficiency, clicks or keystrokes. Each has a one-line explanation.

export type Kpi = {
  id: string;
  label: string;
  /** 0..1 for rates and shares, or a raw number (hours, points). null when it doesn't apply. */
  value: number | null;
  display: string;
  explanation: string;
  skills: SkillSlug[];
  /** 0..100 contribution to the game score for its skills (Part D); null when not applicable. */
  score: number | null;
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const handledStatuses = ["resolved", "delegated"];

export function computeKpis(s: MapScenario, st: GameState): Kpi[] {
  const visible = s.issues.filter((i) => !i.hidden);
  const touched = visible.filter((i) => st.issues[i.id].status !== "pending");
  const kpis: Kpi[] = [];

  // 1. Critical issues handled before deadline
  const high = touched.filter((i) => i.severity === "high");
  const highOk = high.filter((i) => {
    const x = st.issues[i.id];
    return handledStatuses.includes(x.status) && (x.deadline === undefined || (x.closedAt ?? Infinity) <= x.deadline);
  });
  const crit = high.length ? highOk.length / high.length : null;
  kpis.push({
    id: "critical-handled",
    label: "Critical issues handled before deadline",
    value: crit,
    display: crit === null ? "None arose" : `${highOk.length} of ${high.length} (${pct(crit)})`,
    explanation: `Handled ${highOk.length} of ${high.length} high-severity problems before they ran out of time.`,
    skills: ["prioritization"],
    score: crit === null ? null : Math.round(crit * 100),
  });

  // 2. Deliberate deferrals
  const deferred = touched.filter((i) => st.issues[i.id].status === "deferred").length;
  const expired = touched.filter((i) => st.issues[i.id].status === "expired").length;
  const delib = deferred + expired ? deferred / (deferred + expired) : null;
  kpis.push({
    id: "deliberate-deferrals",
    label: "Deliberate deferrals",
    value: delib,
    display: delib === null ? "Nothing left undone" : `${deferred} deferred with a reason, ${expired} ran out`,
    explanation:
      delib === null
        ? "Every problem was handled; nothing had to be set aside."
        : `Of the problems not handled, ${deferred} were consciously deferred with a reason and ${expired} were left to expire.`,
    skills: ["prioritization", "ambiguity"],
    score: delib === null ? 100 : Math.round(delib * 100),
  });

  // 3. Recovery speed
  let recHours: number | null = null;
  if (st.tp.fired && st.tp.at !== undefined && st.recoveryAt !== undefined) recHours = Math.round(((st.recoveryAt - st.tp.at) / 60) * 10) / 10;
  kpis.push({
    id: "recovery-speed",
    label: "Recovery speed",
    value: recHours,
    display: recHours === null ? (st.tp.fired ? "No recovery plan committed" : "Not reached") : `${recHours} game hours`,
    explanation:
      recHours === null
        ? "No recovery plan was committed after the turning point."
        : `Committed a recovery plan ${recHours} game hours after the turning point.`,
    skills: ["resilience", "adaptability"],
    // Within 2 hours is full marks, falling to 40 at 8 hours; none committed scores 0.
    score: !st.tp.fired ? null : recHours === null ? 0 : Math.round(Math.max(40, Math.min(100, 100 - (recHours - 2) * 10))),
  });

  // 4. Budget protected for the core goal
  // Each disruption can spawn its own recovery issue: read the one that was actually committed.
  const recChoice = st.choices.find((c) => s.issues.some((i) => i.id === c.issue && i.tags.includes("recovery")));
  const recovery = recChoice ? issueById(s, recChoice.issue) : undefined;
  const share = recChoice && recovery ? nodeById(s, recovery.node).options.find((o) => o.id === recChoice.option)?.kpi.coreBudgetShare ?? null : null;
  kpis.push({
    id: "budget-protected",
    label: "Budget protected for core goal",
    value: share,
    display: share === null ? "No plan chosen" : pct(share),
    explanation:
      share === null
        ? "No recovery plan was chosen, so nothing was ring-fenced for the core purpose."
        : `The recovery plan kept about ${pct(share)} of the remaining budget for what the market is for.`,
    skills: ["creativity"],
    score: share === null ? (st.tp.fired ? 0 : null) : Math.round(share * 100),
  });

  // 5. Team morale trajectory
  const low = st.moraleLowAfterTp;
  const traj = st.tp.fired && low !== undefined ? st.morale - low : null;
  kpis.push({
    id: "morale-trajectory",
    label: "Team morale trajectory",
    value: traj,
    display: traj === null ? "Not reached" : `${low} → ${st.morale} (${traj >= 0 ? "+" : ""}${traj})`,
    explanation: traj === null ? "The turning point hasn't happened yet." : `Team morale went from a low of ${low} after the setback to ${st.morale}.`,
    skills: ["collaboration", "empathy"],
    score: traj === null ? null : Math.round(Math.max(0, Math.min(100, 50 + traj * 2.5))),
  });

  // 6. Delegation quality
  const attempts = visible.flatMap((i) => st.issues[i.id].delegate ?? []);
  const ok = attempts.filter((a) => a.success).length;
  const dq = attempts.length ? ok / attempts.length : null;
  kpis.push({
    id: "delegation-quality",
    label: "Delegation quality",
    value: dq,
    display: dq === null ? "No delegation" : `${ok} of ${attempts.length} succeeded`,
    explanation:
      dq === null ? "Handled everything personally; nothing was delegated." : `${ok} of ${attempts.length} delegations worked, given each volunteer's reliability and the team's morale.`,
    skills: ["collaboration"],
    score: dq === null ? null : Math.round(dq * 100),
  });

  // 7. Stakeholder balance
  const minTrust = Math.min(...Object.values(st.trust));
  const lowest = s.stakeholders.find((x) => st.trust[x.id] === minTrust);
  kpis.push({
    id: "stakeholder-balance",
    label: "Stakeholder balance",
    value: minTrust,
    display: `Lowest trust ${minTrust} (${lowest?.label ?? ""})`,
    explanation: minTrust >= 30 ? `No stakeholder group fell below 30 trust; the lowest was ${lowest?.label} at ${minTrust}.` : `${lowest?.label} trust fell to ${minTrust}, below the 30 line.`,
    skills: ["empathy", "communication"],
    score: Math.round(Math.max(0, Math.min(100, minTrust >= 30 ? 60 + (minTrust - 30) : minTrust * 2))),
  });

  // 8. Feedback response
  const fb = s.issues.find((i) => i.tags.includes("feedback"));
  const fbChoice = fb ? st.choices.find((c) => c.issue === fb.id) : undefined;
  const fbKind = fbChoice && fb ? nodeById(s, fb.node).options.find((o) => o.id === fbChoice.option)?.kpi.feedback : undefined;
  const fbStatus = fb ? st.issues[fb.id].status : undefined;
  kpis.push({
    id: "feedback-response",
    label: "Feedback response",
    value: fbKind ? { open: 1, defensive: 0.5, dismissive: 0 }[fbKind] : null,
    display: fbKind ? { open: "Took it on board", defensive: "Explained the plan", dismissive: "Set it aside" }[fbKind] : fbStatus === "expired" ? "Not responded to" : "Not reached",
    explanation: fbKind
      ? { open: "After critical feedback, asked what to change first and changed it.", defensive: "After critical feedback, explained the plan rather than changing it.", dismissive: "After critical feedback, said there was no time to change anything." }[fbKind]
      : "The feedback conversation didn't happen.",
    skills: ["feedback"],
    score: fbKind ? { open: 100, defensive: 55, dismissive: 20 }[fbKind] : fbStatus === "expired" ? 0 : null,
  });

  // A12 extras (The Client Pivot): only when the scenario has them.
  // Only discoveries this run can reach (Quick mode drops them; dropped issues have no spawn time).
  const discoveries = s.issues.filter((i) => i.hidden && i.spawnAt);
  if (discoveries.length) {
    const found = discoveries.filter((i) => st.discoveries.includes(i.id)).length;
    kpis.push({
      id: "discoveries",
      label: "Hidden discoveries found",
      value: found,
      display: `${found} of ${discoveries.length}`,
      explanation: `Found ${found} of ${discoveries.length} optional pieces of information nobody pointed to.`,
      skills: ["curiosity"],
      score: Math.round((found / discoveries.length) * 100),
    });
  }
  const data = s.issues.find((i) => i.tags.includes("data"));
  if (data) {
    const c = st.choices.find((x) => x.issue === data.id);
    const insight = c ? nodeById(s, data.node).options.find((o) => o.id === c.option)?.kpi.insight : undefined;
    kpis.push({
      id: "data-insight",
      label: "Correct insight from the data",
      value: insight ? { correct: 1, partial: 0.5, wrong: 0 }[insight] : null,
      display: insight ? { correct: "Picked the finding that mattered", partial: "Partly right", wrong: "Misread the data" }[insight] : "Not done",
      explanation: insight ? `Reading the dashboard, ${{ correct: "picked the finding that mattered", partial: "picked a finding that was only partly right", wrong: "picked a finding the data didn't support" }[insight]}.` : "Didn't review the data.",
      skills: ["analytical"],
      score: insight ? { correct: 100, partial: 55, wrong: 15 }[insight] : 0,
    });
  }

  // Sanity: every KPI only reads engine state (game time and outcomes).
  void issueById;
  return kpis;
}

/** KPI-based part of the game score per skill (Part D): the mean of KPI scores mapped to that skill. */
export function kpiScoreBySkill(kpis: Kpi[]): Partial<Record<SkillSlug, number>> {
  const acc: Partial<Record<SkillSlug, number[]>> = {};
  for (const k of kpis) if (k.score !== null) for (const sk of k.skills) (acc[sk] ??= []).push(k.score);
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v!.reduce((a, b) => a + b, 0) / v!.length)]));
}
