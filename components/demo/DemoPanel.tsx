"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_JUMPS, resetDemo } from "@/lib/demo/reset";
import { seedDemo } from "@/lib/demo/seed";
import { media } from "@/lib/store/media";
import { Role, store } from "@/lib/store/store";

const ROLES = Role.options;

/** Ctrl+Shift+D (Cmd+Shift+D on Mac). Exported for tests. */
export const isDemoCombo = (e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">) =>
  e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d";

/** Reset this browser's demo data and reseed. Used by the panel and /demo/reset. */
export async function resetThisBrowser() {
  await resetDemo(store(), window.localStorage, media);
  window.dispatchEvent(new Event("tp:role-changed"));
}

// P.2: hidden demo shortcuts. Nothing shows on screen until the key combo is pressed.
export function DemoPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isDemoCombo(e)) return;
      e.preventDefault();
      setOpen((o) => !o);
      setMsg("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const setRole = (r: Role) => {
    store().setRole(r);
    window.dispatchEvent(new Event("tp:role-changed"));
    router.push(`/${r}`);
    setOpen(false);
  };

  return (
    <div role="dialog" aria-label="Demo shortcuts" data-testid="demo-panel" className="tp-pop fixed right-4 top-20 z-[200] w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-card text-sm shadow-lg">
      <div className="flex items-center justify-between border-b border-border/70 py-2 pl-4 pr-2">
        <p className="font-semibold">Demo shortcuts</p>
        <button type="button" aria-label="Close demo shortcuts" onClick={() => setOpen(false)} className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">✕</button>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {ROLES.map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} className="min-h-8 rounded-md px-1 text-xs font-medium capitalize text-muted-foreground transition-colors hover:bg-card hover:text-foreground" data-testid={`demo-role-${r}`}>{r}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Jump to</p>
          <ul className="mt-1 -mx-2">
            {DEMO_JUMPS.map((j) => (
              <li key={j.href}>
                <Link href={j.href} onClick={() => setOpen(false)} className="flex min-h-9 items-center justify-between rounded-md px-2 transition-colors hover:bg-muted">
                  {j.label}<span aria-hidden className="text-muted-foreground">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2 border-t border-border/70 pt-3">
          <button type="button" className="min-h-9 flex-1 rounded-lg border bg-card px-2 text-xs font-medium shadow-xs hover:bg-muted" data-testid="demo-seed" onClick={() => { seedDemo(store()); setMsg("Demo data loaded"); }}>Load demo seed</button>
          <button type="button" className="min-h-9 flex-1 rounded-lg border border-destructive/40 px-2 text-xs font-medium text-destructive hover:bg-destructive/5" data-testid="demo-reset" onClick={async () => { await resetThisBrowser(); setMsg("Reset done, seed reloaded"); router.refresh(); }}>Reset everything</button>
        </div>
        {msg && <p role="status" className="text-xs" data-testid="demo-msg">{msg}</p>}
      </div>
    </div>
  );
}
