"use client";

import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LevelBadge, skillName } from "@/components/card/CapabilityCard";
import { Badge } from "@/components/ui/badge";
import { compareFor, type Comparison } from "@/lib/card/compare";
import { getChallenge } from "@/lib/challenge/challenge";
import type { SkillSlug } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";

const ROW_LABEL = { decision: "Checkpoint", real_life: "Real life", follow_up: "Follow-up" } as const;
const MODE_LABEL = { video: "Video", voice: "Voice", text: "Text" } as const;

// E4.1: 2 or 3 Capability Cards side by side. Evidence first, no overall score, no ranking.
export function Compare() {
  const params = useSearchParams();
  const challengeId = params.get("challenge") ?? "";
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const idsKey = ids.join(",");
  const [result, setResult] = useState<Comparison | null>(null);

  useEffect(() => {
    const refresh = () => {
      const s = store();
      const c = getChallenge(s, challengeId);
      const skills = (c?.targetSkills ?? []) as SkillSlug[];
      setResult(c ? compareFor(s, challengeId, idsKey.split(",").filter(Boolean), skills, c.anonymousReview) : { ok: false, reason: "This challenge was not found." });
    };
    refresh();
    // A candidate can withdraw while the recruiter is looking (from #53): re-check on storage changes and focus.
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [challengeId, idsKey]);

  const back = <BackLink href={`/recruiter?challenge=${challengeId}`}>Inbox</BackLink>;
  if (!result) return <div className="p-8" aria-busy="true">Loading…</div>;
  if (!result.ok)
    return (
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-3 sm:px-10" data-testid="compare-error">
        {back}
        <h1 className="mt-4 font-display text-3xl">Can&apos;t compare these cards</h1>
        <p className="mt-2 text-muted-foreground">{result.reason}</p>
      </main>
    );

  const { columns, rows } = result;
  // Fills the width on a laptop, scrolls inside its own box on a phone (never the page).
  const grid = { gridTemplateColumns: `minmax(6rem, 9rem) repeat(${columns.length}, minmax(13rem, 1fr))`, minWidth: `${6 + columns.length * 13}rem` };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12 pt-3 sm:px-10" data-testid="compare">
      {back}
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Compare</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight">{columns.length} Capability Cards, side by side</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Columns follow the order you picked. There is no overall score and no ranking. Read the evidence, then decide on each card.
      </p>

      <p className="mt-4 text-xs text-muted-foreground sm:hidden" data-testid="compare-scroll-hint">Scroll sideways to see all {columns.length} cards.</p>
      <div className="mt-2 overflow-x-auto sm:mt-6 rounded-xl border bg-card shadow-card" tabIndex={0} role="region" aria-label="Comparison">
        <div className="grid w-full text-sm" style={grid}>
          <div className="sticky left-0 z-10 border-b bg-card p-3" />
          {columns.map((c) => (
            <div key={c.attemptId} className="border-b border-l p-3" data-testid={`compare-col-${c.attemptId}`}>
              <h2 className="font-display text-lg leading-tight">{c.displayName}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {c.anonymous && <Badge variant="outline">Anonymous review</Badge>}
                {c.adjustedTiming && <Badge variant="outline">Adjusted timing</Badge>}
                <Badge variant="secondary">{c.witnessConfirmed ? "Witness confirmed" : "No witness yet"}</Badge>
              </div>
              <Link href={`/recruiter/card/${c.attemptId}?challenge=${challengeId}`} className="mt-2 inline-block text-xs underline underline-offset-2">
                Open full card
              </Link>
            </div>
          ))}

          <h3 className="col-span-full bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="sticky left-3">Skill evidence</span></h3>
          {columns[0].skills.map((sk, i) => (
            <div key={sk.skill} className="contents" data-testid={`compare-skill-${sk.skill}`}>
              <div className="sticky left-0 z-10 border-b bg-card p-3 font-medium">{skillName(sk.skill)}</div>
              {columns.map((c) => {
                const cell = c.skills[i];
                return (
                  <div key={c.attemptId} className="border-b border-l p-3">
                    <LevelBadge level={cell.level} />
                    {cell.quote && (
                      <a href={cell.checkpointId ? `#cmp-${c.attemptId}-${cell.checkpointId}` : undefined} className="mt-2 block border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground underline-offset-2 hover:underline" data-testid="compare-source">
                        &ldquo;{cell.quote}&rdquo;
                        {cell.startS !== undefined && ` · ${Math.floor(cell.startS / 60)}:${String(Math.floor(cell.startS % 60)).padStart(2, "0")}`}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <h3 className="col-span-full bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="sticky left-3">Answers to the same checkpoint</span></h3>
          {rows.map((row, idx) => {
            const n = rows.slice(0, idx + 1).filter((r) => r.kind === row.kind).length;
            const many = rows.filter((r) => r.kind === row.kind).length > 1;
            return (
              <div key={`${row.kind}-${row.slot}`} className="contents" data-testid={`compare-row-${row.kind}-${row.slot}`}>
                <div className="sticky left-0 z-10 border-b bg-card p-3 font-medium">{ROW_LABEL[row.kind]}{many ? ` ${n}` : ""}</div>
                {row.answers.map((a, j) => (
                  <div key={columns[j].attemptId} id={a ? `cmp-${columns[j].attemptId}-${a.checkpointId}` : undefined} className="scroll-mt-6 border-b border-l p-3">
                    {a ? (
                      <>
                        <p className="text-xs text-muted-foreground">{a.question}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{MODE_LABEL[a.mode]} answer · transcript{a.hidden ? " · recording hidden by candidate" : ""}</p>
                        <p className="mt-2 leading-relaxed">{a.ready ? a.text || "No transcript text recorded." : "Transcript pending or unavailable."}</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No answer of this type</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Not observed is not a negative judgment. Levels come only from what candidates said and chose.</p>
    </main>
  );
}
