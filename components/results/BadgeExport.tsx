"use client";

import { badgeRequestBody } from "@/lib/integrations/badgeRequest";

import Link from "next/link";
import { useState } from "react";
import type { Card } from "@/lib/card/types";

// Portable credential export (C.9): an Open Badges 3.0 file the candidate can keep and show anywhere.
export function BadgeExport({ card }: { card: Card }) {
  const [withName, setWithName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setErr(null);
    try {
      // The server re-scores the answers and signs only what it finds; the browser never sends levels.
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(badgeRequestBody(card, withName)),
      });
      if (!res.ok) throw new Error("Could not create the credential");
      const text = JSON.stringify(await res.json(), null, 2);
      const url = URL.createObjectURL(new Blob([text], { type: "application/ld+json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "turning-point-credential.json";
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the credential");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="badge-h" className="rounded-xl border bg-card p-5 shadow-card" data-testid="badge-export">
      <h2 id="badge-h" className="font-semibold">Take your evidence with you</h2>
      <p className="text-sm opacity-80">
        Download a signed Open Badges 3.0 credential with your Strong and Some skills. Anyone can check it at{" "}
        <Link href="/verify" className="underline">
          /verify
        </Link>
        . If someone edits the file, the check fails.
      </p>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} />
        Put my name on it
      </label>
      <button type="button" onClick={download} disabled={busy} className="mt-3 min-h-11 rounded-lg border border-border bg-card px-5 text-sm font-medium shadow-xs transition-colors hover:bg-muted" data-testid="badge-download">
        {busy ? "Signing…" : "Download credential"}
      </button>
      {done && (
        <p role="status" className="mt-2 text-sm" data-testid="badge-done">
          Saved turning-point-credential.json.
        </p>
      )}
      {err && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {err}
        </p>
      )}
    </section>
  );
}
