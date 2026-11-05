"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resetThisBrowser } from "@/components/demo/DemoPanel";
import { DEMO_JUMPS } from "@/lib/demo/reset";

// P.2: open this page to wipe all local demo data (tp: keys and recordings) and reload the seed.
export default function ResetPage() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    resetThisBrowser().then(() => setDone(true));
  }, []);
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
      <h1 className="font-display text-4xl">{done ? "Demo reset" : "Resetting…"}</h1>
      {done && (
        <>
          <p data-testid="demo-reset-done">All local data cleared. Demo employers and Maya&apos;s card reloaded.</p>
          <ul className="space-y-1">
            {DEMO_JUMPS.map((j) => (
              <li key={j.href}><Link className="underline" href={j.href}>{j.label}</Link></li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
