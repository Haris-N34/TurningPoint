"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CapabilityCard } from "@/components/card/CapabilityCard";
import type { Card } from "@/lib/card/types";
import { store } from "@/lib/store/store";
import { CandidateActions } from "./CandidateActions";

// Candidate's results (C7): their own card exactly as an employer sees it, plus their controls.
export function Results({ attemptId }: { attemptId: string }) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  useEffect(() => setCard(store().getCard(attemptId) ?? null), [attemptId]);

  if (card === undefined) return <PageSkeleton />;
  if (card === null) return <main className="mx-auto max-w-2xl px-6 py-16"><span aria-hidden="true" className="text-5xl text-primary">↗</span><h1 className="mt-6 font-display text-4xl">Your card is not on this device</h1><p className="mt-4 text-muted-foreground">Results stay in the browser where you completed the challenge. Return to that browser, or start a new challenge here.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-5 font-medium text-primary-foreground" href="/candidate">Explore challenges</Link></main>;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-6 sm:px-10" data-testid="results">
      <header className="border-b pb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your evidence / Your control</p><p className="mt-3 max-w-3xl font-display text-3xl">A record of the choices you made.</p><p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">This card uses the same evidence view employers see. With anonymous review on, they see your candidate ID until they shortlist you. Manage recordings, witnesses and employer access below.</p></header>
      <CapabilityCard
        card={card}
        identity={{ displayName: card.candidate.displayName || card.anonId, university: card.candidate.university, anonymous: false }}
        hiddenClipIds={card.checkpoints.filter((c) => c.hidden).map((c) => c.id)}
      />
      <CandidateActions card={card} onChange={setCard} />
    </main>
  );
}
