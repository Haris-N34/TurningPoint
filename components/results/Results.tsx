"use client";

import { useEffect, useRef, useState } from "react";
import { ClipPlayer, type ClipHandle } from "@/components/card/ClipPlayer";
import type { Card } from "@/lib/card/types";
import { SKILLS } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";

const LEVEL_LABEL = { strong: "Strong", some: "Some", not_observed: "Not observed", needs_review: "Needs human review" } as const;
const skillName = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// Candidate's own results (functional version). Haris owns the final layout (#17, #19) and can reuse ClipPlayer.
export function Results({ attemptId }: { attemptId: string }) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const clips = useRef<Record<string, ClipHandle | null>>({});
  useEffect(() => setCard(store().getCard(attemptId) ?? null), [attemptId]);

  if (card === undefined) return <div className="p-8" aria-busy="true">Loading…</div>;
  if (card === null) return <main className="mx-auto max-w-2xl p-6">No card found on this device.</main>;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8" data-testid="results">
      <header>
        <p className="text-sm opacity-70">Your Capability Card · exactly what an employer sees</p>
        <h1 className="mt-1 text-2xl font-semibold">{card.challenge.title}</h1>
        <p className="text-sm opacity-70">
          {card.challenge.company} · {new Date(card.finishedAt).toLocaleDateString("en-CA")}
          {card.candidate.verified ? " · Verified" : ""}
          {card.adjustedTiming ? " · Adjusted timing" : ""}
        </p>
      </header>

      <section aria-labelledby="skills-h">
        <h2 id="skills-h" className="text-lg font-semibold">Skill evidence</h2>
        <p className="text-xs opacity-60">No overall score. A person reviews every card.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="evidence">
          {card.evidence.map((e) => (
            <li key={e.skill} className="rounded-2xl border p-4" data-testid={`evidence-${e.skill}`} data-level={e.level}>
              <p className="font-medium">{skillName(e.skill)}</p>
              <p className="text-sm">{LEVEL_LABEL[e.level]}</p>
              {e.sentence && e.source && (
                <p className="mt-2 text-sm">
                  <span className="mr-1 rounded bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide dark:bg-white/10">AI summary</span>
                  {e.sentence}{" "}
                  {e.source.type === "clip" ? (
                    <button
                      className="underline"
                      data-testid={`jump-${e.skill}`}
                      onClick={() => {
                        const s = e.source as { checkpointId: string; startS: number };
                        clips.current[s.checkpointId]?.seek(s.startS);
                        document.getElementById(`clip-${s.checkpointId}`)?.scrollIntoView({ block: "center" });
                      }}
                    >
                      “{e.source.quote}” ({mmss(e.source.startS)})
                    </button>
                  ) : (
                    <span>Choice: “{e.source.optionLabel}”</span>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {card.realStory && (
        <section aria-labelledby="story-h">
          <h2 id="story-h" className="text-lg font-semibold">Real turning point</h2>
          <p className="mt-1 text-lg">“{card.realStory.title}”</p>
        </section>
      )}

      <section aria-labelledby="clips-h">
        <h2 id="clips-h" className="text-lg font-semibold">Answers</h2>
        <ol className="mt-3 space-y-4">
          {card.checkpoints.map((c) => (
            <li key={c.id} id={`clip-${c.id}`} className="rounded-2xl border p-4" data-testid={`answer-${c.id}`}>
              <p className="text-xs uppercase tracking-wide opacity-60">
                {c.kind === "decision" ? "Checkpoint" : c.kind === "real_life" ? "Real life" : "Follow-up"} · {c.mode}
                {c.retakeUsed ? " · retake used" : ""}
              </p>
              <p className="mt-1 font-medium">{c.question}</p>
              <div className="mt-2">
                <ClipPlayer
                  checkpoint={c}
                  ref={(h) => {
                    clips.current[c.id] = h;
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {card.integrity.length > 0 && (
        <section className="rounded-2xl bg-black/[.03] p-4 text-sm text-black/60 dark:bg-white/[.04] dark:text-white/60" aria-labelledby="int-h">
          <h2 id="int-h" className="font-medium">Integrity notes · For context, not scored</h2>
          <ul className="mt-1 list-disc pl-5">
            {card.integrity.map((n, i) => (
              <li key={i}>{n.detail}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
