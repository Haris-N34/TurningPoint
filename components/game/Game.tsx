"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { getScenario } from "@/content/scenarios";
import type { Scenario } from "@/lib/engine/schema";
import { advance, choose, progress, startRun, view, type CheckpointDue, type RunState } from "@/lib/engine/engine";
import { planRun, type RunPlan } from "@/lib/engine/seed";
import { store } from "@/lib/store/store";
import { ResourceBar } from "./ResourceBar";
import { chime } from "./sound";

type Run = { attemptId: string; plan: RunPlan; state: RunState; startedAt: string; checkpointsDue: CheckpointDue[] };

function newAttemptId() {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
  return "att_" + rand.replace(/-/g, "").slice(0, 10);
}

export function Game({ scenarioId }: { scenarioId: string }) {
  const scenario = useMemo(() => getScenario(scenarioId)!, [scenarioId]);
  const [run, setRun] = useState<Run | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const shownAt = useRef<number>(0);

  // Resume an unfinished run on this device (C2.4).
  useEffect(() => {
    const s = store();
    setMuted(s.getJSON("muted", z.boolean()) ?? false);
    const saved = s.activeRun(scenarioId);
    if (saved && saved.scenarioId === scenario.id) {
      const extra = saved.extra as { plan?: RunPlan; checkpointsDue?: CheckpointDue[] };
      const state = saved.state as RunState;
      if (extra.plan && state?.nodeId && state.scenarioVersion === scenario.version) {
        setRun({ attemptId: saved.attemptId, plan: extra.plan, state, startedAt: saved.startedAt, checkpointsDue: extra.checkpointsDue ?? [] });
        setPaused(saved.status === "paused");
      }
    }
    setLoaded(true);
  }, [scenario, scenarioId]);

  const save = useCallback(
    (r: Run, status: "playing" | "paused" | "finished") => {
      store().saveRun({
        attemptId: r.attemptId,
        challengeId: scenarioId,
        scenarioId: scenario.id,
        seed: r.plan.seed,
        state: r.state,
        extra: { plan: r.plan, checkpointsDue: r.checkpointsDue },
        status,
        startedAt: r.startedAt,
        practice: false,
      });
    },
    [scenario.id, scenarioId],
  );

  const update = useCallback(
    (r: Run) => {
      setRun(r);
      save(r, r.state.status === "ended" ? "finished" : "playing");
    },
    [save],
  );

  const begin = () => {
    const attemptId = newAttemptId();
    const plan = planRun(scenario, attemptId);
    update({ attemptId, plan, state: startRun(scenario, plan), startedAt: new Date().toISOString(), checkpointsDue: [] });
  };

  const v = run ? view(scenario, run.plan, run.state) : null;
  const isTurningPoint = v?.kind === "event" && v.turningPoint;

  useEffect(() => {
    shownAt.current = performance.now();
  }, [run?.state.nodeId]);

  useEffect(() => {
    if (isTurningPoint && !muted) chime("turning-point");
  }, [isTurningPoint, muted]);

  const onChoose = (optionId: string) => {
    if (!run || paused) return;
    const r = choose(scenario, run.plan, run.state, optionId, performance.now() - shownAt.current);
    update({ ...run, state: r.state, checkpointsDue: r.checkpoint ? [...run.checkpointsDue, r.checkpoint] : run.checkpointsDue });
  };

  const onContinue = () => {
    if (!run || paused) return;
    update({ ...run, state: advance(scenario, run.plan, run.state) });
  };

  const togglePause = () => {
    if (!run) return;
    const next = !paused;
    setPaused(next);
    save(run, next ? "paused" : "playing");
  };

  const toggleMute = () => {
    setMuted((m) => {
      store().setJSON("muted", !m);
      return !m;
    });
  };

  if (!loaded) return <div className="p-8" aria-busy="true">Loading…</div>;

  if (!run) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 sm:py-16">
        <p className="text-sm uppercase tracking-wide opacity-70">Challenge</p>
        <h1 className="mt-1 text-3xl font-semibold">{scenario.title}</h1>
        {scenario.summary && <p className="mt-3 opacity-80">{scenario.summary}</p>}
        <button onClick={begin} className="mt-8 rounded-full bg-foreground text-background px-6 py-3 font-medium" autoFocus>
          Start
        </button>
      </main>
    );
  }

  const pct = Math.round(progress(scenario, run.plan, run.state) * 100);

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-4 px-4 py-4 sm:py-8" data-testid="game" data-node={run.state.nodeId}>
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold truncate">{scenario.title}</h1>
          <div className="flex gap-2">
            <button onClick={toggleMute} className="whitespace-nowrap rounded-full border px-3 py-1 text-sm" aria-pressed={muted}>
              {muted ? "Sound off" : "Sound on"}
            </button>
            {run.state.status === "playing" && (
              <button onClick={togglePause} className="whitespace-nowrap rounded-full border px-3 py-1 text-sm">
                {paused ? "Resume" : "Pause"}
              </button>
            )}
          </div>
        </header>

        <ResourceBar scenario={scenario} values={run.state.resources} />

        <div aria-label={`Progress ${pct}%`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1 rounded-full bg-black/10 dark:bg-white/10">
          <motion.div className="h-full rounded-full bg-foreground/70" animate={{ width: `${pct}%` }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={run.state.nodeId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col gap-5"
          >
            {v && v.node.art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/art/${v.node.art.key}.webp`} alt={v.node.art.alt} className="aspect-[16/9] w-full rounded-2xl object-cover" />
            ) : (
              <div aria-hidden className="aspect-[16/9] w-full rounded-2xl bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-rose-900/30" />
            )}

            <p className="text-lg leading-relaxed" data-testid="narration">{v?.text}</p>

            {v?.kind === "choice" && <Choices options={v.node.options} onChoose={onChoose} disabled={paused} />}
            {(v?.kind === "scene" || (v?.kind === "event" && !v.turningPoint)) && <ContinueButton onClick={onContinue} disabled={paused} />}
            {v?.kind === "checkpoint" && (
              <div className="rounded-2xl border p-4">
                <p className="font-medium">Real-life checkpoint</p>
                <p className="mt-1 text-sm opacity-80">Answering arrives in M2. Continue for now.</p>
                <ContinueButton onClick={onContinue} disabled={paused} />
              </div>
            )}
            {v?.kind === "end" && <EndSummary scenario={scenario} run={run} />}
          </motion.section>
        </AnimatePresence>

        <AnimatePresence>
          {isTurningPoint && v?.kind === "event" && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tp-title"
              data-testid="turning-point"
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-lg rounded-3xl bg-background p-6 sm:p-8 text-foreground shadow-2xl"
                initial={{ scale: 0.92, y: 24 }}
                animate={{ scale: 1, y: 0 }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">Turning point</p>
                <h2 id="tp-title" className="mt-2 text-2xl font-semibold">{v.title}</h2>
                <p className="mt-3 leading-relaxed">{v.text}</p>
                {v.disruption && (
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="What changed">
                    {Object.entries(v.disruption.effects).map(([k, d]) => (
                      <li key={k} className="rounded-full bg-orange-600/10 px-3 py-1 text-sm font-medium text-orange-700 dark:text-orange-300">
                        {scenario.resources[k]?.label} {d > 0 ? "+" : "−"}
                        {scenario.resources[k]?.unit === "$" ? `$${Math.abs(d).toLocaleString("en-CA")}` : Math.abs(d)}
                      </li>
                    ))}
                  </ul>
                )}
                <ContinueButton onClick={onContinue} disabled={paused} label="Face it" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {paused && (
          <div role="dialog" aria-modal="true" aria-label="Paused" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="rounded-3xl bg-background p-6 text-center text-foreground">
              <p className="text-lg font-semibold">Paused</p>
              <p className="mt-1 text-sm opacity-80">Your progress is saved. You can close this tab and come back.</p>
              <button onClick={togglePause} className="mt-4 rounded-full bg-foreground px-5 py-2 text-background" autoFocus>
                Resume
              </button>
            </div>
          </div>
        )}
      </main>
    </MotionConfig>
  );
}

function ContinueButton({ onClick, disabled, label = "Continue" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} autoFocus className="mt-4 self-start rounded-full bg-foreground px-6 py-3 font-medium text-background disabled:opacity-50">
      {label}
    </button>
  );
}

/** Options with keyboard play: arrow keys move, Enter or Space picks (C2.6). */
function Choices({ options, onChoose, disabled }: { options: { id: string; label: string }[]; onChoose: (id: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    refs.current[0]?.focus();
  }, [options]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = options.length;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      refs.current[(i + 1) % n]?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      refs.current[(i - 1 + n) % n]?.focus();
    }
  };
  return (
    <div role="group" aria-label="Your choice" className="flex flex-col gap-2">
      {options.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          onClick={() => onChoose(o.id)}
          onKeyDown={(e) => onKey(e, i)}
          disabled={disabled}
          data-testid={`option-${o.id}`}
          className="rounded-2xl border border-black/10 dark:border-white/15 px-4 py-3 text-left font-medium transition hover:bg-black/[.04] dark:hover:bg-white/[.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EndSummary({ scenario, run }: { scenario: Scenario; run: Run }) {
  return (
    <div className="rounded-2xl border p-4" data-testid="end">
      <p className="font-semibold">Run complete</p>
      <p className="mt-1 text-sm opacity-80">
        {run.state.log.length} decisions logged. Your Capability Card is built from these in M3.
      </p>
      <ul className="mt-3 text-sm">
        {Object.entries(scenario.resources).map(([k, r]) => (
          <li key={k}>
            {r.label}: <span className="font-medium tabular-nums">{run.state.resources[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
