"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardCheckpoint } from "@/lib/card/types";
import { MAX_RETAKES, timing, type CheckpointKind } from "@/lib/checkpoint/timing";
import { fromTyping } from "@/lib/checkpoint/transcript";
import { media } from "@/lib/store/media";
import { useRecorder, type Mode, type Recording } from "./useRecorder";

export type IntegrityNote = { checkpointId: string; kind: "focus_lost" | "retake_used"; detail: string };
export type CheckpointResult = { checkpoint: CardCheckpoint; integrity: IntegrityNote[] };

type Props = {
  id: string;
  nodeId: string;
  kind: CheckpointKind;
  question: string;
  questionSource: "generated" | "fallback";
  attemptId: string;
  multiplier: 1 | 1.5 | 2;
  defaultMode: Mode;
  textOnly: boolean;
  title?: string;
  onDone: (r: CheckpointResult) => void;
  onModeChange?: (m: Mode) => void;
  /** False in the admin preview sandbox: recordings are discarded (E1.5). */
  persistMedia?: boolean;
  /** "pixel" matches the game's pixel UI kit; "app" is the site style. Behaviour is identical. */
  skin?: "app" | "pixel";
};

// Class names per skin. Only looks change; every control, label and flow stays the same.
const SKINS = {
  app: {
    overlay: "bg-black/50 backdrop-blur-md",
    card: "rounded-3xl bg-background text-foreground shadow-2xl",
    eyebrow: "text-xs font-semibold uppercase tracking-widest text-primary",
    question: "text-xl sm:text-2xl font-semibold leading-snug",
    ringTrack: "stroke-black/10 dark:stroke-white/10",
    ringFill: "stroke-orange-600",
    note: "text-sm opacity-80",
    mode: "rounded-full border px-4 py-2 text-sm capitalize",
    modeOn: "bg-foreground text-background",
    primary: "rounded-full bg-foreground px-5 py-2.5 font-medium text-background",
    secondary: "rounded-full border px-5 py-2.5 font-medium",
    field: "mt-1 w-full rounded-2xl border p-3",
    panel: "rounded-2xl bg-black/[.04] dark:bg-white/[.06] p-4",
    calm: "text-sm opacity-80",
  },
  pixel: {
    overlay: "bg-[#2e222f]/75",
    card: "rounded-[6px] border-[3px] border-[#2e222f] bg-[#fff8e7] text-[#2e222f] shadow-[inset_0_-4px_0_#e8d9b5,0_6px_0_#1a1320]",
    eyebrow: "text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9c2c18]",
    question: "text-[20px] sm:text-[24px] font-semibold leading-snug",
    ringTrack: "stroke-[#e8d9b5]",
    ringFill: "stroke-[#c43d22]",
    note: "text-[15px] text-[#5a4a4a]",
    mode: "rounded-[4px] border-2 border-[#2e222f] bg-white px-4 py-1.5 text-[15px] font-semibold capitalize shadow-[inset_0_-3px_0_#e8d9b5] focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[#ffd166]",
    modeOn: "!bg-[#2e222f] text-[#ffd166] !shadow-none",
    primary: "min-h-11 rounded-[4px] border-[3px] border-[#2e222f] bg-[#c43d22] px-5 py-2 text-[16px] font-semibold text-white shadow-[inset_0_-3px_0_#9c2c18] hover:bg-[#d4492c] active:translate-y-0.5 disabled:opacity-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#ffd166]",
    secondary: "min-h-11 rounded-[4px] border-[3px] border-[#2e222f] bg-[#fff8e7] px-5 py-2 text-[16px] font-semibold shadow-[inset_0_-3px_0_#e0cfa6] hover:bg-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#ffd166]",
    field: "mt-1 w-full rounded-[4px] border-[3px] border-[#2e222f] bg-white p-3 text-[17px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#ffd166]",
    panel: "rounded-[4px] border-2 border-[#2e222f] bg-white p-3",
    calm: "text-[14px] text-[#5a4a4a]",
  },
} as const;

type Phase = "think" | "answer" | "review" | "saving";

async function putWithRetry(key: string, blob: Blob, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      return await media.put(key, blob);
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return undefined;
}

function useCountdown(seconds: number, running: boolean, onZero: () => void) {
  const [left, setLeft] = useState(seconds);
  const zero = useRef(onZero);
  zero.current = onZero;
  useEffect(() => {
    setLeft(seconds);
    if (!running) return;
    const end = performance.now() + seconds * 1000;
    const t = setInterval(() => {
      const l = Math.max(0, (end - performance.now()) / 1000);
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        zero.current();
      }
    }, 200);
    return () => clearInterval(t);
  }, [seconds, running]);
  return left;
}

