"use client";

import { useEffect, useState } from "react";
import { SKILLS } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";
import { respond, witnessByToken, type WitnessRecord } from "@/lib/witness/witness";

// Witness page (Flow C, C6.3): no account, works on a phone, about 30 seconds.
// Names and email are never included in the employer-facing confirmation.
export function WitnessConfirm({ token }: { token: string }) {
  const [w, setW] = useState<WitnessRecord | null | undefined>(undefined);
  const [skills, setSkills] = useState<string[]>([]);
  const [sentence, setSentence] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setW(witnessByToken(store(), token) ?? null), [token]);

  if (w === undefined) return <div className="p-8" aria-busy="true">Loading…</div>;
  if (w === null) return <main className="mx-auto my-10 max-w-lg rounded-2xl border bg-card p-6 sm:p-10">This link is not valid.</main>;
  if (done) return <main className="mx-auto my-10 max-w-lg rounded-2xl border bg-card p-6 sm:p-10" data-testid="witness-done"><p className="text-lg font-medium">{done}</p></main>;
  if (w.status === "expired") return <main className="mx-auto my-10 max-w-lg rounded-2xl border bg-card p-6 sm:p-10">This link has expired.</main>;
  if (w.status !== "pending") return <main className="mx-auto my-10 max-w-lg rounded-2xl border bg-card p-6 sm:p-10">This link has already been used.</main>;

  const answer = (confirmed: boolean) => {
    try {
      respond(store(), token, { confirmed, skillsSeen: skills, sentence });
      setDone(confirmed ? "Thanks. Your confirmation is on their card." : "Thanks. We've noted that you can't confirm this.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <main className="mx-auto my-8 max-w-lg space-y-6 rounded-2xl border bg-card px-5 py-8 shadow-card sm:px-8" data-testid="witness">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-primary">A student asked you to confirm a real experience</p>
        <h1 className="mt-4 font-display text-3xl leading-snug">“{w.storyTitle}”</h1>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Confirm only what you personally observed. No account is needed. Employers see your relationship, selected skills and optional sentence, not your email.</p>
      <fieldset>
        <legend className="text-sm font-medium">Which skills did you see? (up to 3, optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SKILLS.map((s) => {
            const on = skills.includes(s.slug);
            return (
              <label key={s.slug} className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${on ? "bg-primary text-primary-foreground" : ""}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  disabled={!on && skills.length >= 3}
                  onChange={() => setSkills((x) => (on ? x.filter((k) => k !== s.slug) : [...x, s.slug]))}
                />
                {s.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div>
        <label htmlFor="w-sentence" className="text-sm font-medium">One sentence (optional)</label>
        <input id="w-sentence" value={sentence} maxLength={200} onChange={(e) => setSentence(e.target.value)} className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 py-2" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={() => answer(true)} className="min-h-11 rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground">Yes, this happened</button>
        <button onClick={() => answer(false)} className="min-h-11 rounded-md border px-5 py-3 font-medium">I can&apos;t confirm this</button>
      </div>
    </main>
  );
}
