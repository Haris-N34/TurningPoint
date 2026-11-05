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
    <div role="dialog" aria-label="Demo shortcuts" data-testid="demo-panel" className="fixed right-4 top-24 z-[200] w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-4 text-sm shadow-card">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Demo shortcuts</p>
        <button type="button" aria-label="Close demo shortcuts" onClick={() => setOpen(false)} className="min-h-8 px-2 text-muted-foreground">✕</button>
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">Role</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {ROLES.map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)} className="min-h-8 rounded-md border px-2 capitalize" data-testid={`demo-role-${r}`}>{r}</button>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">Jump to</p>
      <ul className="mt-1 space-y-1">
        {DEMO_JUMPS.map((j) => (
          <li key={j.href}>
            <Link href={j.href} onClick={() => setOpen(false)} className="underline underline-offset-2">{j.label}</Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="min-h-8 rounded-md border px-2" data-testid="demo-seed" onClick={() => { seedDemo(store()); setMsg("Demo data loaded"); }}>Load demo seed</button>
        <button type="button" className="min-h-8 rounded-md border border-destructive px-2 text-destructive" data-testid="demo-reset" onClick={async () => { await resetThisBrowser(); setMsg("Reset done, seed reloaded"); router.refresh(); }}>Reset everything</button>
      </div>
      {msg && <p role="status" className="mt-2 text-xs" data-testid="demo-msg">{msg}</p>}
    </div>
  );
}