function Ring({ left, total, label, track, fill }: { left: number; total: number; label: string; track: string; fill: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0" role="timer" aria-label={`${label}: ${Math.ceil(left)} seconds left`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className={track} />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" strokeLinecap="round" className={`${fill} transition-[stroke-dashoffset] duration-200`} strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{Math.ceil(left)}</span>
    </div>
  );
}

function TypedQuestion({ text, className }: { text: string; className: string }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const [n, setN] = useState(reduce ? words.length : 0);
  useEffect(() => {
    if (reduce) return setN(words.length);
    setN(0);
    const t = setInterval(() => setN((x) => (x >= words.length ? (clearInterval(t), x) : x + 1)), 70);
    return () => clearInterval(t);
  }, [text, reduce, words.length]);
  return (
    // Every word is laid out from the start (no reflow, never cut off); unrevealed words are just invisible.
    <h2 className={className} aria-label={text} data-testid="checkpoint-question">
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={i} className={i < n ? undefined : "opacity-0"}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </h2>
  );
}

export function Checkpoint(p: Props) {
  const k = SKINS[p.skin ?? "app"];
  const t = timing(p.kind, p.multiplier);
  const [mode, setModeState] = useState<Mode>(p.textOnly ? "text" : p.defaultMode);
  const [phase, setPhase] = useState<Phase>("think");
  const [retakes, setRetakes] = useState(0);
  const [result, setResult] = useState<Recording | null>(null);
  const [text, setText] = useState("");
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [deviceMsg, setDeviceMsg] = useState<string | null>(null);
  const wordTimes = useRef<number[]>([]);
  const answerStart = useRef(0);
  const focusLostMs = useRef(0);
  const blurAt = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const r = useRecorder();

  const setMode = (m: Mode) => {
    setModeState(m);
    p.onModeChange?.(m);
  };

  // Warm up devices during the think window so the answer starts instantly.
  useEffect(() => {
    if (phase !== "think") return;
    r.release();
    if (mode !== "text") {
      r.prepare(mode).then((s) => {
        if (!s) {
          // No dead end: fall back to text (C1.3, A1).
          setDeviceMsg(`No ${mode === "video" ? "camera" : "microphone"} here, so this one is in text. You can switch any time.`);
          setModeState("text");
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase]);

  useEffect(() => {
    if (videoRef.current && r.stream) videoRef.current.srcObject = r.stream;
  }, [r.stream, phase]);

  // Focus loss during an answer is logged as context, never a penalty (C4.8).
  useEffect(() => {
    if (phase !== "answer") return;
    const lose = () => (blurAt.current ??= performance.now());
    const back = () => {
      if (blurAt.current != null) focusLostMs.current += performance.now() - blurAt.current;
      blurAt.current = null;
    };
    const vis = () => (document.hidden ? lose() : back());
    window.addEventListener("blur", lose);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", vis);
    return () => {
      back();
      window.removeEventListener("blur", lose);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [phase]);

  const beginAnswer = useCallback(async () => {
    let m = mode;
    let s = r.stream;
    if (m !== "text" && !s) {
      s = await r.prepare(m);
      if (!s) {
        m = "text";
        setModeState("text");
      }
    }
    answerStart.current = performance.now();
    wordTimes.current = [];
    setText("");
    setResult(null);
    if (m !== "text" && s) r.start(s);
    setPhase("answer");
  }, [mode, r]);

  const finishAnswer = useCallback(async () => {
    if (mode === "text") {
      setResult({ durationS: +((performance.now() - answerStart.current) / 1000).toFixed(2), transcript: fromTyping(text, wordTimes.current) });
    } else {
      setResult(await r.stop());
    }
    setPhase("review");
  }, [mode, r, text]);

  const thinkLeft = useCountdown(t.thinkS, phase === "think", () => void beginAnswer());
  const answerLeft = useCountdown(t.answerS, phase === "answer", finishAnswer);

  const retake = async () => {
    setRetakes((x) => x + 1);
    await beginAnswer();
  };

  const submit = async () => {
    if (!result) return;
    setPhase("saving");
    let key: string | undefined;
    if (result.blob && p.persistMedia !== false) key = await putWithRetry(`${p.attemptId}/${p.id}`, result.blob);
    r.release();
    const integrity: IntegrityNote[] = [];
    const lost = Math.round(focusLostMs.current / 1000);
    if (lost > 0) integrity.push({ checkpointId: p.id, kind: "focus_lost", detail: `Window lost focus for ${lost} second${lost === 1 ? "" : "s"} during the answer` });
    if (retakes > 0) integrity.push({ checkpointId: p.id, kind: "retake_used", detail: "Retake used" });
    p.onDone({
      checkpoint: {
        id: p.id,
        nodeId: p.nodeId,
        kind: p.kind,
        question: p.question,
        questionSource: p.questionSource,
        mode,
        media: key,
        durationS: result.durationS,
        transcript: result.transcript,
        retakeUsed: retakes > 0,
        hidden: false,
      },
      integrity,
    });
  };

  const onType = (v: string) => {
    const now = (performance.now() - answerStart.current) / 1000;
    const count = v.trim().split(/\s+/).filter(Boolean).length;
    while (wordTimes.current.length < count) wordTimes.current.push(now);
    wordTimes.current.length = count;
    setText(v);
  };

  const label = p.title ?? (p.kind === "real_life" ? "Real-life checkpoint" : p.kind === "follow_up" ? "One follow-up" : "Checkpoint");

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-testid="checkpoint"
      data-phase={phase}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 ${k.overlay}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className={`w-full max-w-xl max-h-[95svh] overflow-y-auto p-5 sm:p-7 ${k.card}`}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={k.eyebrow}>{label}</p>
            <div className="mt-2">
              <TypedQuestion text={p.question} className={k.question} />
            </div>
          </div>
          {phase === "think" && <Ring left={thinkLeft} total={t.thinkS} label="Think time" track={k.ringTrack} fill={k.ringFill} />}
          {phase === "answer" && <Ring left={answerLeft} total={t.answerS} label="Answer time" track={k.ringTrack} fill={k.ringFill} />}
        </div>

        {phase === "think" && (
          <div className="mt-5 space-y-4">
            <p className={k.note}>
              Take {t.thinkS} seconds to think. You then have {t.answerS} seconds. Only your words are used, never your face or voice.
            </p>
            <fieldset>
              <legend className="text-sm font-medium">Answer by</legend>
              <div className="mt-2 flex gap-2" role="radiogroup">
                {(["video", "voice", "text"] as Mode[]).map((m) => (
                  <label key={m} className={`cursor-pointer ${k.mode} ${mode === m ? k.modeOn : ""} ${p.textOnly && m !== "text" ? "opacity-40" : ""}`}>
                    <input type="radio" name={`mode-${p.id}`} className="sr-only" value={m} checked={mode === m} disabled={p.textOnly && m !== "text"} onChange={() => setMode(m)} />
                    {m}
                  </label>
                ))}
              </div>
            </fieldset>
            {deviceMsg && <p className={k.calm} role="status">{deviceMsg}</p>}
            <button onClick={() => void beginAnswer()} className={k.primary} autoFocus>
              I&apos;m ready, start answering
            </button>
          </div>
        )}

        {phase === "answer" && (
          <div className="mt-5 space-y-4">
            {mode === "video" && <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-2xl bg-black object-cover" aria-label="Your camera preview" />}
            {mode === "voice" && (
              <div className="flex h-16 items-center justify-center gap-1" aria-label="Recording your voice" role="img">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span key={i} className="w-1.5 rounded-full bg-orange-600/80" style={{ height: `${8 + r.level * 56 * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + answerLeft * 3)))}px` }} />
                ))}
              </div>
            )}
            {mode === "text" && (
              <div>
                <label htmlFor={`ans-${p.id}`} className="text-sm font-medium">Your answer</label>
                <textarea
                  id={`ans-${p.id}`}
                  data-testid="answer-text"
                  autoFocus
                  value={text}
                  onChange={(e) => onType(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    setPasteBlocked(true);
                  }}
                  onDrop={(e) => e.preventDefault()}
                  rows={5}
                  className={k.field}
                />
                {pasteBlocked && <p className={k.calm} role="status">Paste is off for checkpoints. Type your answer.</p>}
              </div>
            )}
            {mode !== "text" && <p className="text-sm opacity-80" aria-live="polite">Recording…</p>}
            <button onClick={finishAnswer} className={k.primary} disabled={mode === "text" && !text.trim()}>
              Done
            </button>
          </div>
        )}

        {phase === "review" && result && (
          <div className="mt-5 space-y-4">
            <div className={k.panel}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">What we heard</p>
              <p className="mt-1" data-testid="transcript">
                {result.transcript.text || "No words were picked up. Your recording is still saved, and a recruiter can play it."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={submit} className={k.primary} autoFocus>
                Submit
              </button>
              {retakes < MAX_RETAKES && (
                <button onClick={retake} className={k.secondary}>
                  Retake ({MAX_RETAKES - retakes} left)
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "saving" && (
          <p className="mt-5 text-sm" role="status" aria-live="polite">
            Saving your answer…
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
