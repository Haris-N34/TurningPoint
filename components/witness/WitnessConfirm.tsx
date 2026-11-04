"use client";

import { useEffect, useState } from "react";
import { SKILLS } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";
import { respond, witnessByToken, type WitnessRecord } from "@/lib/witness/witness";

// Witness page (Flow C, C6.3): no account, works on a phone, about 30 seconds.
// Functional version; Haris owns the final design (#19).
export function WitnessConfirm({ token }: { token: string }) {
  const [w, setW] = useState<WitnessRecord | null | undefined>(undefined);
  const [skills, setSkills] = useState<string[]>([]);
  const [sentence, setSentence] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setW(witnessByToken(store(), token) ?? null), [token]);

  if (w === undefined) return <div className="p-8" aria-busy="true">Loading…</div>;
  if (w === null) return <main className="mx-auto max-w-md p-6">This link is not valid.</main>;
  if (done) return <main className="mx-auto max-w-md p-6" data-testid="witness-done"><p className="text-lg font-medium">{done}</p></main>;
  if (w.status === "expired") return <main className="mx-auto max-w-md p-6">This link has expired.</main>;
  if (w.status !== "pending") return <main className="mx-auto max-w-md p-6">This link has already been used.</main>;

  const answer = (confirmed: boolean) => {
    try {
      respond(store(), token, { confirmed, skillsSeen: skills, sentence });
      setDone(confirmed ? "Thanks. Your confirmation is on their card." : "Thanks. We've noted that you can't confirm this.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-8" data-testid="witness">
      <div>
        <p className="text-sm opacity-70">A student asked you to confirm a real experience</p>
        <h1 className="mt-1 text-xl font-semibold">“{w.storyTitle}”</h1>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Which skills did you see? (up to 3, optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SKILLS.map((s) => {
            const on = skills.includes(s.slug);
            return (
              <label key={s.slug} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${on ? "bg-foreground text-background" : ""}`}>
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
        <input id="w-sentence" value={sentence} maxLength={200} onChange={(e) => setSentence(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={() => answer(true)} className="rounded-full bg-foreground px-5 py-3 font-medium text-background">Yes, this happened</button>
        <button onClick={() => answer(false)} className="rounded-full border px-5 py-3 font-medium">I can&apos;t confirm this</button>
      </div>
    </main>
  );
}
