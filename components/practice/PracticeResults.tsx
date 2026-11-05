"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Card } from "@/lib/card/types";
import { PRACTICE_TTL_MS, practiceExpiresAt } from "@/lib/practice/practice";
import { media } from "@/lib/store/media";
import { store } from "@/lib/store/store";

const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * After a practice run (C8.1, C8.2): the candidate's answers with private feedback. No card, no levels,
 * no score, nothing shared. Deleted from this device 24 hours after the run started.
 */
export function PracticeResults({ card }: { card: Card }) {
  const router = useRouter();
  const run = store().getRun(card.attemptId);
  const expires = run ? practiceExpiresAt(run) : new Date(Date.parse(card.finishedAt) + PRACTICE_TTL_MS).toISOString();

  const deleteNow = async () => {
    store().deleteAttempt(card.attemptId);
    await media.deletePrefix(`${card.attemptId}/`).catch(() => {});
    router.push("/candidate");
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8" data-testid="practice-results">
      <header className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Practice run</p>
        <h1 className="mt-3 font-display text-3xl">Private feedback on your answers</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground" data-testid="practice-privacy">
          Nothing from this run was shared with any employer. It stays on this device and is deleted on {when(expires)} (24 hours after you started).
        </p>
      </header>

      <ol className="space-y-4">
        {card.checkpoints.map((c) => (
          <li key={c.id} className="rounded-2xl border bg-card p-5" data-testid={`practice-answer-${c.id}`}>
            <p className="text-sm font-medium">{c.question}</p>
            <blockquote className="mt-2 border-l-2 pl-3 text-sm text-muted-foreground">{c.transcript.text || "No answer recorded."}</blockquote>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Link href="/practice" className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 font-medium text-primary-foreground">
          Practice again
        </Link>
        <button onClick={deleteNow} className="inline-flex min-h-11 items-center rounded-md border px-5 font-medium" data-testid="practice-delete">
          Delete this practice run now
        </button>
      </div>
    </main>
  );
}
