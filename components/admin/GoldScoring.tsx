"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import gold from "@/lib/ai/evals/gold/answers.json";
import { SKILLS } from "@/lib/engine/skills";
import { cn } from "@/lib/utils";

// Gold-set scoring (B.10). Each team member scores the 48 answers on their own, one at a time.
// Labels stay in this browser until you copy them out. You never see the other person's labels here.

type Level = "strong" | "some" | "not_observed";
const LEVELS: { id: Level; key: string; label: string; rule: string }[] = [
  { id: "strong", key: "1", label: "Strong", rule: "Names the trade-off, says why, and shows who it affects or what they'd change." },
  { id: "some", key: "2", label: "Some", rule: "Gives a reason, but generic or without a trade-off." },
  { id: "not_observed", key: "3", label: "Not shown", rule: "No evidence for this skill in this answer. Not a negative judgment." },
];
const RATERS = ["div", "haris"] as const;
type Rater = (typeof RATERS)[number];
const answers = (gold as { answers: { id: string; skill: string; checkpointQuestion?: string; answer: string }[] }).answers;
const skillName = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;
const keyOf = (r: Rater) => `tp:gold:${r}`;

function load(r: Rater): Record<string, Level> {
  try {
    return JSON.parse(localStorage.getItem(keyOf(r)) ?? "{}");
  } catch {
    return {};
  }
}

export function GoldScoring() {
  const [rater, setRater] = useState<Rater | null>(null);
  const [labels, setLabels] = useState<Record<string, Level>>({});
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!rater) return;
    const l = load(rater);
    setLabels(l);
    const next = answers.findIndex((a) => !l[a.id]);
    setI(next === -1 ? 0 : next);
  }, [rater]);

  const done = answers.filter((a) => labels[a.id]).length;
  const json = useMemo(() => JSON.stringify(Object.fromEntries(answers.filter((a) => labels[a.id]).map((a) => [a.id, labels[a.id]])), null, 2), [labels]);

  const pick = (level: Level) => {
    if (!rater) return;
    const a = answers[i];
    const next = { ...labels, [a.id]: level };
    setLabels(next);
    try {
      localStorage.setItem(keyOf(rater), JSON.stringify(next));
    } catch {}
    if (i < answers.length - 1) setI(i + 1);
  };

  useEffect(() => {
    if (!rater) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const l = LEVELS.find((x) => x.key === e.key);
      if (l) pick(l.id);
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      else if (e.key === "ArrowRight") setI((x) => Math.min(answers.length - 1, x + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const a = answers[i];
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-10" data-testid="gold-scoring">
      <Link href="/admin" className="text-sm underline">← Admin</Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-primary">Gold set</p>
      <h1 className="mt-1 font-display text-3xl">Score answers by hand</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        These {answers.length} answers check the AI. You score each one for the named skill only. Ignore grammar, spelling and accent. Don&apos;t look at the other person&apos;s scores.
      </p>

      {!rater ? (
        <div className="mt-6 flex gap-2">
          {RATERS.map((r) => (
            <Button key={r} onClick={() => setRater(r)} data-testid={`rater-${r}`}>
              I&apos;m {r === "div" ? "Div" : "Haris"}
            </Button>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between text-sm">
            <span>
              Scoring as <b>{rater === "div" ? "Div" : "Haris"}</b>
            </span>
            <span data-testid="gold-progress">
              {done} of {answers.length} scored
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted" aria-hidden>
            <div className="h-2 rounded-full bg-primary" style={{ width: `${(done / answers.length) * 100}%` }} />
          </div>

          <section className="mt-6 rounded-xl border bg-card p-5 shadow-card" aria-live="polite" data-testid="gold-item">
            <p className="text-xs text-muted-foreground">
              Answer {i + 1} of {answers.length} · skill: <b className="text-foreground">{skillName(a.skill)}</b>
            </p>
            {a.checkpointQuestion && <p className="mt-3 text-sm text-muted-foreground">Q: {a.checkpointQuestion}</p>}
            <blockquote className="mt-2 border-l-4 border-primary pl-3 text-lg">{a.answer}</blockquote>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => pick(l.id)}
                  aria-pressed={labels[a.id] === l.id}
                  data-testid={`level-${l.id}`}
                  className={cn("rounded-lg border-2 p-3 text-left text-sm hover:bg-muted", labels[a.id] === l.id && "border-primary bg-primary/10")}
                >
                  <span className="font-semibold">
                    {l.key}. {l.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{l.rule}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-sm">
              <button type="button" className="underline disabled:opacity-40" disabled={i === 0} onClick={() => setI(i - 1)}>
                ← Back
              </button>
              <span className="text-xs text-muted-foreground">Keys 1, 2, 3 to score; arrows to move</span>
              <button type="button" className="underline disabled:opacity-40" disabled={i === answers.length - 1} onClick={() => setI(i + 1)}>
                Next →
              </button>
            </div>
          </section>

          {done === answers.length && (
            <section className="mt-6 rounded-xl border bg-card p-5 shadow-card" data-testid="gold-done">
              <h2 className="font-display text-xl">All done</h2>
              <p className="mt-1 text-sm">Copy your scores and paste them to Claude (or save as labels.{rater}.json).</p>
              <div className="mt-3 flex gap-2">
                <Button onClick={copy} data-testid="gold-copy">{copied ? "Copied" : "Copy scores"}</Button>
                <Button variant="outline" asChild>
                  <a href={`data:application/json;charset=utf-8,${encodeURIComponent(json)}`} download={`labels.${rater}.json`}>
                    Download file
                  </a>
                </Button>
              </div>
              <label className="mt-3 block text-xs text-muted-foreground">
                Your scores
                <textarea readOnly value={json} rows={6} className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs" data-testid="gold-json" />
              </label>
            </section>
          )}
        </>
      )}
    </main>
  );
}
