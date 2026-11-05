"use client";

import { useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { store } from "@/lib/store/store";
import { funnelByChallenge, impactReport, type Source } from "@/lib/impact/metrics";
import { listDemoSecondLook, seedImpactDemo } from "@/lib/impact/seed";
import { aiEvalImpact, coachUsage, secondLookImpact, telemetryImpact } from "@/lib/impact/partG";
import { listAiCalls, type AiCall } from "@/lib/ai/telemetry";
import { integrationsApi } from "@/lib/integrations/client";
import type { SecondLookEntry } from "@/lib/integrations/store";

type Report = ReturnType<typeof impactReport>;
type Funnel = ReturnType<typeof funnelByChallenge>;
const percent = (value: number | null) => value === null ? "No data" : `${Math.round(value * 100)}%`;
const num = (value: number | null, unit = "") => value === null ? "No data" : `${value}${unit}`;
/** Honest limits (G.1). Each stays until its data truly exists in this demo. */
const limits = (labelled: number, items: number) => [
  ...(labelled ? [] : [["AI and human agreement", `Awaiting data: ${labelled} of ${items} gold-set answers have a settled human label (B.10). Agreement is computed live once labels land.`]]),
  ["Recruiter minutes", "Visible time on the recruiter card, paused when the tab is hidden and capped at 30 minutes per view. Time spent outside Turning Point (ATS, email) is not seen."],
  ["Second Look", "Live entries live in the demo integration server's memory and reset when it restarts."],
  ["Coach usage", "Coach calls carry no candidate data, so practice is not linked to a later real attempt. Practice runs are deleted after 24 hours."],
  ["Learning survey", "Optional, one answer per attempt, kept on the candidate's device. Self-report, not a measured learning outcome."],
];

function Tile({ label, value, note, testId }: { label: string; value: string; note: string; testId?: string }) {
  return <div className="rounded-xl bg-secondary p-6"><h3 className="font-medium">{label}</h3><p className="mt-3 font-display text-4xl" data-testid={testId}>{value}</p><p className="mt-3 text-sm text-muted-foreground">{note}</p></div>;
}

function GroupTable({ title, groups }: { title: string; groups: Report["groups"] }) {
  return <section className="rounded-xl border bg-card p-5 sm:p-7">
    <h2 className="font-display text-2xl">{title}</h2>
    {!groups.length ? <p className="mt-4 text-sm text-muted-foreground">No opt-in group data. No group membership is inferred.</p> : <div className="relative mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Completion and shortlist rates. Shortlist comparisons require ten completed candidates per group.</caption>
      <thead><tr className="border-b text-xs text-muted-foreground"><th scope="col" className="pb-3 pr-4">Group</th><th scope="col" className="pb-3 pr-4">Started / finished</th><th scope="col" className="pb-3 pr-4">Completion</th><th scope="col" className="pb-3">Shortlisted / finished</th></tr></thead>
      <tbody>{groups.map((g) => <tr key={g.label} className="border-b last:border-0"><th scope="row" className="py-4 pr-4 font-medium">{g.label}{g.warning ? <span className="mt-1 block text-xs text-primary">Review: below four-fifths</span> : null}</th><td className="py-4 pr-4 tabular-nums">{g.started} / {g.finished}</td><td className="py-4 pr-4 tabular-nums">{percent(g.completion)}</td><td className="py-4 tabular-nums">{g.rate === null ? "Insufficient data" : `${g.shortlisted} / ${g.finished} (${percent(g.rate)})`}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}

function FunnelTable({ rows }: { rows: Funnel }) {
  return <section className="mb-8 rounded-xl border bg-card p-5 sm:p-7" data-testid="funnel-by-challenge">
    <h2 className="font-display text-2xl">Funnel per challenge</h2>
    {!rows.length ? <p className="mt-4 text-sm text-muted-foreground">No challenge activity yet.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Started, finished and shortlisted candidates for each challenge.</caption>
      <thead><tr className="border-b text-xs text-muted-foreground"><th scope="col" className="pb-3 pr-4">Challenge</th><th scope="col" className="pb-3 pr-4">Started</th><th scope="col" className="pb-3 pr-4">Finished</th><th scope="col" className="pb-3">Shortlisted</th></tr></thead>
      <tbody>{rows.map((f) => <tr key={f.challengeId} className="border-b last:border-0" data-testid={`funnel-${f.challengeId}`}><th scope="row" className="py-4 pr-4 font-medium">{f.company}<span className="block text-xs font-normal text-muted-foreground">{f.title}</span></th><td className="py-4 pr-4 tabular-nums">{f.started}</td><td className="py-4 pr-4 tabular-nums">{f.finished}</td><td className="py-4 tabular-nums">{f.shortlisted}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}

export function ImpactDashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [funnel, setFunnel] = useState<Funnel>([]);
  const [source, setSource] = useState<Source>("live");
  const [employer, setEmployer] = useState("");
  const [employers, setEmployers] = useState<{id: string; name: string}[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [calls, setCalls] = useState<AiCall[]>([]);
  const [coach, setCoach] = useState<ReturnType<typeof coachUsage> | null>(null);
  const [liveSecondLook, setLiveSecondLook] = useState<SecondLookEntry[] | null>(null);
  const [demoSecondLook, setDemoSecondLook] = useState<SecondLookEntry[]>([]);
  const evals = useMemo(() => aiEvalImpact(), []);
  const readEvents = () => {
    const s = store();
    const c = listAiCalls(s);
    setCalls(c);
    setCoach(coachUsage(c, s.listRuns(), Date.now()));
    setDemoSecondLook(listDemoSecondLook(s));
    integrationsApi<{ entries: SecondLookEntry[] }>("second-look").then((r) => setLiveSecondLook(r.entries)).catch(() => setLiveSecondLook(null));
  };
  const refresh = () => {
    readEvents();
    const s = store();
    setReport(impactReport(s, employer || undefined, source));
    setFunnel(funnelByChallenge(s, source));
    setEmployers([...new Map(s.listCards().map((c) => [c.challenge.id, {id: c.challenge.id, name: c.challenge.company}])).values()]);
  };
  useEffect(() => {
    const update = () => {
      const s = store();
      setReport(impactReport(s, employer || undefined, source));
      setFunnel(funnelByChallenge(s, source));
      setEmployers([...new Map(s.listCards().map((c) => [c.challenge.id, {id: c.challenge.id, name: c.challenge.company}])).values()]);
    };
    update();
    readEvents();
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("focus", update); };
  }, [source, employer]);
  const sl = secondLookImpact(source === "demo" ? demoSecondLook : liveSecondLook ?? [], source, employer || undefined);
  const ai = telemetryImpact(calls);
  if (!report) return <main className="mx-auto max-w-6xl p-8" aria-busy="true">Loading local impact report…</main>;
  return <main className="mx-auto max-w-6xl px-4 pb-12 pt-3 sm:px-10" data-testid="impact-dashboard">
    <BackLink href="/admin">Employer home</BackLink>
    <header className="mt-2 grid gap-4 border-b border-border/70 pb-6 md:grid-cols-[1fr_auto]">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Impact observatory</p><h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">Evidence of impact.</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">See who gets a chance to show their capability, where review happens, and what needs a closer look.</p></div>
      <div className="self-end"><Button variant="outline" size="sm" onClick={() => { try { seedImpactDemo(store()); setSource("demo"); setEmployer(""); refresh(); setMessage("Fictional cohort loaded: 200 candidates, 3 employers. Existing local data was preserved."); setError(""); } catch { setError("The demo cohort could not be saved. Check browser storage and try again."); } }}>Load 200 fictional candidates</Button></div>
    </header>
    <p role="status" className="mt-4 text-sm">{message}</p>{error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
    <div className="my-6 flex flex-wrap items-end gap-5">
      <label className="text-sm font-medium">Data source<select className="mt-2 block min-h-11 rounded-md border bg-background px-3" value={source} onChange={(e) => setSource(e.target.value as Source)}><option value="live">Local activity</option><option value="demo">Fictional demo cohort</option></select></label>
      <label className="text-sm font-medium">Employer challenge<select className="mt-2 block min-h-11 max-w-full rounded-md border bg-background px-3" value={employer} onChange={(e) => setEmployer(e.target.value)}><option value="">All employers</option>{employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <Button variant="ghost" onClick={refresh}>Refresh report</Button>
    </div>
    <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">{source === "demo" ? "Synthetic illustration. All candidates, responses and outcomes in this cohort are fictional and do not demonstrate real-world impact." : "Local browser activity only. This is not a production cohort or a causal impact study."} A candidate is counted once across reused cards. Employer filters use challenge membership.</p>
    <section aria-label="Participation funnel" className="my-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Started", report.started], ["Finished", report.finished], ["Reviewed", report.reviewed], ["Shortlisted", report.shortlisted]].map(([label,value],i) => <div key={label} className="rounded-xl border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">0{i+1} / {label}</p><p className="mt-3 font-display text-4xl tabular-nums" data-testid={`impact-${String(label).toLowerCase()}`}>{value}</p></div>)}</section>
    <FunnelTable rows={funnel}/>
    <section aria-label="Evidence and confirmation" className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[["At least one Strong skill", percent(report.strongRate), "Finished candidates with relevant Strong evidence / all finished candidates."], ["Cards reviewed", percent(report.reviewedRate), "Finished candidates with a recorded decision / all finished candidates."], ["Stories witness-confirmed", percent(report.witnessRate), `${report.stories} real-life stories. At least one confirmed witness / cards with a story.`], ["Said vs did · Context", percent(report.consistencyRate), `${report.consistencyChecks} recorded checks. Consistent checks / recorded checks, never a penalty.`]].map(([label,value,note]) => <div key={label} className="rounded-xl bg-secondary p-6"><h2 className="font-medium">{label}</h2><p className="mt-3 font-display text-4xl">{value}</p><p className="mt-3 text-sm text-muted-foreground">{note}</p></div>)}</section>
    <section className="mb-8 rounded-xl border bg-card p-5 sm:p-7"><h2 className="font-display text-2xl">Different strengths, visible.</h2><p className="mt-2 text-sm text-muted-foreground">Counts of Strong and Some evidence by target skill. These are profiles, never an overall hiring score.</p><ul className="mt-6 grid gap-5 sm:grid-cols-2">{report.skills.map((s) => <li key={s.slug}><div className="flex justify-between gap-4 text-sm"><span>{s.name}</span><span className="shrink-0 tabular-nums">{s.strong} Strong · {s.some} Some / {s.total}</span></div><div aria-hidden="true" className="mt-2 flex h-2 overflow-hidden rounded bg-muted"><span className="bg-primary" style={{width: `${s.total ? s.strong/s.total*100 : 0}%`}}/><span className="bg-primary/35" style={{width: `${s.total ? s.some/s.total*100 : 0}%`}}/></div></li>)}</ul></section>
    <section aria-labelledby="volume-heading" className="mb-8"><h2 id="volume-heading" className="font-display text-2xl">Recruiters handle volume.</h2><div className="mt-5 grid gap-4 md:grid-cols-2">
      <Tile label="Recruiter minutes per candidate" testId="impact-review-minutes" value={num(report.reviewMinutes, " min")} note={`Median visible time on the card, ${report.timedCandidates} timed candidates.${source === "demo" ? " Synthetic reading times." : ""}`}/>
      <Tile label="Second Look rescues" testId="impact-second-look" value={source === "live" && liveSecondLook === null ? "No data" : String(sl.rescued)} note={source === "live" && liveSecondLook === null ? "The integration server did not answer for this browser's company." : `${sl.flagged} flagged after an ATS resume reject or no review; ${sl.confirmedPass} pass confirmed with a reason, ${sl.queued} waiting. Median ${num(sl.medianMinutesToDecide, " min")} to decide.${source === "demo" ? " Synthetic ATS outcomes; the Strong-in-2 rule ran on the stored cards." : ""}`}/>
    </div></section>
    <section aria-labelledby="truth-heading" className="mb-8"><h2 id="truth-heading" className="font-display text-2xl">Truthful representation.</h2><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Tile label="Resume claims backed" testId="impact-resume-backed" value={percent(report.resume.rate)} note={`${report.resume.backed} of ${report.resume.claims} claims on ${report.resume.cards} cards link to game evidence. The rest are "Not yet shown", never false.${source === "demo" ? " Synthetic resumes, real analyzer." : ""}`}/>
      <Tile label="AI and human agreement" testId="impact-gold" value={evals.goldAccuracy === null ? "No labels yet" : percent(evals.goldAccuracy)} note={`${evals.goldLabelled} of ${evals.goldItems} gold-set answers labelled by people. Bar: 80%, none off by two.`}/>
      <Tile label="No invented evidence" testId="impact-hallucination" value={`${evals.hallucination.correct} / ${evals.hallucination.total}`} note={`Answers that show nothing for a skill, scored Not observed by the local scanner, run live. Bar: 19 of 20.`}/>
      <Tile label="AI calls passing checks" testId="impact-ai-calls" value={percent(ai.validRate)} note={`${ai.calls} calls logged on this device across ${ai.services} services, p95 ${num(ai.p95Ms, " ms")}. Failed checks fall back to templates. This device, not the cohort.`}/>
    </div></section>
    <section aria-labelledby="fulfilment-heading" className="mb-8"><h2 id="fulfilment-heading" className="font-display text-2xl">Internal fulfilment.</h2><div className="mt-5 grid gap-4 md:grid-cols-2">
      <Tile label="I learned something about how I work · 1 to 5" testId="impact-survey" value={num(report.survey.mean)} note={`${report.survey.responses} optional answers (${percent(report.survey.responseRate)} of finishers). Counts 1 to 5: ${report.survey.counts.join(", ")}.${source === "demo" ? " Synthetic answers." : ""}`}/>
      <Tile label="Coach usage" testId="impact-coach" value={source === "demo" ? percent(report.practicedFirst.rate) : String(coach?.feedbackCalls ?? 0)} note={source === "demo" ? `${report.practicedFirst.count} candidates practised with the Coach before their real attempt. Synthetic.` : `Coach feedback calls logged on this device; ${coach?.practiceRunsOnDevice ?? 0} practice runs still here.`}/>
    </div></section>
    <div className="grid gap-5"><GroupTable title="Fair access / Answer mode" groups={report.groups}/><GroupTable title="Fair access / Timing" groups={report.timing}/><GroupTable title="Fair access / Opt-in groups" groups={report.demographics}/></div>
    <p className="my-5 text-sm text-muted-foreground">Four-fifths flags compare each eligible group&apos;s shortlist rate with the highest eligible rate in the same table. A flag prompts human investigation; it is not a finding of discrimination. At least 10 completed candidates are required per group. Unknown modes are excluded from comparisons. No demographic membership is inferred. Opt-in demographics appear only here, in aggregate: never on a Capability Card, in the inbox, or in any evidence level.</p>
    <section className="mt-10"><h2 className="font-display text-2xl">Measurement limits.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{limits(evals.goldLabelled, evals.goldItems).map(([label,note]) => <div key={label} className="rounded-xl border border-dashed p-5"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{note.startsWith("Awaiting data") ? "Awaiting data" : "Limit"}</p><h3 className="mt-2 font-medium">{label}</h3><p className="mt-2 text-sm text-muted-foreground">{note.replace(/^Awaiting data: /, "")}</p></div>)}</div></section>
  </main>;
}
