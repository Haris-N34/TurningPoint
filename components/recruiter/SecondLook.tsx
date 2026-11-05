"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { integrationsApi } from "@/lib/integrations/client";
import type { SecondLookEntry } from "@/lib/integrations/store";

// Second Look (PRD v2 C3, C.11). The queue sits at the top of the inbox; decisions happen on the card,
// after the recruiter has opened it. Nobody is ever removed from consideration.

type Resp = { entries: SecondLookEntry[]; stats: { queued: number; rescued: number; confirmedPass: number } };

export function useSecondLook(challengeId: string | undefined) {
  const [data, setData] = useState<Resp | null>(null);
  const load = useCallback(() => {
    if (!challengeId) return;
    integrationsApi<Resp>(`second-look?challenge=${encodeURIComponent(challengeId)}`)
      .then(setData)
      .catch(() => setData(null));
  }, [challengeId]);
  useEffect(load, [load]);
  return { data, reload: load };
}

export function SecondLookQueue({ challengeId, nameFor }: { challengeId?: string; nameFor: (attemptId: string) => string | undefined }) {
  const { data } = useSecondLook(challengeId);
  const queued = data?.entries.filter((e) => e.status === "queued") ?? [];
  if (!data || (!queued.length && !data.stats.rescued)) return null;
  return (
    <section aria-labelledby="sl-h" className="mt-6 rounded-xl border-2 border-primary/40 bg-card p-4 shadow-card" data-testid="second-look-queue">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sl-h" className="font-semibold">
          Second Look <span className="text-sm font-normal text-muted-foreground">· {queued.length} to review</span>
        </h2>
        <p className="text-xs text-muted-foreground" data-testid="second-look-rescued">
          Candidates rescued by Second Look this season: {data.stats.rescued}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Your ATS rejected or never reviewed these candidates, but their evidence is Strong in 2 or more of your skills. Open the card to decide.</p>
      {queued.length > 0 && (
        <ul className="mt-3 space-y-2">
          {queued.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm" data-testid={`second-look-${e.attemptId}`}>
              <span>
                <span className="font-medium">{nameFor(e.attemptId) ?? "Candidate"}</span> · {e.reason}
              </span>
              <Button asChild size="sm">
                <Link href={`/recruiter/card/${e.attemptId}?challenge=${e.challengeId}`}>Open card</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** On the card: mark it opened, then Restore or Confirm pass (a pass needs a reason). */
export function SecondLookPanel({ attemptId, challengeId }: { attemptId: string; challengeId: string }) {
  const { data, reload } = useSecondLook(challengeId);
  const entry = data?.entries.find((e) => e.attemptId === attemptId && e.status === "queued");
  const done = data?.entries.find((e) => e.attemptId === attemptId && e.status !== "queued");
  const [opened, setOpened] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const entryId = entry?.id;
  useEffect(() => {
    if (!entryId) return;
    integrationsApi(`second-look/${entryId}/open`, {})
      .then(() => setOpened(true))
      .catch(() => undefined);
  }, [entryId]);

  if (!entry && !done) return null;
  if (!entry && done)
    return (
      <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm" data-testid="second-look-done">
        Second Look: {done.status === "restored" ? "restored to consideration" : "pass confirmed"}
        {done.decisionReason ? ` (${done.decisionReason})` : ""}.
      </p>
    );

  const decide = async (decision: "restore" | "confirm_pass") => {
    setError(null);
    try {
      await integrationsApi(`second-look/${entry!.id}/decide`, { decision, reason });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };
  return (
    <section aria-labelledby="slp-h" className="mb-3 rounded-xl border-2 border-primary/40 p-3 text-sm" data-testid="second-look-panel">
      <h2 id="slp-h" className="font-semibold">Second Look</h2>
      <p className="mt-1">{entry!.reason}.</p>
      <label htmlFor="sl-reason" className="mt-2 block font-medium">
        Reason (required to confirm a pass)
      </label>
      <input id="sl-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2" data-testid="second-look-reason" />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={() => decide("restore")} disabled={!opened} data-testid="second-look-restore">
          Restore
        </Button>
        <Button variant="outline" onClick={() => decide("confirm_pass")} disabled={!opened || !reason.trim()} data-testid="second-look-confirm">
          Confirm pass
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
