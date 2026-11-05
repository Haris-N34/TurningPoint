"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Challenge } from "@/lib/challenge/challenge";
import { seedDemo } from "@/lib/demo/seed";
import { store } from "@/lib/store/store";

// Loads demo employers and Maya's card into this browser. Demo-only helper.
export default function SeedPage() {
  // null until seedDemo has stored everything; tests wait on data-testid="seeded", so it appears only then.
  const [list, setList] = useState<Challenge[] | null>(null);
  useEffect(() => setList(seedDemo(store())), []);
  if (!list) return <main className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground" aria-busy="true">Loading demo data…</main>;
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-10" data-testid="seeded" data-done="1">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Demo</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Demo data loaded</h1>
        <p className="mt-1 text-sm text-muted-foreground">Two fictional employers, Maya&apos;s card and a few labelled synthetic candidates, stored in this browser.</p>
      </div>
      <ul className="divide-y divide-border/70 rounded-xl border bg-card shadow-card">
        {list.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{c.company.name}</p>
              <p className="text-sm text-muted-foreground">{c.title} · {c.jobCode}</p>
            </div>
            <Link className="shrink-0 text-sm font-medium underline underline-offset-2" href={`/c/${c.publicSlug}`} data-testid={`play-${c.id}`}>
              Candidate link
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
