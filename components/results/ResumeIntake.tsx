"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import type { Card } from "@/lib/card/types";
import { analyzeResume, realLifeSuggestion } from "@/lib/integrations/resume";
import { store } from "@/lib/store/store";

// Candidate resume upload with consent (PRD v2 C4, C.5). Optional: no resume means game only, no penalty.
// The real-life suggestion is private to the candidate and never written to the card.

const privateKey = (attemptId: string) => `resume_private:${attemptId}`;

export function ResumeIntake({ card, onChange }: { card: Card; onChange: (c: Card) => void }) {
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | undefined>();
  useEffect(() => setSuggestion(store().getJSON(privateKey(card.attemptId), z.string()) ?? undefined), [card.attemptId]);

  const analyze = () => {
    setErr(null);
    if (!consent) return setErr("Tick the consent box first.");
    if (text.trim().length < 20) return setErr("Paste your resume text or choose a .txt file.");
    const s = store();
    const p = s.getProfile();
    const a = analyzeResume(text, card, {
      source: "upload",
      knownNames: [p.displayName, card.candidate.displayName].filter(Boolean),
      knownSchools: [p.university, card.candidate.university ?? ""].filter(Boolean),
    });
    const next = { ...card, resume: a };
    s.saveCard(next);
    const tip = realLifeSuggestion(a.claims);
    if (tip) s.setJSON(privateKey(card.attemptId), tip);
    setSuggestion(tip);
    setText("");
    onChange(next);
  };

  const remove = () => {
    const s = store();
    const next = { ...card, resume: undefined };
    s.saveCard(next);
    s.setJSON(privateKey(card.attemptId), null);
    setSuggestion(undefined);
    onChange(next);
  };

  return (
    <section aria-labelledby="ri-h" className="rounded-2xl border p-4" data-testid="resume-intake">
      <h2 id="ri-h" className="font-semibold">Add your resume (optional)</h2>
      <p className="text-sm opacity-80">
        We remove your name, contact details, photo, address, graduation years, and school and company names before anything is analyzed. Employers see
        which claims your game evidence backs. Nothing is ever marked false. Without a resume you are scored on the game alone, with no penalty.
      </p>
      {card.resume ? (
        <div className="mt-3 space-y-2 text-sm">
          <p data-testid="resume-added">
            Resume added: {card.resume.claims.length} claims, {card.resume.claims.filter((c) => c.backed).length} backed by game evidence.{" "}
            {card.resume.redactions} details removed.
          </p>
          <button type="button" className="underline" onClick={remove} data-testid="resume-remove">
            Remove my resume
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label htmlFor="ri-text" className="text-sm font-medium">
            Resume text
          </label>
          <textarea
            id="ri-text"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder={"Your name\nExperience\nRole at Organization\n- What you did, and what happened"}
            data-testid="resume-text"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="cursor-pointer underline">
              Or choose a .txt file
              <input
                type="file"
                accept=".txt,.md,text/plain"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setText(await f.text());
                }}
              />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" data-testid="resume-consent" />
            <span>I agree to have my redacted resume compared with my game evidence and shown to employers I share this card with. I can remove it any time.</span>
          </label>
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          <button type="button" onClick={analyze} className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background" data-testid="resume-analyze">
            Compare with my evidence
          </button>
        </div>
      )}
      {suggestion && card.resume && (
        <p className="mt-3 rounded-lg bg-story px-3 py-2 text-sm" data-testid="resume-suggestion">
          <span className="font-medium">Just for you: </span>
          {suggestion}
        </p>
      )}
    </section>
  );
}
