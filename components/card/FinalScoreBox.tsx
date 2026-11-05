"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { SKILLS } from "@/lib/engine/skills";
import type { FinalScore } from "@/lib/scoring/score";

// Final score box (PRD v2 D.4). Sits top right of the card; the card still leads with evidence.
// The inline rows always show the breakdown; hover or keyboard focus opens the full table. The table opens
// below the box on a laptop and above it on a phone, so it never covers Shortlist, Hold or Pass. It closes on
// mouse leave, blur and Escape. The score sorts only and never filters anyone.

const name = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;
/** "Resilience (failing forward)" reads as "Resilience" in the compact inline breakdown. */
const shortName = (slug: string) => name(slug).replace(/\s*\(.*\)$/, "");
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function FinalScoreBox({ score }: { score: FinalScore }) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  // A mouse click focuses the button too; only keyboard (or scripted) focus keeps the table open.
  const pointer = useRef(false);
  const open = hover || focus;
  return (
    <div
      className="relative"
      data-testid="final-score"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      // Tabbing from the button into the table's link keeps it open; leaving the box closes it.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setHover(false);
          setFocus(false);
        }
      }}
    >
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onPointerDown={() => (pointer.current = true)}
        onFocus={() => {
          setFocus(!pointer.current);
          pointer.current = false;
        }}

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
        hidden={!open}
        className="absolute bottom-full right-0 z-30 mb-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-popover p-3 text-left text-xs text-popover-foreground shadow-lg lg:bottom-auto lg:top-full lg:mb-0 lg:mt-2"
      >
        <p className="font-medium">
          {score.hasResume ? `Game ${pct(score.gameWeight)} · Resume ${pct(score.resumeWeight)}` : "Game only (no resume, no penalty)"}
        </p>
        <table className="mt-2 w-full">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-normal">Skill</th>
              <th className="text-left font-normal">Confidence</th>
              <th className="text-right font-normal">Weight</th>
              <th className="text-right font-normal">Game</th>
              <th className="text-right font-normal">Resume</th>
              <th className="text-right font-normal">Skill score</th>
            </tr>
          </thead>
          <tbody>
            {score.breakdown.map((b) => (
              <tr key={b.skill}>
                <td className="py-0.5 pr-2">{shortName(b.skill)}</td>
                <td className="py-0.5 pr-2 capitalize text-muted-foreground">{b.confidence}</td>
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
