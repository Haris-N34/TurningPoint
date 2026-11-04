"use client";

import { useEffect, useState } from "react";
import type { CardCheckpoint } from "@/lib/card/types";
import { store, type SavedRun } from "@/lib/store/store";

// Basic results view (M2: transcripts visible right after the run). Haris owns the final layout (#19);
// M3 replaces the body with the candidate's own Capability Card.
export function Results({ attemptId }: { attemptId: string }) {
  const [run, setRun] = useState<SavedRun | null | undefined>(undefined);
  useEffect(() => setRun(store().getRun(attemptId) ?? null), [attemptId]);

  if (run === undefined) return <div className="p-8" aria-busy="true">Loading…</div>;
  if (run === null) return <main className="mx-auto max-w-2xl p-6">No run found on this device.</main>;

  const extra = run.extra as { answers?: CardCheckpoint[]; realStory?: { title: string } };
  const answers = extra.answers ?? [];
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8" data-testid="results">
      <h1 className="text-2xl font-semibold">Your answers</h1>
      {extra.realStory && (
        <p className="text-lg">
          Your turning point: <span className="font-medium">“{extra.realStory.title}”</span>
        </p>
      )}
      <ol className="space-y-4">
        {answers.map((a) => (
          <li key={a.id} className="rounded-2xl border p-4" data-testid={`answer-${a.id}`}>
            <p className="text-xs uppercase tracking-wide opacity-60">
              {a.kind === "decision" ? "Checkpoint" : a.kind === "real_life" ? "Real life" : "Follow-up"} · {a.mode}
              {a.retakeUsed ? " · retake used" : ""}
            </p>
            <p className="mt-1 font-medium">{a.question}</p>
            <p className="mt-2 opacity-90">{a.transcript.text || <em>Transcript unavailable on this browser. The recording is saved.</em>}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
