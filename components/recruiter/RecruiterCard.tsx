"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/ui/back-link";
import { useSearchParams } from "next/navigation";
import { AddonRequest } from "@/components/addon/AddonRequest";
import type { SkillSlug } from "@/lib/engine/skills";
import { useEffect, useRef, useState } from "react";
import { CapabilityCard } from "@/components/card/CapabilityCard";
import { Button } from "@/components/ui/button";
import { Copilot, CopilotButton } from "./Copilot";
import { cardFor, decide, type RecruiterCardView } from "@/lib/card/recruiter";
import { PASS_REASONS } from "@/lib/card/types";
import { getChallenge, type Challenge } from "@/lib/challenge/challenge";
import { store } from "@/lib/store/store";
import { SecondLookPanel } from "./SecondLook";
import { useReviewTimer } from "@/lib/impact/useReviewTimer";

// Recruiter's card screen (E3) with Shortlist, Hold, Pass (E3.7). A human makes every call.
export function RecruiterCard({ attemptId }: { attemptId: string }) {
  const challengeId = useSearchParams().get("challenge") ?? "";
  const [view, setView] = useState<RecruiterCardView | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<Challenge>();
  const [decision, setDecision] = useState<string>();
  const [passing, setPassing] = useState(false);
  const passBtn = useRef<HTMLButtonElement | null>(null);
  const passForm = useRef<HTMLFormElement | null>(null);
  // The Pass reason form closes on Escape or a click outside it, and focus goes back to Pass.
  useEffect(() => {
    if (!passing) return;
    const close = () => {
      setPassing(false);
      passBtn.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!passForm.current?.contains(t) && !passBtn.current?.contains(t)) setPassing(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [passing]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [seekTo, setSeekTo] = useState<{ checkpointId: string; t: number; n: number }>();

  const load = () => {
    const s = store();
    const c = getChallenge(s, challengeId);
    setChallenge(c);
    setView(cardFor(s, attemptId, challengeId, c?.anonymousReview ?? true) ?? null);
    setDecision(s.reviewFor(attemptId, challengeId)?.decision);
  };
  useEffect(load, [attemptId, challengeId]);
  // Visible reading time for the impact dashboard's recruiter minutes (G.1). No content is recorded.
  useReviewTimer(attemptId, challengeId, !!view && view.status !== "withdrawn");

  if (view === undefined) return <PageSkeleton />;
  const back = <BackLink href={`/recruiter?challenge=${challengeId}`}>Inbox</BackLink>;
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
    <div className="relative w-full sm:w-auto" data-testid="review-actions">
      <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
        <Button onClick={() => act("shortlist")} aria-pressed={decision === "shortlist"} className="aria-pressed:ring-2 aria-pressed:ring-primary/30">Shortlist</Button>
        <Button variant="outline" onClick={() => act("hold")} aria-pressed={decision === "hold"} className="aria-pressed:border-foreground">Hold</Button>
        <Button ref={passBtn} variant="outline" onClick={() => setPassing((p) => !p)} aria-pressed={decision === "pass"} aria-expanded={passing} aria-controls="pass-form" className="aria-pressed:border-foreground">Pass</Button>
      </div>
      {decision && !passing && <p className="mt-1.5 text-xs text-muted-foreground lg:absolute lg:right-0 lg:top-full lg:whitespace-nowrap" data-testid="decision">Your decision: <span className="font-medium capitalize text-foreground">{decision === "shortlist" ? "Shortlisted" : decision}</span></p>}
      {passing && (
        <form
          id="pass-form"
          ref={passForm}
          className="tp-pop mt-2 w-full space-y-2 rounded-xl border bg-card p-3 shadow-card sm:w-80"
          onSubmit={(e) => {
            e.preventDefault();
            act("pass");
          }}
        >
          <label htmlFor="pass-reason" className="block text-sm font-medium">Reason (required)</label>
          <select id="pass-reason" required value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background px-2 text-sm">
            <option value="">Choose a reason</option>
            {PASS_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <label htmlFor="pass-note" className="block text-sm font-medium">Note (optional)</label>
          <input id="pass-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background px-2 text-sm" />
          <Button type="submit" variant="destructive" disabled={!reason} className="w-full">Confirm pass</Button>
        </form>
      )}
      {error && <p role="alert" className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 pb-6 pt-3 sm:px-10">
      <div className="mb-2 flex items-center justify-between gap-2">
        {back}
        <CopilotButton open={askOpen} onClick={() => setAskOpen((o) => !o)} />
      </div>
      <Copilot card={view.card} open={askOpen} onClose={() => setAskOpen(false)} onCite={(c) => setSeekTo((p) => ({ ...c, n: (p?.n ?? 0) + 1 }))} />
      <SecondLookPanel attemptId={attemptId} challengeId={challengeId} />
      <div>
        <CapabilityCard
          card={view.card}
          identity={view.name}
          transcriptFirst={challenge?.transcriptFirst}
          hiddenClipIds={view.hiddenClipIds}
          reused={share?.reused ? { covers } : undefined}
          actions={actions}
          seekTo={seekTo}
          footer={<p className="pt-1 text-center text-xs text-muted-foreground" data-testid="pitch-line">Turning Point tests how you handle it when the plan breaks.</p>}
        />
      </div>
      {share?.reused && challenge && <AddonRequest attemptId={attemptId} challengeId={challengeId} employerSkills={challenge.targetSkills as SkillSlug[]} cardSkills={view.card.targetSkills} />}
    </main>
  );
}
