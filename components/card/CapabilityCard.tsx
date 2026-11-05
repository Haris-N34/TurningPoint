"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Card, Evidence } from "@/lib/card/types";
import { verifyEvidence } from "@/lib/card/verify";
import { SKILLS } from "@/lib/engine/skills";
import { confirmationLine } from "@/lib/witness/witness";
import { cn } from "@/lib/utils";
import { scoreCard } from "@/lib/scoring/score";
import { ClipPlayer, type ClipHandle } from "./ClipPlayer";
import { FinalScoreBox } from "./FinalScoreBox";
import { ResumeEvidence } from "./ResumeEvidence";

// The Capability Card (E3). One component for the recruiter and for the candidate's own preview (C7.1).
// It fits a laptop screen: evidence on the left, decision path and clips on the right.

export const LEVEL_LABEL: Record<Evidence["level"], string> = {
  strong: "Strong",
  some: "Some",
  not_observed: "Not observed",
  needs_review: "Needs human review",
};
// Colour is a hint only; every level also has its text label (A5).
const LEVEL_STYLE: Record<Evidence["level"], string> = {
  strong: "bg-primary text-primary-foreground border-transparent",
  some: "bg-accent text-accent-foreground border-transparent",
  not_observed: "bg-transparent text-muted-foreground",
  needs_review: "bg-secondary text-secondary-foreground border-dashed",
};
const LEVEL_MARK: Record<Evidence["level"], string> = { strong: "●●", some: "●○", not_observed: "○○", needs_review: "?" };

export const skillName = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const KIND_LABEL = { decision: "Checkpoint", real_life: "Real life", follow_up: "Follow-up" } as const;
const CONSISTENCY_LABEL = { order: "Order plan", explanation: "Explanation vs choice", story: "Real story vs follow-up" } as const;

export type CardIdentity = { displayName: string; university?: string; anonymous: boolean };

export function LevelBadge({ level }: { level: Evidence["level"] }) {
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap", LEVEL_STYLE[level])}>
      <span aria-hidden>{LEVEL_MARK[level]}</span>
      {LEVEL_LABEL[level]}
    </Badge>
  );
}

