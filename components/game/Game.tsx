"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { Scenario } from "@/lib/engine/schema";
import type { SkillSlug } from "@/lib/engine/skills";
import { advance, choose, progress, startRun, view, type CheckpointDue, type RunState } from "@/lib/engine/engine";
import { planRun, type RunPlan } from "@/lib/engine/seed";
import { store, type Profile } from "@/lib/store/store";
import type { CardCheckpoint } from "@/lib/card/types";
import { checkpointQuestion } from "@/lib/ai/questions";
import { Checkpoint, type CheckpointResult, type IntegrityNote } from "@/components/checkpoint/Checkpoint";
import { RealLife, type RealStory } from "@/components/checkpoint/RealLife";
import Link from "next/link";
import { buildCard } from "@/lib/card/build";
import { useFocusTrap } from "@/lib/a11y/focusTrap";
import { ResourceBar } from "./ResourceBar";
import { chime } from "./sound";

type Pending = { id: string; due: CheckpointDue; question: string; source: "generated" | "fallback" };
type Run = {
  attemptId: string;
  plan: RunPlan;
  state: RunState;
  startedAt: string;
  checkpointsDue: CheckpointDue[];
  pending?: Pending;
  answers: CardCheckpoint[];
  integrity: IntegrityNote[];
  realStory?: RealStory;
};

function newAttemptId() {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
  return "att_" + rand.replace(/-/g, "").slice(0, 10);
}

export type GameChallenge = { id: string; title: string; company: string; targetSkills?: SkillSlug[] };

/**
 * Plays one scenario for one challenge. `sandbox` is the admin's "Preview as candidate" (E1.5):
 * the full game runs but nothing is saved.
 */
