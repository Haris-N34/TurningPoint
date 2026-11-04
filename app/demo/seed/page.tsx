"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Challenge } from "@/lib/challenge/challenge";
import { seedDemo } from "@/lib/demo/seed";
import { store } from "@/lib/store/store";

// Loads demo employers and Maya's card into this browser. Demo-only helper.
export default function SeedPage() {
  const [list, setList] = useState<Challenge[]>([]);
  useEffect(() => setList(seedDemo(store())), []);
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-10" data-testid="seeded">
      <h1 className="text-2xl font-semibold">Demo data loaded</h1>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id} className="rounded-xl border p-3">
            <p className="font-medium">{c.company.name}</p>
            <p className="text-sm opacity-80">{c.title} · {c.jobCode}</p>
            <Link className="text-sm underline" href={`/c/${c.publicSlug}`} data-testid={`play-${c.id}`}>
              Candidate link
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
