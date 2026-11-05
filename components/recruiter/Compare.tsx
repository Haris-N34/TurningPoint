"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LevelBadge, skillName } from "@/components/card/CapabilityCard";
import { getChallenge } from "@/lib/challenge/challenge";
import { comparisonFor } from "@/lib/compare/compare";
import { store } from "@/lib/store/store";

type Comparison = ReturnType<typeof comparisonFor>;
const KINDS = [["decision", "Decision checkpoints"], ["real_life", "Real-life examples"], ["follow_up", "Follow-up answers"]] as const;

export function Compare() {
  const params = useSearchParams();
  const challengeId = params.get("challenge") ?? "";
  const requested = params.get("ids") ?? "";
  const [views, setViews] = useState<Comparison | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => {
      const s = store();
      const challenge = getChallenge(s, challengeId);
      setViews(comparisonFor(s, challengeId, requested.split(",").filter(Boolean), challenge?.anonymousReview ?? true));
      setSkills(challenge?.targetSkills ?? []);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [challengeId, requested]);
  const back = <Link className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={`/recruiter?challenge=${encodeURIComponent(challengeId)}`}>Back to inbox</Link>;
  if (!views) return <main className="p-8" aria-busy="true">Loading shared evidence…</main>;
  if (views.length < 2) return <main className="mx-auto max-w-3xl px-6 py-12">{back}<h1 className="mt-5 font-display text-4xl">Choose two or three shared cards</h1><p className="mt-4 text-muted-foreground">At least two selections must still be shared with this challenge. Withdrawn and unavailable cards are excluded.</p></main>;
  const columns = views.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return <main className="mx-auto max-w-7xl px-5 py-8 sm:px-10" data-testid="compare">
    {back}<p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Recruiter / Evidence alongside evidence</p><h1 className="mt-3 font-display text-4xl">Compare capability</h1><p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">Read the same skills and checkpoint types side by side. Questions can differ between runs. This view preserves anonymous review and shared access; it does not rank candidates or make a hiring decision.</p>
    <section aria-label="Candidate skill profiles" className={`mt-8 grid gap-5 ${columns}`}>{views.map((v) => <article key={v.card.attemptId} className="rounded-xl border bg-card p-5 shadow-card" data-testid="compare-card"><h2 className="font-display text-2xl">{v.name.displayName}</h2><p className="mt-2 text-xs text-muted-foreground">{v.name.anonymous ? "Anonymous first review" : "Identity visible after shortlist or employer setting"}</p><Link className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={`/recruiter/card/${encodeURIComponent(v.card.attemptId)}?challenge=${encodeURIComponent(challengeId)}`}>Open evidence card</Link><ul className="mt-4 divide-y">{skills.map((slug) => { const e = v.card.evidence.find((e) => e.skill === slug); return <li key={slug} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{skillName(slug)}</span><LevelBadge level={e?.level ?? "not_observed"}/></div>{e?.sentence ? <p className="mt-3 text-sm leading-relaxed"><span className="text-xs text-muted-foreground">AI summary · </span>{e.sentence}</p> : <p className="mt-3 text-xs text-muted-foreground">No verified summary for this skill.</p>}{e?.source?.type === "clip" ? <a className="mt-2 inline-flex min-h-11 items-center text-xs underline underline-offset-4" href={`#compare-${v.card.attemptId}-${e.source.checkpointId}`}>Source: “{e.source.quote}” · {Math.floor(e.source.startS / 60)}:{String(Math.floor(e.source.startS % 60)).padStart(2, "0")}</a> : e?.source?.type === "choice" ? <p className="mt-2 text-xs text-muted-foreground">Logged choice: {v.card.decisionPath.find((d) => e.source?.type === "choice" && d.nodeId === e.source.nodeId && d.optionId === e.source.optionId)?.optionLabel}</p> : null}</li>; })}</ul></article>)}</section>
    {KINDS.map(([kind,label]) => <section key={kind} className="mt-10"><h2 className="font-display text-2xl">{label}</h2><div className={`mt-4 grid gap-5 ${columns}`}>{views.map((v) => { const cps = v.card.checkpoints.filter((c) => c.kind === kind); return <article key={v.card.attemptId} className="min-w-0 rounded-xl border bg-card p-5"><h3 className="text-sm font-semibold">{v.name.displayName}</h3>{!cps.length ? <p className="mt-4 text-sm text-muted-foreground">No answer of this type was recorded.</p> : cps.map((cp) => <div key={cp.id} id={`compare-${v.card.attemptId}-${cp.id}`} className="mt-5 scroll-mt-6 border-t pt-4"><p className="text-sm font-medium">{cp.question}</p><p className="mt-2 text-xs text-muted-foreground">{cp.mode} answer{cp.hidden ? " · Recording hidden by candidate" : ""}</p><blockquote className="mt-3 whitespace-pre-wrap break-words border-l-2 border-primary pl-3 text-sm leading-relaxed">{cp.transcript.status === "ready" ? cp.transcript.text || "No transcript text recorded." : "Transcript pending or unavailable."}</blockquote></div>)}</article>; })}</div></section>)}
  </main>;
}
