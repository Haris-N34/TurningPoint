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

  const jump = (checkpointId: string, t: number) => {
    setActive(checkpointId);
    // Let the tab render before seeking.
    setTimeout(() => players.current[checkpointId]?.seek(t), 0);
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
      <header className="flex flex-wrap items-start justify-between gap-3 lg:col-span-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Capability Card</p>
          <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl" data-testid="card-name">
            {identity.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {card.challenge.company} · {card.challenge.title} · {new Date(card.finishedAt).toLocaleDateString("en-CA")}
            {identity.university && !identity.anonymous ? ` · ${identity.university}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {card.candidate.verified && <Badge variant="secondary">Verified student</Badge>}
            {card.adjustedTiming && <Badge variant="outline">Adjusted timing</Badge>}
            {identity.anonymous && <Badge variant="outline">Anonymous review</Badge>}
            {reused && (
              <Badge variant="outline" data-testid="reused-badge">
                Reused from a previous challenge, skills: {reused.covers.map(skillName).join(", ") || "none of yours"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {showFinalScore && <FinalScoreBox score={final} />}
          {actions}
        </div>
      </header>

      <div className="space-y-4">
        <section aria-labelledby="ev-h" className="rounded-xl border bg-card p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 id="ev-h" className="font-semibold">Skill evidence</h2>
            <span className="text-xs text-muted-foreground">Evidence first</span>
          </div>
          <ul className="mt-3 space-y-3" data-testid="evidence">
            {evidence.map((e) => (
              <li key={e.skill} data-testid={`evidence-${e.skill}`} data-level={e.level}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{skillName(e.skill)}</span>
                  <LevelBadge level={e.level} />
                </div>
                {e.sentence && e.source && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="mr-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground">AI summary</span>
                    {e.sentence}{" "}
                    {e.source.type === "clip" ? (
                      <button
                        type="button"
                        className="text-left text-foreground underline underline-offset-2"
                        data-testid={`jump-${e.skill}`}
                        onClick={() => {
                          const s = e.source as { checkpointId: string; startS: number };
                          jump(s.checkpointId, s.startS);
                        }}
                      >
                        “{e.source.quote}” · {mmss(e.source.startS)}
                      </button>
                    ) : (
                      <span className="text-foreground">Choice: “{e.source.optionLabel}”</span>
                    )}
                  </p>
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
              <p className="mt-1 line-clamp-2 text-sm">
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
        <section aria-labelledby="dp-h" className="rounded-xl border bg-card p-4 shadow-card">
          <h2 id="dp-h" className="font-semibold">Decision path</h2>
          <ol className="mt-4 flex items-start overflow-x-auto pb-2" data-testid="decision-path">
            {card.decisionPath.map((d, i) => {
              const cp = d.checkpointId;
              return (
                <li key={`${d.nodeId}-${i}`} className="flex items-start">
                  <div className="flex w-14 shrink-0 flex-col items-center text-center">
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
                    <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">{d.optionLabel}</span>
                  </div>
                  {i < card.decisionPath.length - 1 &&
                    (i === card.turningPointAfter ? (
                      <div className="mt-1 flex shrink-0 flex-col items-center px-1" data-testid="turning-point-marker">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Turning point</span>
                        <span aria-hidden className="mt-0.5 h-3 w-8 border-t-2 border-dashed border-primary" />
                      </div>
                    ) : (
                      <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-border" />
                    ))}
                </li>
              );
            })}
          </ol>
        </section>

        {clipTabs.length > 0 && (
          <section aria-labelledby="clips-h" className="rounded-xl border bg-card p-4 shadow-card">
            <h2 id="clips-h" className="font-semibold">Answers</h2>
            <div role="tablist" aria-label="Checkpoint answers" className="mt-3 flex flex-wrap gap-2">
              {clipTabs.map((c, i) => (
                <button
                  key={c.id}
                  role="tab"
                  type="button"
                  aria-selected={active === c.id}
                  aria-controls={`panel-${c.id}`}
                  onClick={() => setActive(c.id)}
                  className={cn("min-h-9 rounded-full border px-3 text-xs font-medium", active === c.id && "bg-foreground text-background")}
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
