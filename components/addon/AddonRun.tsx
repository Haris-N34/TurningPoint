"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { skillName } from "@/components/card/CapabilityCard";
import { Button } from "@/components/ui/button";
import { ADDON_MINUTES, ADDON_SITUATION, addonQuestion, completeAddon, getAddon, type Addon } from "@/lib/addon/addon";
import type { SkillSlug } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";

// E8.2: the 5-minute mini-scenario. Text answers (no camera needed). Timer follows the candidate's
// time accommodation (1.5x or 2x). When time runs out, what is written so far is sent.
export function AddonRun({ id }: { id: string }) {
  const [addon, setAddon] = useState<Addon | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Partial<Record<SkillSlug, string>>>({});
  const [left, setLeft] = useState(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    const s = store();
    setAddon(getAddon(s, id) ?? null);
    setLeft(Math.round(ADDON_MINUTES * 60 * s.getProfile().accommodations.timeMultiplier));
  }, [id]);

  const submit = useCallback(() => setAddon(completeAddon(store(), id, answersRef.current)), [id]);

  const running = addon?.status === "requested";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (running && left === 0 && addon) submit();
  }, [running, left, addon, submit]);

  if (addon === undefined) return <main className="p-8" aria-busy="true">Loading…</main>;
  if (addon === null) return <main className="mx-auto max-w-2xl p-6"><p>This add-on request is not on this device.</p><Link className="underline" href="/candidate">Back</Link></main>;
  if (addon.status === "done")
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-6" data-testid="addon-sent">
        <h1 className="text-2xl font-semibold">Add-on sent</h1>
        <p>Only the employer who asked sees these answers, next to your card.</p>
        <Link className="underline" href="/candidate">Back to your home</Link>
      </main>
    );

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6" data-testid="addon-run">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Short add-on</h1>
        <p className="tabular-nums" role="timer" aria-label="Time left">{mm}:{ss}</p>
      </div>
      <p className="rounded-xl border bg-card p-4">{ADDON_SITUATION}</p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {addon.skills.map((sk) => (
          <div key={sk} className="space-y-1">
            <label htmlFor={`addon-${sk}`} className="block font-medium">{addonQuestion(sk)}</label>
            <p className="text-xs text-muted-foreground">{skillName(sk)}</p>
            <textarea id={`addon-${sk}`} rows={4} className="w-full rounded-md border border-input bg-background p-2" value={answers[sk] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [sk]: e.target.value }))} />
          </div>
        ))}
        <div className="flex gap-3">
          <Button type="submit" data-testid="addon-submit">Send answers</Button>
          <Button asChild variant="outline"><Link href="/candidate">Not now</Link></Button>
        </div>
      </form>
    </main>
  );
}
