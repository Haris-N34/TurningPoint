"use client";

import type { Card } from "@/lib/card/types";
import { BACKED, CLAIMED, NOT_YET_SHOWN, OBSERVED } from "@/lib/integrations/resume";
import { SKILLS } from "@/lib/engine/skills";
import { LevelBadge } from "./CapabilityCard";

// Resume vs Evidence (PRD v2 C4, C.7). Left: what the resume claims (redacted). Right: what the game observed.
// A line joins each backed claim to its evidence. Unbacked claims say "Not yet shown", never "false".

const name = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function ResumeEvidence({ card, onJump }: { card: Card; onJump: (checkpointId: string, t: number) => void }) {
  const r = card.resume;
  if (!r) return null;
  const linkedSkills = new Set(r.claims.flatMap((c) => (c.link ? [c.link.skill] : [])));
  const unclaimed = card.evidence.filter((e) => (e.level === "strong" || e.level === "some") && !linkedSkills.has(e.skill) && !r.claims.some((c) => c.skills.includes(e.skill)));
  return (
    <section aria-labelledby="rve-h" className="rounded-xl border bg-card p-4 shadow-card lg:col-span-2" data-testid="resume-vs-evidence">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rve-h" className="font-semibold">Resume vs Evidence</h2>
        <span className="text-xs text-muted-foreground">
          Resume {r.source === "ats" ? "from the ATS" : "uploaded by the candidate"} with consent. {r.redactions} identity and prestige details removed before analysis.
        </span>
      </div>
      <div className="mt-3 hidden grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
        <span>Resume: basic capabilities · {CLAIMED}</span>
        <span />
        <span>Game: evidence · {OBSERVED}</span>
      </div>
      <ul className="mt-2 space-y-3">
        {r.claims.map((c) => (
          <li key={c.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] sm:items-center" data-testid={`claim-${c.id}`} data-backed={c.backed}>
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="mr-1 rounded bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">{CLAIMED}</span>
              <span className="text-muted-foreground">{c.roleLabel}:</span> {c.text}
              {c.skills.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Claims: {c.skills.map(name).join(", ")}</p>}
            </div>
            <div className="hidden items-center sm:flex" aria-hidden>
              {c.backed ? <span className="h-0.5 w-full bg-primary" /> : <span className="h-0.5 w-full border-t-2 border-dashed border-border" />}
            </div>
            <div className="text-sm">
              {c.backed && c.link ? (
                <div className="rounded-lg border border-primary/40 px-3 py-2">
                  <p className="text-xs font-medium text-primary" data-testid="claim-status">
                    {BACKED} · {name(c.link.skill)}
                  </p>
                  {c.link.type === "clip" ? (
                    <button type="button" className="text-left underline underline-offset-2" onClick={() => c.link?.type === "clip" && onJump(c.link.checkpointId, c.link.startS)}>
                      “{c.link.quote}” · {mmss(c.link.startS)}
                    </button>
                  ) : c.link.type === "kpi" ? (
                    <p>In-game result: {c.link.label}</p>
                  ) : (
                    <p>Choice: “{c.link.optionLabel}”</p>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-2 text-muted-foreground" data-testid="claim-status">
                  {NOT_YET_SHOWN}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {unclaimed.length > 0 && (
        <div className="mt-4 border-t pt-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observed in the game, not on the resume</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unclaimed.map((e) => (
              <li key={e.skill} className="flex items-center gap-1">
                {name(e.skill)} <LevelBadge level={e.level} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
