"use client";

import { BackLink } from "@/components/ui/back-link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fixturesOf, PROMPTS } from "@/lib/ai/prompts/registry";
import { aiMode } from "@/lib/ai/providers";
import { runSync } from "@/lib/ai/run";
import { aiHealth, clearAiCalls, listAiCalls, type AiCall } from "@/lib/ai/telemetry";

// AI health (B.8): every AI call from this browser, by service. Latency p50/p95, cost and validation
// failures. Calls hold no candidate content, only what ran and how it went.

const ms = (n: number) => `${Math.round(n)} ms`;
const usd = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

export function AiHealth() {
  const [calls, setCalls] = useState<AiCall[] | null>(null);
  const reload = () => setCalls(listAiCalls());
  useEffect(reload, []);

  const selfCheck = () => {
    for (const p of PROMPTS) for (const f of fixturesOf(p)) runSync(p, f.input);
    reload();
  };

  const h = aiHealth(calls ?? []);
  const rows = [...h.byService, ...(h.byService.length > 1 ? [h.total] : [])];
  const recent = (calls ?? []).slice(-8).reverse();

  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-3 sm:px-10" data-testid="ai-health">
      <BackLink href="/admin">Admin</BackLink>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">AI health</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight">AI calls</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mode <span className="font-mono font-medium" data-testid="ai-mode">{aiMode()}</span>. Off runs the local rules, cached replays recorded answers, live calls Claude from the server. Every call is
        validated against its schema and guards; a failure falls back to the template.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={selfCheck} data-testid="ai-selfcheck">Run self-check</Button>
        <Button size="sm" variant="outline" onClick={() => (clearAiCalls(), reload())}>Clear log</Button>
      </div>

      <section tabIndex={0} className="relative mt-6 overflow-x-auto rounded-xl border bg-card shadow-card" aria-labelledby="svc-h">
        <h2 id="svc-h" className="sr-only">Calls by service</h2>
        <table className="w-full text-sm" data-testid="ai-table">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Service</th>
              <th className="p-3 text-right">Calls</th>
              <th className="p-3 text-right">p50</th>
              <th className="p-3 text-right">p95</th>
              <th className="p-3 text-right">Cost</th>
              <th className="p-3 text-right">Validation failures</th>
              <th className="p-3">Models</th>
            </tr>
          </thead>
          <tbody>
            {calls !== null && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-3 text-muted-foreground">No AI calls yet. Play a run, open a card, or run the self-check.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.service} className="border-t" data-testid={`ai-row-${r.service.replace(/\s+/g, "-").toLowerCase()}`}>
                <td className="p-3 font-medium">{r.service}</td>
                <td className="p-3 text-right tabular-nums">{r.calls}</td>
                <td className="p-3 text-right tabular-nums">{ms(r.p50)}</td>
                <td className="p-3 text-right tabular-nums">{ms(r.p95)}</td>
                <td className="p-3 text-right tabular-nums">{usd(r.costUsd)}</td>
                <td className="p-3 text-right tabular-nums">{r.failures}</td>
                <td className="p-3 font-mono text-xs">{r.models.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6" aria-labelledby="pr-h">
        <h2 id="pr-h" className="font-semibold">Prompt versions</h2>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {PROMPTS.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 rounded-md border px-3 py-1.5">
              <span>{p.service} · <span className="font-mono text-xs">{p.id}</span></span>
              <span className="font-mono text-xs">v{p.version}</span>
            </li>
          ))}
        </ul>
      </section>

      {recent.length > 0 && (
        <section className="mt-6" aria-labelledby="rc-h">
          <h2 id="rc-h" className="font-semibold">Recent calls</h2>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {recent.map((c, i) => (
              <li key={i}>
                {c.at.slice(11, 19)} {c.promptId}@{c.promptVersion} {c.model} {ms(c.latencyMs)} {c.valid ? "valid" : `fallback (${c.error})`}
                {c.cacheHit ? " cache" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
