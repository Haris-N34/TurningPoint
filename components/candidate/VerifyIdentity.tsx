"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { store } from "@/lib/store/store";

// Demo only: no real school is named anywhere. A pilot plugs in each school's own sign-in.
const SCHOOL = { name: "your school", domain: "school.edu" };

/**
 * Mocked university sign-in (C1.5). Demo only: nothing leaves the browser. It sets verified=true
 * so the card can show the verified badge. Name, email and school never reach any extractor (G2).
 */
export function VerifyIdentity() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [step, setStep] = useState<"pick" | "sso" | "done">("pick");
  const [name, setName] = useState("");
  const [user, setUser] = useState("");

  useEffect(() => {
    const p = store().getProfile();
    if (p.verified) setStep("done");
    if (p.displayName) setName(p.displayName);
  }, []);

  if (step === "done") {
    return (
      <main className="mx-auto max-w-md px-4 py-12" data-testid="verified">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Verified</p>
        <h1 className="mt-1 text-2xl font-semibold">You&apos;re verified</h1>
        <p className="mt-2 opacity-80">Employers see a verified badge on your card. They never see this step&apos;s details.</p>
        <button onClick={() => router.push(next)} className="mt-6 rounded-full bg-foreground px-5 py-2.5 font-medium text-background" autoFocus>
          Continue
        </button>
      </main>
    );
  }

  if (step === "pick") {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">Verify you&apos;re a student</h1>
        <p className="mt-2 opacity-80">Once, so employers know your card is really yours.</p>
        <button onClick={() => setStep("sso")} className="mt-6 rounded-full bg-foreground px-5 py-2.5 font-medium text-background">
          Sign in with your school account
        </button>
        <p className="mt-3 text-xs text-muted-foreground">Demo: this sign-in is simulated.</p>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-slate-100 px-4 py-12 text-slate-900" data-testid="mock-sso">
      <form
        className="mx-auto max-w-sm rounded-lg bg-white p-6 shadow"
        onSubmit={(e) => {
          e.preventDefault();
          store().saveProfile({ verified: true, university: "", displayName: name.trim(), email: `${user.trim()}@${SCHOOL.domain}` });
          setStep("done");
        }}
      >
        <p className="text-xs uppercase tracking-widest text-slate-500">School single sign-on (demo)</p>
        <label htmlFor="sso-name" className="mt-4 block text-sm font-medium">Full name</label>
        <input id="sso-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        <label htmlFor="sso-user" className="mt-3 block text-sm font-medium">Campus username</label>
        <div className="mt-1 flex items-center rounded border">
          <input id="sso-user" required value={user} onChange={(e) => setUser(e.target.value.replace(/[^a-z0-9._-]/gi, ""))} className="w-full px-3 py-2" />
          <span className="px-2 text-sm text-slate-500">@{SCHOOL.domain}</span>
        </div>
        <label htmlFor="sso-pass" className="mt-3 block text-sm font-medium">Password</label>
        <input id="sso-pass" type="password" placeholder="Not checked in the demo" className="mt-1 w-full rounded border px-3 py-2" />
        <button type="submit" className="mt-5 w-full rounded bg-red-700 py-2 font-medium text-white">Sign in</button>
      </form>
    </main>
  );
}
