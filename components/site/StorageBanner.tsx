"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// One calm, site-wide notice when the browser's storage is full (lib/store emits tp:storage-full).
export function StorageBanner() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(true);
    window.addEventListener("tp:storage-full", on);
    return () => window.removeEventListener("tp:storage-full", on);
  }, []);
  if (!full) return null;
  return (
    <div role="status" className="border-b border-border/70 bg-secondary px-4 py-2 text-center text-sm text-secondary-foreground" data-testid="storage-full">
      Storage is full, so this session won&apos;t be saved.{" "}
      <Link href="/demo/reset" className="font-medium underline underline-offset-2">Reset demo data</Link> to free space.
      <button type="button" onClick={() => setFull(false)} className="ml-3 inline-flex min-h-8 items-center rounded-md px-2 text-muted-foreground hover:text-foreground" aria-label="Dismiss storage notice">✕</button>
    </div>
  );
}
