"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Role, store } from "@/lib/store/store";

const roles = ["candidate", "recruiter", "admin", "witness"] as const;
const labels = { candidate: "Candidate", recruiter: "Recruiter", admin: "Admin", witness: "Witness" };
const event = "tp:role-changed";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(event, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(event, listener); };
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const savedRole = useSyncExternalStore(subscribe, () => store().getRole(), () => "candidate" as Role);
  const activeRole = roles.find(role => pathname === `/${role}` || pathname.startsWith(`/${role}/`)) ?? savedRole;
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-card focus:p-4">Skip to content</a>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3 sm:px-10">
          <Link href="/" aria-label="Turning Point home" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">↗</span>
            Turning Point<span aria-hidden className="text-primary">.</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/how-we-use-ai" className="mr-3 inline-flex min-h-11 items-center text-xs text-muted-foreground underline underline-offset-4">How we use AI</Link>
            <label htmlFor="demo-role" className="text-xs font-medium text-muted-foreground">Demo role</label>
            <select id="demo-role" value={activeRole} onChange={e => {
              const role = Role.parse(e.target.value);
              store().setRole(role);
              window.dispatchEvent(new Event(event));
              router.push(`/${role}`);
            }} className="min-h-11 max-w-36 rounded-md border border-input bg-background px-3 text-sm text-foreground">
              {roles.map(role => <option key={role} value={role}>{labels[role]}</option>)}
            </select>
          </div>
        </div>
      </header>
    </>
  );
}
