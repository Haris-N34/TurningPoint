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
    <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10" data-testid="admin-home">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Employer admin</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl">Your challenges</h1>
        <div className="flex flex-wrap gap-2">
          {!list.length && (
            <Button variant="outline" onClick={() => { seedDemo(store()); refresh(); }}>Load demo data</Button>
          )}
          <Button variant="outline" asChild><Link href="/admin/impact">Impact report</Link></Button>
          <Button asChild><Link href="/admin/new">New challenge</Link></Button>
          <Button asChild variant="outline"><Link href="/admin/ai-health">AI health</Link></Button>
          <Button asChild variant="outline"><Link href="/admin/gold">Score gold set</Link></Button>
        </div>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {list.map((c) => (
          <li key={c.id} className="rounded-xl border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{c.company.name}</p>
            <p className="mt-1 font-medium">{c.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.status === "published" ? `Published · ${c.jobCode}` : "Draft"}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {c.status === "published" && <Link className="underline" href={`/recruiter?challenge=${c.id}`}>Inbox</Link>}
              {c.status === "published" && <Link className="underline" href={`/c/${c.publicSlug}`}>Candidate link</Link>}
              <Link className="underline" href={`/admin/preview/${c.id}`}>Preview</Link>
            </div>
          </li>
        ))}
        {!list.length && <li className="text-muted-foreground">No challenges yet. Create one in about 10 minutes.</li>}
      </ul>
    </main>
  );
}
