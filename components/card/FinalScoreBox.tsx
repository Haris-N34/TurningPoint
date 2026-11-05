"use client";

import Link from "next/link";
import { useId } from "react";
import { SKILLS } from "@/lib/engine/skills";
import type { FinalScore } from "@/lib/scoring/score";

// Final score box (PRD v2 D.4). Sits top right of the card; the card still leads with evidence.
// Hover or keyboard focus shows the breakdown. The score sorts only and never filters anyone.

const name = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;
/** "Resilience (failing forward)" reads as "Resilience" in the compact inline breakdown. */
const shortName = (slug: string) => name(slug).replace(/\s*\(.*\)$/, "");
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function FinalScoreBox({ score }: { score: FinalScore }) {
  const id = useId();
  return (
    <div className="group relative" data-testid="final-score">
      <button
        type="button"
        aria-describedby={id}
        className="flex w-full flex-col gap-1.5 rounded-lg border bg-card px-3 py-2 text-left shadow-xs transition-colors hover:border-input/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
      >
        <span className="flex items-center gap-3">
          <span className="font-display text-2xl leading-none tabular-nums" data-testid="final-score-value">
            {score.value}
            <span className="text-sm text-muted-foreground">/100</span>
          </span>
          <span className="flex flex-col whitespace-nowrap leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Final score</span>
            <span className="text-xs font-medium text-foreground">Sorts only, never filters</span>
          </span>
        </span>
        {/* Always-visible breakdown (a projector has no hover). The full table is on focus or hover. */}
        <span className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] leading-tight text-muted-foreground" data-testid="final-score-inline">
          {score.breakdown.map((b) => (
            <span key={b.skill} className="flex items-center justify-between gap-2 whitespace-nowrap">
              <span>{shortName(b.skill)}</span>
              <span className="tabular-nums text-foreground">{b.combined} <span className="text-muted-foreground">· {pct(b.weight)}</span></span>
            </span>
          ))}
        </span>
      </button>
      <div
        id={id}
        role="tooltip"
        data-testid="final-score-breakdown"
        className="invisible absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border bg-popover p-3 text-left text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <p className="font-medium">
          {score.hasResume ? `Game ${pct(score.gameWeight)} · Resume ${pct(score.resumeWeight)}` : "Game only (no resume, no penalty)"}
        </p>
        <table className="mt-2 w-full">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-normal">Skill</th>
              <th className="text-right font-normal">Weight</th>
              <th className="text-right font-normal">Game</th>
              <th className="text-right font-normal">Resume</th>
              <th className="text-right font-normal">Skill score</th>
            </tr>
          </thead>
          <tbody>
            {score.breakdown.map((b) => (
              <tr key={b.skill}>
                <td>
                  {name(b.skill)} <span className="text-muted-foreground">({b.confidence} confidence)</span>
                </td>
                <td className="text-right">{pct(b.weight)}</td>
                <td className="text-right">{b.game ?? "–"}</td>
                <td className="text-right">{b.resume ?? "–"}</td>
                <td className="text-right font-medium">{b.combined}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-muted-foreground">
          Never used to hide or reject anyone. Formula version {score.configVersion}.{" "}
          <Link href="/how-scores-work" className="underline underline-offset-2">
            How scores work
          </Link>
        </p>
      </div>
    </div>
  );
}
