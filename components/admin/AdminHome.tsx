"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listChallenges, type Challenge } from "@/lib/challenge/challenge";
import { seedDemo } from "@/lib/demo/seed";
import { store } from "@/lib/store/store";

// Employer admin home: challenges, and the way into the builder.
export function AdminHome() {
  const [list, setList] = useState<Challenge[] | null>(null);
  const refresh = () => setList(listChallenges(store()));
  useEffect(refresh, []);
  if (!list) return <PageSkeleton />;
  return (
    <main className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-10" data-testid="admin-home">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Employer admin</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">Your challenges</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!list.length && (
            <Button variant="outline" size="sm" onClick={() => { seedDemo(store()); refresh(); }}>Load demo data</Button>
          )}
          <nav aria-label="Admin tools" className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" asChild><Link href="/admin/impact">Impact report</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/admin/ai-health">AI health</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/admin/gold">Score gold set</Link></Button>
          </nav>
          <Button asChild size="sm"><Link href="/admin/new">New challenge</Link></Button>
        </div>
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {list.map((c) => (
          <li key={c.id} className="flex flex-col rounded-xl border bg-card shadow-card">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{c.company.name}</p>
                <p className="mt-1 font-medium">{c.title}</p>
              </div>
              <span className={c.status === "published" ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground" : "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"}>
                {c.status === "published" ? "Published" : "Draft"}
              </span>
            </div>
            <p className="px-5 pt-1 text-xs text-muted-foreground">{c.status === "published" ? `Job code ${c.jobCode}` : "Not visible to candidates yet"}</p>
            <div className="mt-4 flex flex-wrap gap-1 border-t border-border/70 px-3 py-2">
              {c.status === "published" && <Button asChild variant="ghost" size="sm"><Link href={`/recruiter?challenge=${c.id}`}>Inbox</Link></Button>}
              {c.status === "published" && <Button asChild variant="ghost" size="sm"><Link href={`/c/${c.publicSlug}`}>Candidate link</Link></Button>}
              <Button asChild variant="ghost" size="sm"><Link href={`/admin/preview/${c.id}`}>Preview</Link></Button>
            </div>
          </li>
        ))}
        {!list.length && <li className="text-muted-foreground">No challenges yet. Setup takes under 10 minutes.</li>}
      </ul>
    </main>
  );
}
