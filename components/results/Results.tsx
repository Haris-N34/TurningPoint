"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CapabilityCard } from "@/components/card/CapabilityCard";
import type { Card } from "@/lib/card/types";
import { reportFinished } from "@/lib/integrations/client";
import { store } from "@/lib/store/store";
import { BadgeExport } from "./BadgeExport";
import { CandidateActions } from "./CandidateActions";
import { ResumeIntake } from "./ResumeIntake";

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

  if (card === undefined) return <div className="p-8" aria-busy="true">Loading…</div>;
  if (card === null) return <main className="mx-auto max-w-2xl p-6">No card found on this device.</main>;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-6 sm:px-10" data-testid="results">
      <p className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
        This is exactly what an employer sees. With anonymous review on, they see your candidate ID until they shortlist you. Employers also see a Final
        score that only sorts their list, weighted by the skills they care about.{" "}
        <Link href="/how-scores-work" className="underline underline-offset-2">
          How scores work
        </Link>
      </p>
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
      <CandidateActions card={card} onChange={setCard} />
    </main>
  );
}
