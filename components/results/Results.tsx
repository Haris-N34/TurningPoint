"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { CapabilityCard } from "@/components/card/CapabilityCard";
import type { Card } from "@/lib/card/types";
import { reportFinished } from "@/lib/integrations/client";
import { store } from "@/lib/store/store";
import { BadgeExport } from "./BadgeExport";
import { CandidateActions } from "./CandidateActions";
import { ResumeIntake } from "./ResumeIntake";
import { LearningSurvey } from "./LearningSurvey";
import { PracticeResults } from "@/components/practice/PracticeResults";
import { isPracticeChallenge } from "@/lib/practice/practice";

// Candidate's results (C7): their own card exactly as an employer sees it, plus their controls.
export function Results({ attemptId }: { attemptId: string }) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => setCard(store().getCard(attemptId) ?? null), [attemptId]);

  // Send the evidence summary to the employer's ATS once, if the candidate came through an invite (C.3).
  const loaded = !!card;
  useEffect(() => {
    if (!loaded) return;
    const c = store().getCard(attemptId);
    if (!c) return;
    reportFinished(c)
      .then((r) => r?.delivery && setSent(r.delivery.status === "delivered" ? "Your results were sent to the employer's hiring system." : "Sending to the employer's hiring system is being retried."))
      .catch(() => undefined);
  }, [loaded, attemptId]);

  if (card === undefined) return <PageSkeleton />;
  if (card === null) return <main className="mx-auto max-w-2xl px-6 py-16"><span aria-hidden="true" className="text-5xl text-primary">↗</span><h1 className="mt-6 font-display text-4xl">Your card is not on this device</h1><p className="mt-4 text-muted-foreground">Results stay in the browser where you completed the challenge. Return to that browser, or start a new challenge here.</p><Button asChild className="mt-6"><Link href="/candidate">Explore challenges</Link></Button></main>;

  // A practice run has no card to share: show its private feedback instead (C8.1, C8.2).
  if (isPracticeChallenge(card.challenge.id)) return <PracticeResults card={card} />;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 pb-12 pt-6 sm:px-10" data-testid="results">
      <header className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Your results</p>
          <p className="mt-1 font-display text-xl leading-snug">A record of the choices you made.</p>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Employers see this same card, with your candidate ID until they shortlist you, plus a Final score that only sorts their list and never rejects anyone.{" "}
          <Link href="/how-scores-work" className="whitespace-nowrap font-medium text-foreground underline underline-offset-2">How scores work</Link>
        </p>
      </header>
      {sent && (
        <p role="status" className="text-sm" data-testid="ats-sent">
          {sent}
        </p>
      )}
      <CapabilityCard
        card={card}
        identity={{ displayName: card.candidate.displayName || card.anonId, university: card.candidate.university, anonymous: false }}
        hiddenClipIds={card.checkpoints.filter((c) => c.hidden).map((c) => c.id)}
        showFinalScore={false}
      />
      <ResumeIntake card={card} onChange={setCard} />
      <BadgeExport card={card} />
      <LearningSurvey attemptId={card.attemptId} />
      <CandidateActions card={card} onChange={setCard} />
    </main>
  );
}
