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
      <header className="border-b border-border/70 bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-10">
          <Link href="/" aria-label="Turning Point home" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">↗</span>
            <span className="hidden min-[400px]:inline">Turning Point<span aria-hidden className="text-primary">.</span></span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-4">
            <Link href="/how-we-use-ai" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground">How we use AI</Link>
            <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
            <div className="flex items-center gap-2">
              <label htmlFor="demo-role" className="sr-only text-xs font-medium uppercase tracking-wider text-muted-foreground sm:not-sr-only">Demo role</label>
              <select id="demo-role" value={activeRole} onChange={e => {
                const role = Role.parse(e.target.value);
                store().setRole(role);
                window.dispatchEvent(new Event(event));
                router.push(`/${role}`);
              }} className="min-h-11 rounded-full border border-input/60 bg-card px-3 pr-8 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-input sm:min-h-9">
                {roles.map(role => <option key={role} value={role}>{labels[role]}</option>)}
              </select>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
