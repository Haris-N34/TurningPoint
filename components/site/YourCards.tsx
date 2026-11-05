"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Card } from "@/lib/card/types";
import { store } from "@/lib/store/store";
import { isPeer } from "@/lib/demo/peers";
import { DEMO_PREFIX } from "@/lib/impact/metrics";

// Candidate home: the cards finished on this device, newest first. Hidden when there are none.
export function YourCards() {
  const [cards, setCards] = useState<Card[]>([]);
  useEffect(() => {
    // Synthetic demo candidates are recruiter-side scenery, never "your" cards.
    setCards(store().listCards().filter((c) => !isPeer(c.attemptId) && !c.attemptId.startsWith(DEMO_PREFIX)).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 3));
  }, []);
  if (!cards.length) return null;
  return (
    <section aria-labelledby="your-cards-h" className="rounded-xl border bg-card p-5 shadow-card" data-testid="your-cards">
      <h2 id="your-cards-h" className="text-sm font-semibold">Your Capability Cards</h2>
      <p className="mt-1 text-xs text-muted-foreground">Stored in this browser. You choose who sees them.</p>
      <ul className="mt-3 divide-y divide-border/70">
        {cards.map((c) => (
          <li key={c.attemptId}>
            <Link href={`/results/${c.attemptId}`} className="group flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.challenge.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{c.challenge.company} · {new Date(c.finishedAt).toLocaleDateString("en-CA")}</span>
              </span>
              <span aria-hidden className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
