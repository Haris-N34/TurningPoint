"use client";

import { useEffect, useState } from "react";
import { saveSurveyResponse, surveyFor } from "@/lib/impact/events";
import { store } from "@/lib/store/store";

const LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

/** Optional post-game question (PRD v2 Part G). Never shown to employers, never part of any score. */
export function LearningSurvey({ attemptId }: { attemptId: string }) {
  const [rating, setRating] = useState<number>();
  useEffect(() => setRating(surveyFor(store(), attemptId)?.rating), [attemptId]);
  const pick = (n: number) => { saveSurveyResponse(store(), attemptId, n); setRating(n); };
  return (
    <section className="rounded-xl border bg-card p-5" data-testid="learning-survey">
      <fieldset>
        <legend className="font-medium">&ldquo;I learned something about how I work.&rdquo;</legend>
        <p className="mt-1 text-sm text-muted-foreground">Optional. Employers never see this answer and it changes nothing on your card.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LABELS.map((label, i) => (
            <button key={label} type="button" aria-pressed={rating === i + 1} onClick={() => pick(i + 1)}
              className={`min-h-11 rounded-md border px-3 text-sm ${rating === i + 1 ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
              {i + 1} · {label}
            </button>
          ))}
        </div>
      </fieldset>
      <p aria-live="polite" className="mt-3 text-sm">{rating ? "Thanks. Your answer is saved on this device only." : ""}</p>
    </section>
  );
}
