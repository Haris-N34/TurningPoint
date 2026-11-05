"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { SKILLS } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";
import { respond, witnessByToken, type WitnessRecord } from "@/lib/witness/witness";
import { RELATIONSHIP_LABELS } from "./labels";

const MAX_SKILLS = 3;

function Notice({ title, body, testId }: { title: string; body: string; testId?: string }) {
  return (
    <main className="mx-auto my-8 max-w-lg rounded-2xl border bg-card px-5 py-8 shadow-card sm:my-10 sm:px-8" data-testid={testId}>
      <h1 className="font-display text-3xl leading-snug">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </main>
  );
}

// Witness page (Flow C, C6.3): no account, works on a phone, about 30 seconds.
// Names and email are never included in the employer-facing confirmation.
export function WitnessConfirm({ token }: { token: string }) {
  const [w, setW] = useState<WitnessRecord | null | undefined>(undefined);
  const [skills, setSkills] = useState<string[]>([]);
  const [sentence, setSentence] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setW(witnessByToken(store(), token) ?? null), [token]);

  if (w === undefined) return <PageSkeleton label="Loading the witness request" />;
  if (w === null) return <Notice title="This link is not valid" body="Check that you opened the full link the candidate shared. Nothing has been recorded." />;
  if (done) return <Notice title="Thank you" body={done} testId="witness-done" />;
  if (w.status === "expired") return <Notice title="This link has expired" body="Witness links last 14 days. Ask the candidate for a new one if you still want to respond." />;
  if (w.status !== "pending") return <Notice title="This link has already been used" body="Each witness link works once. Your earlier answer is on the card." />;

  const answer = (confirmed: boolean) => {
    try {
      respond(store(), token, { confirmed, skillsSeen: skills, sentence });
      setDone(confirmed ? "Your confirmation is on their card. Employers see your relationship, the skills you picked and your sentence, never your email." : "We've noted that you can't confirm this. Nothing else is shared.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <main className="mx-auto my-6 max-w-lg space-y-6 rounded-2xl border bg-card px-5 py-7 shadow-card sm:my-8 sm:px-8" data-testid="witness">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-primary">A candidate asked you to confirm a real experience</p>
        <h1 className="mt-4 font-display text-3xl leading-snug">“{w.storyTitle}”</h1>
        <p className="mt-3 text-sm">You were asked as their {RELATIONSHIP_LABELS[w.relationship].toLowerCase()}. It takes about 30 seconds.</p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Confirm only what you personally observed. No account is needed. Employers see your relationship, selected skills and optional sentence, not your email. You do not decide whether someone gets hired.</p>
      <fieldset>
        <legend className="text-sm font-medium">Which skills did you see? (optional)</legend>
        <p className="mt-1 text-xs text-muted-foreground" data-testid="skill-count" aria-live="polite">{skills.length} of {MAX_SKILLS} selected</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SKILLS.map((s) => {
            const on = skills.includes(s.slug);
            const full = !on && skills.length >= MAX_SKILLS;
            return (
              <label key={s.slug} className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${on ? "border-primary bg-primary text-primary-foreground" : ""} ${full ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  disabled={full}
                  onChange={() => setSkills((x) => (on ? x.filter((k) => k !== s.slug) : [...x, s.slug]))}
                />
                {on && <span aria-hidden>✓</span>}
                {s.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div>
        <label htmlFor="w-sentence" className="text-sm font-medium">One sentence (optional)</label>
        <input id="w-sentence" value={sentence} maxLength={200} onChange={(e) => setSentence(e.target.value)} placeholder="What you saw them do" className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 py-2" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={() => answer(true)} className="min-h-11 rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground">Yes, this happened</button>
        <button onClick={() => answer(false)} className="min-h-11 rounded-md border px-5 py-3 font-medium">I can&apos;t confirm this</button>
      </div>
    </main>
  );
}
