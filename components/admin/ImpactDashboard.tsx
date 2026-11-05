"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { store } from "@/lib/store/store";
import { impactReport, type Source } from "@/lib/impact/metrics";
import { seedImpactDemo } from "@/lib/impact/seed";

type Report = ReturnType<typeof impactReport>;
const percent = (value: number | null) => value === null ? "No data" : `${Math.round(value * 100)}%`;
const pending = [
  ["Recruiter minutes per candidate", "Review open/close instrumentation is not available. Decision timestamps do not measure reading time."],
  ["Second Look rescues", "Awaiting the integration rescue event contract."],
  ["AI and human agreement", "Awaiting independently accepted human gold labels and evaluation results."],
  ["Resume claims backed", "Awaiting the resume-to-evidence contract."],
  ["Learning survey · 1 to 5", "Awaiting opt-in post-game survey responses."],
  ["Coach usage", "Awaiting Coach usage events."],
];

function GroupTable({ title, groups }: { title: string; groups: Report["groups"] }) {
  return <section className="rounded-xl border bg-card p-5 sm:p-7">
    <h2 className="font-display text-2xl">{title}</h2>
    {!groups.length ? <p className="mt-4 text-sm text-muted-foreground">No opt-in group data. No group membership is inferred.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Completion and shortlist rates. Shortlist comparisons require ten completed candidates per group.</caption>
      <thead><tr className="border-b text-xs text-muted-foreground"><th scope="col" className="pb-3 pr-4">Group</th><th scope="col" className="pb-3 pr-4">Started / finished</th><th scope="col" className="pb-3 pr-4">Completion</th><th scope="col" className="pb-3">Shortlisted / finished</th></tr></thead>
      <tbody>{groups.map((g) => <tr key={g.label} className="border-b last:border-0"><th scope="row" className="py-4 pr-4 font-medium">{g.label}{g.warning ? <span className="mt-1 block text-xs text-primary">Review: below four-fifths</span> : null}</th><td className="py-4 pr-4 tabular-nums">{g.started} / {g.finished}</td><td className="py-4 pr-4 tabular-nums">{percent(g.completion)}</td><td className="py-4 tabular-nums">{g.rate === null ? "Insufficient data" : `${g.shortlisted} / ${g.finished} (${percent(g.rate)})`}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}

export function ImpactDashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [source, setSource] = useState<Source>("live");
  const [employer, setEmployer] = useState("");
  const [employers, setEmployers] = useState<{id: string; name: string}[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = () => {
    const s = store();
    setReport(impactReport(s, employer || undefined, source));
    setEmployers([...new Map(s.listCards().map((c) => [c.challenge.id, {id: c.challenge.id, name: c.challenge.company}])).values()]);
  };
  useEffect(() => {
    const update = () => {
      const s = store();
      setReport(impactReport(s, employer || undefined, source));
      setEmployers([...new Map(s.listCards().map((c) => [c.challenge.id, {id: c.challenge.id, name: c.challenge.company}])).values()]);
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("focus", update); };
  }, [source, employer]);
  if (!report) return <main className="mx-auto max-w-6xl p-8" aria-busy="true">Loading local impact report…</main>;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-10" data-testid="impact-dashboard">
    <Link href="/admin" className="text-sm underline underline-offset-4">Employer home</Link>
    <header className="mt-8 grid gap-6 border-b pb-8 md:grid-cols-[1fr_auto]">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Turning Point / Impact observatory</p><h1 className="mt-3 font-display text-4xl sm:text-6xl">Evidence of impact.</h1><p className="mt-4 max-w-xl text-muted-foreground">See who gets a chance to show their capability, where review happens, and what needs a closer look.</p></div>
      <div className="self-end"><Button variant="outline" onClick={() => { try { seedImpactDemo(store()); setSource("demo"); setEmployer(""); refresh(); setMessage("Fictional cohort loaded: 200 candidates, 3 employers. Existing local data was preserved."); setError(""); } catch { setError("The demo cohort could not be saved. Check browser storage and try again."); } }}>Load 200 fictional candidates</Button></div>
    </header>
    <p role="status" className="mt-4 text-sm">{message}</p>{error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
    <div className="my-6 flex flex-wrap items-end gap-5">
      <label className="text-sm font-medium">Data source<select className="mt-2 block min-h-11 rounded-md border bg-background px-3" value={source} onChange={(e) => setSource(e.target.value as Source)}><option value="live">Local activity</option><option value="demo">Fictional demo cohort</option></select></label>
      <label className="text-sm font-medium">Employer challenge<select className="mt-2 block min-h-11 max-w-full rounded-md border bg-background px-3" value={employer} onChange={(e) => setEmployer(e.target.value)}><option value="">All employers</option>{employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <Button variant="ghost" onClick={refresh}>Refresh report</Button>
    </div>
    <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">{source === "demo" ? "Synthetic illustration. All candidates, responses and outcomes in this cohort are fictional and do not demonstrate real-world impact." : "Local browser activity only. This is not a production cohort or a causal impact study."} A candidate is counted once across reused cards. Employer filters use challenge membership.</p>
    <section aria-label="Participation funnel" className="my-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Started", report.started], ["Finished", report.finished], ["Reviewed", report.reviewed], ["Shortlisted", report.shortlisted]].map(([label,value],i) => <div key={label} className="rounded-xl border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">0{i+1} / {label}</p><p className="mt-3 font-display text-4xl tabular-nums" data-testid={`impact-${String(label).toLowerCase()}`}>{value}</p></div>)}</section>
    <section aria-label="Evidence and confirmation" className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[["At least one Strong skill", percent(report.strongRate), "Finished candidates with relevant Strong evidence / all finished candidates."], ["Cards reviewed", percent(report.reviewedRate), "Finished candidates with a recorded decision / all finished candidates."], ["Stories witness-confirmed", percent(report.witnessRate), `${report.stories} real-life stories. At least one confirmed witness / cards with a story.`], ["Said vs did · Context", percent(report.consistencyRate), `${report.consistencyChecks} recorded checks. Consistent checks / recorded checks, never a penalty.`]].map(([label,value,note]) => <div key={label} className="rounded-xl bg-secondary p-6"><h2 className="font-medium">{label}</h2><p className="mt-3 font-display text-4xl">{value}</p><p className="mt-3 text-sm text-muted-foreground">{note}</p></div>)}</section>
    <section className="mb-8 rounded-xl border bg-card p-5 sm:p-7"><h2 className="font-display text-2xl">Different strengths, visible.</h2><p className="mt-2 text-sm text-muted-foreground">Counts of Strong and Some evidence by target skill. These are profiles, never an overall hiring score.</p><ul className="mt-6 grid gap-5 sm:grid-cols-2">{report.skills.map((s) => <li key={s.slug}><div className="flex justify-between gap-4 text-sm"><span>{s.name}</span><span className="shrink-0 tabular-nums">{s.strong} Strong · {s.some} Some / {s.total}</span></div><div aria-hidden="true" className="mt-2 flex h-2 overflow-hidden rounded bg-muted"><span className="bg-primary" style={{width: `${s.total ? s.strong/s.total*100 : 0}%`}}/><span className="bg-primary/35" style={{width: `${s.total ? s.some/s.total*100 : 0}%`}}/></div></li>)}</ul></section>
    <div className="grid gap-5"><GroupTable title="Fair access / Answer mode" groups={report.groups}/><GroupTable title="Fair access / Timing" groups={report.timing}/><GroupTable title="Fair access / Opt-in groups" groups={report.demographics}/></div>
    <p className="my-5 text-sm text-muted-foreground">Four-fifths flags compare each eligible group&apos;s shortlist rate with the highest eligible rate in the same table. A flag prompts human investigation; it is not a finding of discrimination. At least 10 completed candidates are required per group. Unknown modes are excluded from comparisons. No demographic membership is inferred.</p>
    <section className="mt-10"><h2 className="font-display text-2xl">What we still need to measure.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{pending.map(([label,note]) => <div key={label} className="rounded-xl border border-dashed p-5"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Awaiting data</p><h3 className="mt-2 font-medium">{label}</h3><p className="mt-2 text-sm text-muted-foreground">{note}</p></div>)}</div></section>
  </main>;
}
