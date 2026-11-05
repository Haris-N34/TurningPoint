"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { askCopilot, type Citation, type CopilotOutput } from "@/lib/ai/services/copilot";
import type { Card } from "@/lib/card/types";

// Recruiter Copilot panel (B.6). Answers only from this card's evidence and always cites it; a citation
// click jumps the clip to that second. It refuses protected-trait and "should I hire" questions.

const SUGGESTED = ["Where did they show prioritization?", "How did they handle the turning point?", "What did they say about the team?"];

export function Copilot({ card, onCite }: { card: Card; onCite: (c: { checkpointId: string; t: number }) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<(CopilotOutput & { question: string }) | null>(null);

  const ask = (question: string) => {
    if (!question.trim()) return;
    setQ(question);
    setResult({ ...askCopilot(question, card), question });
  };

  const cite = (c: Citation) => {
    if (c.checkpointId) onCite({ checkpointId: c.checkpointId, t: c.t ?? 0 });
  };

  if (!open) {
    return (
      <Button className="fixed bottom-4 right-4 z-30 shadow-lg" onClick={() => setOpen(true)} data-testid="copilot-open">
        Ask about this candidate
      </Button>
    );
  }

  return (
    <aside
      className="fixed inset-x-2 bottom-2 z-30 max-h-[70vh] overflow-y-auto rounded-xl border bg-card p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px]"
      aria-labelledby="copilot-h"
      data-testid="copilot"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="copilot-h" className="font-semibold">Copilot</h2>
        <button type="button" className="text-sm underline" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Answers only from this card&apos;s evidence, with sources. It won&apos;t judge personal traits or make the hiring call.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor="copilot-q" className="sr-only">Your question</label>
        <input id="copilot-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a skill or a decision" className="min-h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm" data-testid="copilot-q" />
        <Button type="submit" data-testid="copilot-ask">Ask</Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1">
        {SUGGESTED.map((s) => (
          <button key={s} type="button" className="min-h-9 rounded-full border px-3 text-xs" onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>
      {result && (
        <div className="mt-3 space-y-2" aria-live="polite" data-testid="copilot-answer" data-refused={result.refused ?? "no"}>
          {result.answer.split("\n").map((line, i) => (
            <p key={i} className="text-sm">{line}</p>
          ))}
          {result.citations.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {result.citations.map((c, i) => (
                  <li key={i}>
                    {c.checkpointId ? (
                      <button type="button" className="min-h-9 rounded-md border px-2 text-xs underline underline-offset-2" onClick={() => cite(c)} data-testid={`cite-${i}`}>
                        {c.label}
                      </button>
                    ) : (
                      <span className="inline-flex min-h-9 items-center rounded-md border px-2 text-xs" data-testid={`cite-${i}`}>{c.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