export function Game({ scenario, challenge, sandbox = false }: { scenario: Scenario; challenge: GameChallenge; sandbox?: boolean }) {
  const scenarioId = challenge.id;
  const [run, setRun] = useState<Run | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const shownAt = useRef<number>(0);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Resume an unfinished run on this device (C2.4).
  useEffect(() => {
    const s = store();
    setMuted(s.getJSON("muted", z.boolean()) ?? false);
    setProfile(s.getProfile());
    const saved = sandbox ? undefined : s.activeRun(scenarioId);
    if (saved && saved.scenarioId === scenario.id) {
      const extra = saved.extra as Partial<Pick<Run, "plan" | "checkpointsDue" | "pending" | "answers" | "integrity" | "realStory">>;
      const state = saved.state as RunState;
      if (extra.plan && state?.nodeId && state.scenarioVersion === scenario.version) {
        setRun({
          attemptId: saved.attemptId,
          plan: extra.plan,
          state,
          startedAt: saved.startedAt,
          checkpointsDue: extra.checkpointsDue ?? [],
          pending: extra.pending,
          answers: extra.answers ?? [],
          integrity: extra.integrity ?? [],
          realStory: extra.realStory,
        });
        setPaused(saved.status === "paused");
      }
    }
    setLoaded(true);
  }, [scenario, scenarioId, sandbox]);

  const save = useCallback(
    (r: Run, status: "playing" | "paused" | "finished") => {
      if (sandbox) return;
      store().saveRun({
        attemptId: r.attemptId,
        challengeId: scenarioId,
        scenarioId: scenario.id,
        seed: r.plan.seed,
        state: r.state,
        extra: { plan: r.plan, checkpointsDue: r.checkpointsDue, pending: r.pending, answers: r.answers, integrity: r.integrity, realStory: r.realStory },
        status,
        startedAt: r.startedAt,
        practice: false,
      });
    },
    [scenario.id, scenarioId, sandbox],
  );

  const update = useCallback(
    (r: Run) => {
      setRun(r);
      save(r, r.state.status === "ended" ? "finished" : "playing");
    },
    [save],
  );

  const [optIn, setOptIn] = useState(false);

  const begin = () => {
    // Starting is consent to record answers on this device. The improvement opt-in is separate and off by default (PV2).
    setProfile(store().saveProfile({ consentedToRecording: true, improvementOptIn: optIn }));
    const attemptId = newAttemptId();
    const plan = planRun(scenario, attemptId);
    update({ attemptId, plan, state: startRun(scenario, plan), startedAt: new Date().toISOString(), checkpointsDue: [], answers: [], integrity: [] });
  };

  const v = run ? view(scenario, run.plan, run.state) : null;
  const isTurningPoint = v?.kind === "event" && v.turningPoint;

  useEffect(() => {
    shownAt.current = performance.now();
  }, [run?.state.nodeId]);

  useEffect(() => {
    if (isTurningPoint && !muted) chime("turning-point");
  }, [isTurningPoint, muted]);

  // A finished run becomes a Capability Card, shared with the challenge it was played for.
  useEffect(() => {
    if (!run || run.state.status !== "ended" || !profile || sandbox) return;
    const s = store();
    if (s.getCard(run.attemptId)) return;
    const card = buildCard({
      attemptId: run.attemptId,
      scenario,
      plan: run.plan,
      state: run.state,
      answers: run.answers,
      integrity: run.integrity,
      realStory: run.realStory,
      challenge,
      candidate: { displayName: profile.displayName, university: profile.university || undefined, verified: profile.verified },
      timeMultiplier: profile.accommodations.timeMultiplier,
    });
    s.saveCard(card);
    s.share(run.attemptId, scenarioId, false);
  }, [run, profile, scenario, scenarioId, challenge, sandbox]);

  // When a checkpoint or the pause screen closes, put focus back on the next action (A3, keyboard play).
  const blocking = !!run?.pending || paused;
  useEffect(() => {
    if (blocking) return;
    const t = setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const targets = document.querySelectorAll<HTMLElement>("[data-primary-action]");
      targets[targets.length - 1]?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [blocking]);

  const onChoose = (optionId: string) => {
    if (!run || paused) return;
    const r = choose(scenario, run.plan, run.state, optionId, performance.now() - shownAt.current);
    let pending: Pending | undefined;
    if (r.checkpoint) {
      // Built the moment the choice is made, so it is ready when the checkpoint fires (latency budget).
      const q = checkpointQuestion(scenario, r.checkpoint, run.plan.seed);
      pending = { id: `cp${run.checkpointsDue.length + 1}`, due: r.checkpoint, question: q.question, source: q.source };
      if (!muted) chime("checkpoint");
    }
    update({ ...run, state: r.state, pending, checkpointsDue: r.checkpoint ? [...run.checkpointsDue, r.checkpoint] : run.checkpointsDue });
  };

  const onContinue = () => {
    if (!run || paused) return;
    update({ ...run, state: advance(scenario, run.plan, run.state) });
  };

  const onCheckpointDone = (res: CheckpointResult) => {
    if (!run) return;
    update({ ...run, pending: undefined, answers: [...run.answers, res.checkpoint], integrity: [...run.integrity, ...res.integrity] });
  };

  const onRealLifeDone = (res: { results: CheckpointResult[]; story: RealStory }) => {
    if (!run) return;
    const next = {
      ...run,
      answers: [...run.answers, ...res.results.map((r) => r.checkpoint)],
      integrity: [...run.integrity, ...res.results.flatMap((r) => r.integrity)],
      realStory: res.story,
    };
    update({ ...next, state: advance(scenario, run.plan, run.state) });
  };

  const saveMode = (m: "video" | "voice" | "text") => {
    setProfile(store().saveProfile({ defaultMode: m }));
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
        <p className="text-sm uppercase tracking-wide opacity-70">{challenge.company}</p>
        <h1 className="mt-1 text-3xl font-semibold">{challenge.title}</h1>
        {challenge.title !== scenario.title && <p className="mt-1 opacity-80">Scenario: {scenario.title}</p>}
        {scenario.summary && <p className="mt-3 opacity-80">{scenario.summary}</p>}
        <section className="mt-8 rounded-2xl border p-4 text-sm" aria-labelledby="consent-title" data-testid="consent">
          <h2 id="consent-title" className="font-semibold">Before you start</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 opacity-90">
            <li>2 or 3 checkpoints will ask you to explain a choice. You can answer by video, voice or text.</li>
            <li>Answers are recorded and kept on this device. You choose which employers see them, and you can delete everything.</li>
            <li>Only your words are used. Your face, voice tone, accent and grammar are never scored.</li>
          </ul>
          <label className="mt-3 flex items-start gap-2">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-1" data-testid="improve-opt-in" />
            <span>Also use my answers to improve Turning Point (optional)</span>
          </label>
        </section>
        <button onClick={begin} className="mt-6 rounded-full bg-foreground text-background px-6 py-3 font-medium" autoFocus>
          I agree, start
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
              <img src={`/art/${v.node.art.key}${profile?.accommodations.lowBandwidth ? ".small" : ""}.webp`} alt={v.node.art.alt} className="aspect-[16/9] w-full rounded-2xl object-cover" />
            ) : (
              <div aria-hidden className="aspect-[16/9] w-full rounded-2xl bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-rose-900/30" />
            )}

            <p className="text-lg leading-relaxed" data-testid="narration">{v?.text}</p>

            {v?.kind === "choice" && <Choices options={v.node.options} onChoose={onChoose} disabled={paused || !!run.pending} focusToken={`${run.pending?.id ?? ""}${paused}`} />}
            {(v?.kind === "scene" || (v?.kind === "event" && !v.turningPoint)) && <ContinueButton onClick={onContinue} disabled={paused} />}
            {v?.kind === "checkpoint" && profile && (
              <RealLife
                key={run.state.nodeId}
                attemptId={run.attemptId}
                persistMedia={!sandbox}
                nodeId={v.node.id}
                prompt={v.text}
                profile={profile}
                onModeChange={saveMode}
                onDone={onRealLifeDone}
              />
            )}
            {v?.kind === "end" && <EndSummary scenario={scenario} run={run} sandbox={sandbox} />}
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
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Turning point</p>
                <h2 id="tp-title" className="mt-2 text-2xl font-semibold">{v.title}</h2>
                <p className="mt-3 leading-relaxed">{v.text}</p>
                {v.disruption && (
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="What changed">
                    {Object.entries(v.disruption.effects).map(([k, d]) => (
                      <li key={k} className="rounded-full bg-orange-600/10 px-3 py-1 text-sm font-medium text-orange-800 dark:text-orange-200">
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

        {run.pending && profile && !paused && (
          <Checkpoint
            key={run.pending.id}
            id={run.pending.id}
            nodeId={run.pending.due.nodeId}
            kind="decision"
            question={run.pending.question}
            questionSource={run.pending.source}
            attemptId={run.attemptId}
            persistMedia={!sandbox}
            multiplier={profile.accommodations.timeMultiplier}
            defaultMode={profile.defaultMode}
            textOnly={profile.accommodations.textOnly}
            onModeChange={saveMode}
            onDone={onCheckpointDone}
          />
        )}

        {paused && <PausedDialog onResume={togglePause} />}
      </main>
    </MotionConfig>
  );
}

/** Pause overlay: focus stays inside it (Tab cycles, Escape resumes). */
function PausedDialog({ onResume }: { onResume: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const resume = useRef(onResume);
  resume.current = onResume;
  const onEscape = useCallback(() => resume.current(), []);
  useFocusTrap(ref, true, onEscape);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Paused" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="rounded-3xl bg-background p-6 text-center text-foreground">
        <p className="text-lg font-semibold">Paused</p>
        <p className="mt-1 text-sm opacity-80">Your progress is saved. You can close this tab and come back.</p>
        <button onClick={onResume} className="mt-4 rounded-full bg-foreground px-5 py-2 text-background" autoFocus>
          Resume
        </button>
      </div>
    </div>
  );
}

function ContinueButton({ onClick, disabled, label = "Continue" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} autoFocus data-primary-action className="mt-4 self-start rounded-full bg-foreground px-6 py-3 font-medium text-background disabled:opacity-50">
      {label}
    </button>
  );
}

/** Options with keyboard play: arrow keys move, Enter or Space picks (C2.6). */
function Choices({
  options,
  onChoose,
  disabled,
  focusToken,
}: {
  options: { id: string; label: string }[];
  onChoose: (id: string) => void;
  disabled?: boolean;
  focusToken?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Focus the first option on a new scene and again when a checkpoint or pause closes (A3).
  useEffect(() => {
    if (!disabled) refs.current[0]?.focus();
  }, [options, focusToken, disabled]);
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
          data-primary-action={i === 0 ? "" : undefined}
          className="rounded-2xl border border-black/10 dark:border-white/15 px-4 py-3 text-left font-medium transition hover:bg-black/[.04] dark:hover:bg-white/[.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EndSummary({ scenario, run, sandbox }: { scenario: Scenario; run: Run; sandbox?: boolean }) {
  return (
    <div className="rounded-2xl border p-4" data-testid="end">
      <p className="font-semibold">Run complete</p>
      <p className="mt-1 text-sm opacity-80">
        {sandbox
          ? `Preview finished: ${run.state.log.length} decisions and ${run.answers.length} answers. Nothing was saved.`
          : `${run.state.log.length} decisions and ${run.answers.length} answers saved on this device.`}
      </p>
      {!sandbox && (
        <Link href={`/results/${run.attemptId}`} className="mt-3 inline-block rounded-full bg-foreground px-5 py-2.5 font-medium text-background" data-testid="see-results">
          See your results
        </Link>
      )}
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