export function CapabilityCard({
  card,
  identity,
  transcriptFirst = false,
  hiddenClipIds = [],
  reused,
  actions,
  seekTo,
  resumeWeight,
  showFinalScore = true,
}: {
  card: Card;
  identity: CardIdentity;
  transcriptFirst?: boolean;
  hiddenClipIds?: string[];
  reused?: { covers: string[] };
  actions?: React.ReactNode;
  /** Jump a clip from outside the card (Recruiter Copilot citations). `n` makes repeat clicks re-seek. */
  seekTo?: { checkpointId: string; t: number; n: number };
  /** Employer's resume weight (0 to 40%). Defaults to the scoring config. */
  resumeWeight?: number;
  /** The Final score depends on each employer's weights, so the candidate preview leaves it out. */
  showFinalScore?: boolean;
}) {
  // Never render evidence that has not passed the quote check (G1, E3.8).
  const evidence = useMemo(() => verifyEvidence(card).evidence, [card]);
  // Final score (Part D): sorts only, shown top right with its breakdown; evidence still leads.
  const final = useMemo(() => scoreCard(card, card.resume ? { claims: card.resume.claims, resumeWeight } : {}), [card, resumeWeight]);
  const decisionClips = card.checkpoints.filter((c) => c.kind === "decision").slice(0, 3);
  const realLife = card.checkpoints.find((c) => c.id === card.realStory?.checkpointId);
  const followUp = card.checkpoints.find((c) => c.id === card.realStory?.followUpCheckpointId);
  const clipTabs = [...decisionClips, ...(realLife ? [realLife] : [])];
  const [active, setActive] = useState(clipTabs[0]?.id);
  const players = useRef<Record<string, ClipHandle | null>>({});
  const confirmed = card.realStory ? confirmationLine(card.realStory.witnesses) : undefined;
  const witnessSentence = card.realStory?.witnesses.find((w) => w.status === "confirmed" && w.sentence)?.sentence;

  // Decision path: long runs scroll sideways. Centre the turning point on load and show which way there is more.
  const pathRef = useRef<HTMLOListElement | null>(null);
  const [pathEdge, setPathEdge] = useState({ left: false, right: false });
  const updatePathEdge = () => {
    const el = pathRef.current;
    if (!el) return;
    setPathEdge({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  };
  const scrollPath = (dir: -1 | 1) => pathRef.current?.scrollBy({ left: dir * pathRef.current.clientWidth * 0.6, behavior: "smooth" });
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const marker = el.querySelector<HTMLElement>('[data-testid="turning-point-marker"]');
    if (marker && el.scrollWidth > el.clientWidth) el.scrollLeft = marker.offsetLeft + marker.offsetWidth / 2 - el.clientWidth / 2;
    updatePathEdge();
    const ro = new ResizeObserver(updatePathEdge);
    ro.observe(el);
    return () => ro.disconnect();
  }, [card.attemptId]);
  const answersRef = useRef<HTMLElement | null>(null);
  const [lastJump, setLastJump] = useState<{ skill?: string; quote?: string; checkpointId: string; t: number; n: number }>();
  const jump = (checkpointId: string, t: number, from?: { skill: string; quote: string }) => {
    setActive(checkpointId);
    setLastJump((p) => ({ ...from, checkpointId, t, n: (p?.n ?? 0) + 1 }));
    // Let the tab render before seeking, then bring the answer into view if it is off screen.
    setTimeout(() => {
      players.current[checkpointId]?.seek(t);
      const el = answersRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight - 160) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };

  useEffect(() => {
    if (!seekTo) return;
    // The follow-up has no tab of its own; it sits with the real-life story.
    const id = clipTabs.some((c) => c.id === seekTo.checkpointId) ? seekTo.checkpointId : realLife?.id;
    if (id) jump(id, id === seekTo.checkpointId ? seekTo.t : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo?.n]);

  return (
    <article className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" data-testid="capability-card" aria-label="Capability Card">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-3 lg:col-span-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Capability Card</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="font-display text-3xl leading-tight tracking-tight" data-testid="card-name">
              {identity.displayName}
            </h1>
            {card.candidate.verified && <Badge variant="secondary">Verified student</Badge>}
            {identity.anonymous && <Badge variant="outline">Anonymous review</Badge>}
            {reused && (
              <Badge variant="outline" data-testid="reused-badge">
                Reused from a previous challenge, skills: {reused.covers.map(skillName).join(", ") || "none of yours"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {card.challenge.company} · {card.challenge.title} · {new Date(card.finishedAt).toLocaleDateString("en-CA")}
            {identity.university && !identity.anonymous ? ` · ${identity.university}` : ""}
          </p>
        </div>
        {(showFinalScore || actions) && (
          <div className="flex flex-wrap items-start justify-end gap-3 lg:flex-nowrap">
            {showFinalScore && <FinalScoreBox score={final} />}
            {actions}
          </div>
        )}
      </header>

      <div className="space-y-4">
        <section aria-labelledby="ev-h" className="rounded-xl border bg-card shadow-card">
          <div className="flex items-baseline justify-between border-b border-border/70 px-4 py-2.5">
            <h2 id="ev-h" className="text-sm font-semibold">Skill evidence</h2>
            <span className="text-xs text-muted-foreground">Click a quote to hear it</span>
          </div>
          <ul className="divide-y divide-border/70" data-testid="evidence">
            {evidence.map((e) => (
              <li key={e.skill} className="px-4 py-2" data-testid={`evidence-${e.skill}`} data-level={e.level}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{skillName(e.skill)}</span>
                  <LevelBadge level={e.level} />
                </div>
                {e.sentence && e.source && (
                  <div className="mt-0.5 space-y-0.5">
                    {e.source.type === "clip" ? (
                      <button
                        type="button"
                        className={cn(
                          "group -mx-2 flex w-[calc(100%+1rem)] items-start gap-2 rounded-lg border border-transparent px-2 py-0.5 text-left text-sm transition-colors hover:border-primary/30 hover:bg-accent/50",
                          lastJump?.skill === e.skill && "border-primary/40 bg-accent/60",
                        )}
                        data-testid={`jump-${e.skill}`}
                        onClick={() => {
                          const s = e.source as { checkpointId: string; startS: number; quote: string };
                          jump(s.checkpointId, s.startS, { skill: e.skill, quote: s.quote });
                        }}
                      >
                        <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground transition-transform group-hover:scale-110">▶</span>
                        <span className="min-w-0 flex-1 text-foreground">
                          <span className="sr-only">Play </span>“{e.source.quote}”
                          <span className="ml-1.5 font-mono text-xs text-muted-foreground">{mmss(e.source.startS)}</span>
                        </span>
                      </button>
                    ) : (
                      <p className="text-sm text-foreground">Choice: “{e.source.optionLabel}”</p>
                    )}
                    <p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground" title={e.sentence}>
                      <span className="mr-1.5 rounded bg-muted px-1 py-px text-[10px] font-medium uppercase tracking-wide text-foreground/80">AI summary</span>
                      {e.sentence}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {card.realStory && (
          <section aria-labelledby="rl-h" className="rounded-xl bg-story px-4 py-3" data-testid="real-story">
            <h2 id="rl-h" className="text-xs font-medium uppercase tracking-widest text-primary">Real turning point</h2>
            <p className="mt-1 font-display text-lg leading-snug">“{card.realStory.title}”</p>
            {realLife?.transcript.text && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{realLife.transcript.text}</p>}
            {followUp && (
              <p className="mt-1 line-clamp-1 text-sm">
                <span className="font-medium">{followUp.question}</span>{" "}
                <span className="text-muted-foreground">{followUp.transcript.text}</span>
              </p>
            )}
            <p className="mt-1 text-sm font-medium" data-testid="witness-line">
              {confirmed ?? "No witness confirmation yet"}
            </p>
            {witnessSentence && <p className="text-sm italic text-muted-foreground">“{witnessSentence}”</p>}
          </section>
        )}

      </div>

      <div className="min-w-0 space-y-4">
        {clipTabs.length > 0 && (
          <section ref={answersRef} aria-labelledby="clips-h" className={cn("scroll-mt-4 rounded-xl border bg-card p-4 shadow-card transition-shadow", lastJump && "ring-2 ring-primary/25")} data-testid="answers">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="clips-h" className="text-sm font-semibold">Answers</h2>
              {lastJump?.skill && (
                <p key={lastJump.n} className="tp-pop rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground" role="status" data-testid="jump-banner">
                  ▶ {skillName(lastJump.skill)} quote at {mmss(lastJump.t)}
                </p>
              )}
            </div>
            <div role="tablist" aria-label="Checkpoint answers" className="mt-3 flex flex-wrap gap-1.5">
              {clipTabs.map((c, i) => (
                <button
                  key={c.id}
                  role="tab"
                  type="button"
                  aria-selected={active === c.id}
                  aria-controls={`panel-${c.id}`}
                  onClick={() => setActive(c.id)}
                  className={cn("min-h-9 rounded-full border px-3 text-xs font-medium transition-colors", active === c.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                  data-testid={`tab-${c.id}`}
                >
                  {c.kind === "decision" ? `${KIND_LABEL.decision} ${i + 1}` : KIND_LABEL[c.kind]} · {c.mode}
                </button>
              ))}
            </div>
            {clipTabs.map((c) => (
              <div key={c.id} id={`panel-${c.id}`} role="tabpanel" hidden={active !== c.id} className="mt-3 space-y-2">
                <p className="text-sm font-medium">{c.question}</p>
                {hiddenClipIds.includes(c.id) && <p className="text-xs text-muted-foreground">The candidate hid this recording. The transcript is shown.</p>}
                <ClipPlayer
                  checkpoint={c}
                  highlight={lastJump?.checkpointId === c.id && lastJump.quote ? { t: lastJump.t, quote: lastJump.quote, n: lastJump.n } : undefined}
                  transcriptFirst={transcriptFirst}
                  ref={(h) => {
                    players.current[c.id] = h;
                  }}
                />
                {c.retakeUsed && <p className="text-xs text-muted-foreground">Retake used</p>}
              </div>
            ))}
          </section>
        )}

        <section aria-labelledby="dp-h" className="rounded-xl border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 id="dp-h" className="text-sm font-semibold">
              Decision path <span className="font-normal text-muted-foreground">· {card.decisionPath.length} choices</span>
            </h2>
            {(pathEdge.left || pathEdge.right) && (
              <div className="flex gap-1">
                <button type="button" aria-label="Scroll the decision path left" disabled={!pathEdge.left} onClick={() => scrollPath(-1)} className="inline-flex size-8 items-center justify-center rounded-full border bg-card text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40" data-testid="path-left">‹</button>
                <button type="button" aria-label="Scroll the decision path right" disabled={!pathEdge.right} onClick={() => scrollPath(1)} className="inline-flex size-8 items-center justify-center rounded-full border bg-card text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40" data-testid="path-right">›</button>
              </div>
            )}
          </div>
          <div className="relative">
          {pathEdge.left && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-card to-transparent" />}
          {pathEdge.right && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-card to-transparent" />}
          <ol ref={pathRef} onScroll={updatePathEdge} className="relative mt-3 flex items-start overflow-x-auto pb-2 [scrollbar-width:thin]" data-testid="decision-path">
            {card.decisionPath.map((d, i) => {
              const cp = d.checkpointId;
              return (
                <li key={`${d.nodeId}-${i}`} className={cn("flex items-start", i < card.decisionPath.length - 1 && "flex-1")}>
                  <div className="flex w-20 shrink-0 flex-col items-center text-center">
                    <button
                      type="button"
                      title={`${d.prompt}\nChoice: ${d.optionLabel}`}
                      aria-label={`Step ${i + 1}: ${d.optionLabel}${cp ? ", has a checkpoint answer" : ""}`}
                      disabled={!cp}
                      onClick={() => cp && jump(cp, 0)}
                      className={cn(
                        "size-4 rounded-full border-2",
                        cp ? "border-primary bg-primary ring-4 ring-accent" : "border-input bg-background",
                      )}
                      data-testid={cp ? `dot-${cp}` : undefined}
                    />
                    <span className="mt-1 line-clamp-3 text-[10px] leading-tight text-muted-foreground" title={d.optionLabel}>{d.optionLabel}</span>
                  </div>
                  {i < card.decisionPath.length - 1 &&
                    (i === card.turningPointAfter ? (
                      <div className="mt-1 flex flex-1 shrink-0 flex-col items-center px-1" data-testid="turning-point-marker">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-primary">Turning point</span>
                        <span aria-hidden className="mt-0.5 h-3 w-full min-w-8 border-t-2 border-dashed border-primary" />
                      </div>
                    ) : (
                      <span aria-hidden className="mt-2 h-px min-w-2 flex-1 bg-border" />
                    ))}
                </li>
              );
            })}
          </ol>
          </div>
        </section>

        {!!card.consistency?.length && (
          // Collapsed by default so the card still fits one laptop screen.
          <details aria-labelledby="svd-h" className="rounded-xl border bg-card px-4 py-3 shadow-card" data-testid="said-vs-did">
            <summary className="flex cursor-pointer items-baseline justify-between gap-2" data-testid="said-vs-did-toggle">
              <h2 id="svd-h" className="text-sm font-semibold">
                Said vs did{" "}
                <span className="font-normal text-muted-foreground">
                  · {card.consistency.length} comparison{card.consistency.length === 1 ? "" : "s"}
                  {card.consistency.some((c) => !c.consistent) ? `, ${card.consistency.filter((c) => !c.consistent).length} differ` : ", all match"}
                </span>
              </h2>
              <span className="text-xs text-muted-foreground">Context, not scored</span>
            </summary>
            <ul className="mt-2 space-y-2">
              {card.consistency.map((c, i) => (
                <li key={i} className="text-sm" data-testid={`svd-${c.kind}`} data-consistent={c.consistent}>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{CONSISTENCY_LABEL[c.kind]}</span>
                  <p>
                    <span className="text-muted-foreground">Said: </span>
                    {c.kind === "order" ? c.said : `“${c.said}”`}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Did: </span>
                    {c.did}
                  </p>
                  <p className="text-xs font-medium">{c.consistent ? "✓ Matches" : "≠ Differs, worth asking about"}</p>
                </li>
              ))}
            </ul>
          </details>
        )}

        {card.integrity.length > 0 && (
          <section aria-labelledby="int-h" className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground" data-testid="integrity">
            <h2 id="int-h" className="font-medium">Integrity notes · For context, not scored</h2>
            <ul className="mt-1 list-disc pl-4">
              {card.integrity.map((n, i) => (
                <li key={i}>{n.detail}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ResumeEvidence card={{ ...card, evidence }} onJump={jump} />
    </article>
  );
}
