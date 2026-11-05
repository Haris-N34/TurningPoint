"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CapabilityCard } from "@/components/card/CapabilityCard";
import { Button } from "@/components/ui/button";
import { Copilot } from "./Copilot";
import { cardFor, decide, type RecruiterCardView } from "@/lib/card/recruiter";
import { PASS_REASONS } from "@/lib/card/types";
import { getChallenge, type Challenge } from "@/lib/challenge/challenge";
import { store } from "@/lib/store/store";

// Recruiter's card screen (E3) with Shortlist, Hold, Pass (E3.7). A human makes every call.
export function RecruiterCard({ attemptId }: { attemptId: string }) {
  const challengeId = useSearchParams().get("challenge") ?? "";
  const [view, setView] = useState<RecruiterCardView | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<Challenge>();
  const [decision, setDecision] = useState<string>();
  const [passing, setPassing] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seekTo, setSeekTo] = useState<{ checkpointId: string; t: number; n: number }>();

  const load = () => {
    const s = store();
    const c = getChallenge(s, challengeId);
    setChallenge(c);
    setView(cardFor(s, attemptId, challengeId, c?.anonymousReview ?? true) ?? null);
    setDecision(s.reviewFor(attemptId, challengeId)?.decision);
  };
  useEffect(load, [attemptId, challengeId]);

  if (view === undefined) return <div className="p-8" aria-busy="true">Loading…</div>;
  const back = (
    <Button asChild variant="link" className="px-0">
      <Link href={`/recruiter?challenge=${challengeId}`}>← Inbox</Link>
    </Button>
  );
  if (view === null) return <main className="mx-auto max-w-3xl p-6">{back}<p>This card isn&apos;t shared with this challenge.</p></main>;
  if (view.status === "withdrawn")
    return (
      <main className="mx-auto max-w-3xl p-6" data-testid="withdrawn">
        {back}
        <h1 className="mt-4 font-display text-3xl">Candidate withdrew this card</h1>
        <p className="mt-2 text-muted-foreground">They chose to stop sharing it with you. Nothing from it is shown.</p>
      </main>
    );

  const act = (d: "shortlist" | "hold" | "pass") => {
    setError(null);
    try {
      decide(store(), attemptId, challengeId, d, d === "pass" ? reason : undefined, note || undefined);
      setPassing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const share = store().sharesFor(challengeId).find((x) => x.attemptId === attemptId);
  const covers = challenge ? challenge.targetSkills.filter((s) => view.card.targetSkills.includes(s)) : [];

  const actions = (
    <div className="w-full max-w-sm space-y-2 sm:w-auto" data-testid="review-actions">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => act("shortlist")} aria-pressed={decision === "shortlist"}>Shortlist</Button>
        <Button variant="outline" onClick={() => act("hold")} aria-pressed={decision === "hold"}>Hold</Button>
        <Button variant="outline" onClick={() => setPassing((p) => !p)} aria-pressed={decision === "pass"} aria-expanded={passing}>Pass</Button>
      </div>
      {decision && <p className="text-sm" data-testid="decision">Your decision: <span className="font-medium capitalize">{decision === "shortlist" ? "Shortlisted" : decision}</span></p>}
      {passing && (
        <form
          className="space-y-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            act("pass");
          }}
        >
          <label htmlFor="pass-reason" className="text-sm font-medium">Reason (required)</label>
          <select id="pass-reason" required value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Choose a reason</option>
            {PASS_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <label htmlFor="pass-note" className="text-sm font-medium">Note (optional)</label>
          <input id="pass-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm" />
          <Button type="submit" variant="destructive" disabled={!reason}>Confirm pass</Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-3 sm:px-10">
      {back}
      <div>
        <CapabilityCard
          card={view.card}
          identity={view.name}
          transcriptFirst={challenge?.transcriptFirst}
          hiddenClipIds={view.hiddenClipIds}
          reused={share?.reused ? { covers } : undefined}
          actions={actions}
          seekTo={seekTo}
        />
      </div>
      <Copilot card={view.card} onCite={(c) => setSeekTo((p) => ({ ...c, n: (p?.n ?? 0) + 1 }))} />
    </main>
  );
}
