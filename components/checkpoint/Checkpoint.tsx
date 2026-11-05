"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Portrait } from "@/components/game2/Portrait";
import type { CardCheckpoint } from "@/lib/card/types";
import { UNSUPPORTED_MESSAGE } from "@/lib/checkpoint/speech";
import { MAX_RETAKES, timing, type CheckpointKind } from "@/lib/checkpoint/timing";
import { applyCorrection, fromTyping } from "@/lib/checkpoint/transcript";
import { cameraCheck, media } from "@/lib/store/media";
import { cn } from "@/lib/utils";
import { Captions, MicMeter, PanelPortrait, Ring, TypedQuestion, useQuiet } from "./parts";
import { speechSupported, useRecorder, type DeviceError, type Mode, type Recording } from "./useRecorder";

export type IntegrityNote = { checkpointId: string; kind: "focus_lost" | "retake_used"; detail: string };
export type CheckpointResult = { checkpoint: CardCheckpoint; integrity: IntegrityNote[] };

/** Who asks the question in the game: a character's portrait, or the hiring panel. */
export type Interviewer = { name: string; role?: string; portrait?: string };

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
  /** "game": a short live video interview in the game's pixel style, with a one-time camera check (A.7). */
  variant?: "page" | "game";
  interviewer?: Interviewer;
};

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

const hasVideo = (s: MediaStream | null) => !!s?.getVideoTracks().some((t) => t.readyState === "live");

/** Calm, plain-words note when a device can't start. Never an error tone: other ways to answer are fine. */
function deviceNote(wanted: Mode, got: Mode, err: DeviceError | null) {
  const what = wanted === "video" ? "camera" : "microphone";
  const why = err === "denied" ? `The browser didn't allow the ${what}.` : err === "missing" ? `We couldn't find a ${what}.` : err === "busy" ? `Another app may be using the ${what}.` : `We couldn't start the ${what}.`;
  return `${why} This one is set to ${got}, which counts exactly the same. You can switch any time.`;
}

function useStyles(pixel: boolean) {
  return {
    card: pixel
      ? "rounded-[6px] border-[3px] border-[#2e222f] bg-[#fff8e7] text-[#2e222f] shadow-[inset_0_-4px_0_#e8d9b5,0_4px_0_#2e222f]"
      : "rounded-3xl bg-background text-foreground shadow-2xl",
    primary: pixel
      ? "min-h-11 rounded-[4px] border-[3px] border-[#2e222f] bg-[#c43d22] px-4 py-1.5 font-semibold text-white shadow-[inset_0_-3px_0_#9c2c18] hover:bg-[#b5371e] active:translate-y-0.5 disabled:opacity-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#2e222f]"
      : "rounded-full bg-foreground px-5 py-2.5 font-medium text-background disabled:opacity-50",
    plain: pixel
      ? "min-h-11 rounded-[4px] border-[3px] border-[#2e222f] bg-white px-4 py-1.5 font-semibold text-[#2e222f] shadow-[inset_0_-3px_0_#e0cfa6] active:translate-y-0.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#2e222f]"
      : "rounded-full border px-5 py-2.5 font-medium",
    chip: (on: boolean) =>
      pixel
        ? cn("cursor-pointer rounded-[4px] border-2 border-[#2e222f] px-3 py-1.5 text-sm font-semibold capitalize has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[#2e222f]", on ? "bg-[#2e222f] text-[#fff8e7]" : "bg-white")
        : cn("cursor-pointer rounded-full border px-4 py-2 text-sm capitalize has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary", on ? "bg-foreground text-background" : ""),
    well: pixel ? "rounded-[4px] border-2 border-[#2e222f] bg-white" : "rounded-2xl bg-black/[.04] dark:bg-white/[.06]",
    label: pixel ? "text-xs font-semibold uppercase tracking-widest text-[#9c2c18]" : "text-xs font-semibold uppercase tracking-widest text-primary",
    field: pixel ? "rounded-[4px] border-2 border-[#2e222f] bg-white p-3" : "rounded-2xl border p-3",
    note: "text-sm",
  };
}

export function Checkpoint(p: Props) {
  const game = p.variant === "game";
  const s = useStyles(game);
  const t = timing(p.kind, p.multiplier);
  const checked = game && !p.textOnly ? cameraCheck.get(p.attemptId) : undefined;
  const [mode, setModeState] = useState<Mode>(p.textOnly ? "text" : game ? (checked ?? "video") : p.defaultMode);
  const [phase, setPhase] = useState<Phase>("think");
  // First in-game checkpoint of a run doubles as the camera check (A.7).
  const [firstCheck] = useState(game && !p.textOnly && !checked);
  // The think timer waits until the camera or mic has started (or we fell back), so a permission prompt never eats it.
  const [settled, setSettled] = useState(mode === "text");
  const [retakes, setRetakes] = useState(0);
  const [result, setResult] = useState<Recording | null>(null);
  const [text, setText] = useState("");
  const [fixed, setFixed] = useState("");
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [deviceMsg, setDeviceMsg] = useState<string | null>(null);
  const wordTimes = useRef<number[]>([]);
  const answerStart = useRef(0);
  const focusLostMs = useRef(0);
  const blurAt = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const r = useRecorder();
  const quietS = useQuiet(r.level, phase === "answer" && mode !== "text");

  const setMode = (m: Mode) => {
    setModeState(m);
    if (game && !p.textOnly) cameraCheck.set(p.attemptId, m);
    p.onModeChange?.(m);
  };

  // Warm up devices during the think window so the answer starts instantly.
  useEffect(() => {
    if (phase !== "think") return;
    if (mode === "text") {
      r.release();
      setSettled(true);
      return;
    }
    const st = r.stream;
    if (st && (mode === "video" ? hasVideo(st) : !hasVideo(st))) return setSettled(true); // already the right devices
    r.release();
    setSettled(false);
    let alive = true;
    const settle = () => {
      if (!alive) return;
      setSettled(true);
      if (firstCheck) cameraCheck.set(p.attemptId, mode);
    };
    r.prepare(mode).then(async (got) => {
      if (!alive) return;
      if (got) return settle();
      // No dead end (C1.3, A1): camera missing means try voice, mic missing means text. Calm, not an error.
      const why = r.getError();
      if (mode === "video") {
        const voice = await r.prepare("voice");
        if (!alive) return;
        if (voice) {
          setDeviceMsg(deviceNote("video", "voice", why));
          setModeState("voice");
          return;
        }
      }
      setDeviceMsg(deviceNote(mode, "text", why));
      setModeState("text");
    });
    // Never hold the timer forever: an unanswered permission prompt releases it after 20 seconds.
    const cap = setTimeout(() => alive && setSettled(true), 20_000);
    return () => {
      alive = false;
      clearTimeout(cap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase]);

  useEffect(() => {
    if (videoRef.current && r.stream) videoRef.current.srcObject = r.stream;
  }, [r.stream, phase, mode]);

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
    let st = r.stream;
    if (m !== "text" && !st) {
      st = await r.prepare(m);
      const why = r.getError();
      if (!st && m === "video") {
        st = await r.prepare("voice");
        if (st) m = "voice";
      }
      if (!st) m = "text";
      if (m !== mode) {
        setDeviceMsg(deviceNote(mode, m, why));
        setModeState(m);
      }
    }
    answerStart.current = performance.now();
    wordTimes.current = [];
    setText("");
    setFixed("");
    setResult(null);
    if (m !== "text" && st) r.start(st);
    setPhase("answer");
  }, [mode, r]);

  const finishAnswer = useCallback(async () => {
    if (mode === "text") {
      setResult({ durationS: +((performance.now() - answerStart.current) / 1000).toFixed(2), transcript: fromTyping(text, wordTimes.current) });
    } else {
      const rec = await r.stop();
      setResult(rec);
      setFixed(rec.transcript.text);
    }
    setPhase("review");
  }, [mode, r, text]);

  const thinkLeft = useCountdown(t.thinkS, phase === "think" && settled, () => void beginAnswer());
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
    const transcript = mode === "text" ? result.transcript : applyCorrection(result.transcript, fixed, result.durationS);
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
        transcript,
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

  const blockPaste = (e: React.ClipboardEvent | React.DragEvent) => {
    e.preventDefault();
    if (e.type === "paste") setPasteBlocked(true);
  };

  const label = p.title ?? (p.kind === "real_life" ? "Real-life checkpoint" : p.kind === "follow_up" ? "One follow-up" : "Checkpoint");
  const recording = phase === "answer" && mode !== "text";

  const modePicker = (
    <fieldset>
      <legend className="text-sm font-medium">Answer by</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
        {(["video", "voice", "text"] as Mode[]).map((m) => (
          <label key={m} className={cn(s.chip(mode === m), p.textOnly && m !== "text" && "opacity-40")}>
            <input type="radio" name={`mode-${p.id}`} className="sr-only" value={m} checked={mode === m} disabled={p.textOnly && m !== "text"} onChange={() => (setDeviceMsg(null), setMode(m))} />
            {m}
          </label>
        ))}
      </div>
    </fieldset>
  );

  /** The candidate's side: camera preview, or mic meter, plus live captions while answering. */
  const you = (
    <div className="space-y-2" data-testid="you-panel">
      {phase === "think" && game && (
        <p className="text-sm" data-testid="camera-check" role="status">
          {!settled
            ? `Starting your ${mode === "video" ? "camera" : "microphone"}. The timer starts once it's on.`
            : firstCheck && mode === "video"
              ? "Camera check: this is how you'll appear. Only your words are scored, never your face or voice."
              : "You"}
        </p>
      )}
      {mode === "video" && (
        <div className={cn("relative aspect-video h-32 max-w-full overflow-hidden bg-black sm:h-auto sm:w-full", game ? "rounded-[4px] border-[3px] border-[#2e222f]" : "rounded-2xl")}>
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-label="Your camera preview" data-testid="camera-preview" />
          {!hasVideo(r.stream) && <p className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm text-white/80">Starting your camera…</p>}
          {recording && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-[3px] bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-[#e04a2f] motion-safe:animate-pulse" aria-hidden /> REC
            </span>
          )}
        </div>
      )}
      {mode === "voice" && (
        <div className={cn("flex h-24 w-full flex-col sm:aspect-video sm:h-auto sm:max-h-40 items-center justify-center gap-2", s.well)}>
          <span className="text-3xl" aria-hidden>
            🎙️
          </span>
          <p className="text-sm">{recording ? "Recording your voice" : "Voice only, no camera"}</p>
        </div>
      )}
      {mode !== "text" && <MicMeter level={r.level} pixel={game} />}
      {phase === "think" && game && mode === "video" && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs">Rather not be on camera?</span>
          <button className={cn(s.plain, "min-h-8 px-2 py-0 text-sm")} onClick={() => (setDeviceMsg(null), setMode("voice"))} data-testid="switch-voice">
            Voice instead
          </button>
          <button className={cn(s.plain, "min-h-8 px-2 py-0 text-sm")} onClick={() => (setDeviceMsg(null), setMode("text"))} data-testid="switch-text">
            Text instead
          </button>
        </div>
      )}
      {recording && quietS > 5 && (
        <p className="text-xs" role="status" data-testid="quiet-hint">
          We can&apos;t hear much. Move closer to the mic, or check it isn&apos;t muted.
        </p>
      )}
      {recording && <Captions heard={r.heard} interim={r.interim} speech={r.speech} pixel={game} />}
    </div>
  );

  const interviewerSide = game && (
    <div className="flex items-start gap-3" data-testid="interviewer">
      <div className="shrink-0">
        {p.interviewer?.portrait ? (
          <Portrait id={p.interviewer.portrait} className="h-12 w-12 sm:h-24 sm:w-24 rounded-[4px] border-[3px] border-[#2e222f]" />
        ) : (
          <PanelPortrait className="h-12 w-12 sm:h-24 sm:w-24 rounded-[4px] border-[3px] border-[#2e222f]" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{p.interviewer?.name ?? "Hiring panel"}</p>
        <p className="text-xs opacity-80">{p.interviewer?.role ?? "Asking about the choice you just made"}</p>
      </div>
    </div>
  );

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-testid="checkpoint"
      data-phase={phase}
      data-mode={mode}
      data-variant={game ? "game" : "page"}
      className={cn("fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6", game ? "bg-[#2e222f]/80" : "bg-black/50 backdrop-blur-md")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className={cn("w-full max-h-[95svh] overflow-y-auto p-4 sm:p-6 outline-none", game ? "max-w-4xl" : "max-w-xl", s.card)}
        initial={{ y: game ? 24 : 60, opacity: 0, scale: game ? 0.96 : 1 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={game ? { type: "spring", stiffness: 380, damping: 26 } : { type: "spring", stiffness: 200, damping: 24 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={s.label}>{game ? `Live interview · ${label}` : label}</p>
            {!game && (
              <div className="mt-2">
                <TypedQuestion text={p.question} />
              </div>
            )}
          </div>
          {phase === "think" && <Ring left={thinkLeft} total={t.thinkS} label="Think time" pixel={game} />}
          {phase === "answer" && <Ring left={answerLeft} total={t.answerS} label="Answer time" pixel={game} />}
        </div>

        {game && (
          <div className={cn("mt-3 grid gap-4", (phase === "think" || phase === "answer") && "sm:grid-cols-2")}>
            <div className="space-y-3">
              {interviewerSide}
              <div className={cn("relative p-3", s.well)}>
                <TypedQuestion text={p.question} className="text-base sm:text-lg" />
              </div>
            </div>
            {(phase === "think" || phase === "answer") && <div className="space-y-3">{mode !== "text" ? you : phase === "think" ? <TextNote /> : null}</div>}
          </div>
        )}

        {phase === "think" && (
          <div className="mt-5 space-y-4">
            <p className="text-sm opacity-80">
              Take {t.thinkS} seconds to think. You then have {t.answerS} seconds.{firstCheck && mode === "video" ? "" : " Only your words are used, never your face or voice."}
            </p>
            {modePicker}
            {mode !== "text" && !speechSupported() && (
              <p className="text-sm" role="note" data-testid="speech-unsupported">
                {UNSUPPORTED_MESSAGE}
              </p>
            )}
            {!game && mode !== "text" && <MicMeter level={r.level} />}
            {deviceMsg && (
              <p className="text-sm" role="status" data-testid="device-note">
                {deviceMsg}
              </p>
            )}
            <button onClick={() => void beginAnswer()} className={s.primary} autoFocus>
              I&apos;m ready, start answering
            </button>
          </div>
        )}

        {phase === "answer" && (
          <div className="mt-5 space-y-4">
            {!game && mode !== "text" && you}
            {mode === "text" && (
              <div>
                <label htmlFor={`ans-${p.id}`} className="text-sm font-medium">
                  Your answer
                </label>
                <textarea
                  id={`ans-${p.id}`}
                  data-testid="answer-text"
                  autoFocus
                  value={text}
                  onChange={(e) => onType(e.target.value)}
                  onPaste={blockPaste}
                  onDrop={blockPaste}
                  rows={5}
                  className={cn("mt-1 w-full", s.field)}
                />
                {pasteBlocked && (
                  <p className="text-sm" role="status">
                    Paste is off for checkpoints. Type your answer.
                  </p>
                )}
              </div>
            )}
            {deviceMsg && (
              <p className="text-sm" role="status" data-testid="device-note">
                {deviceMsg}
              </p>
            )}
            <button onClick={finishAnswer} className={s.primary} disabled={mode === "text" && !text.trim()} autoFocus={mode !== "text"}>
              Done
            </button>
          </div>
        )}

        {phase === "review" && result && (
          <div className="mt-5 space-y-4">
            {mode === "text" ? (
              <div className={cn("p-4", s.well)}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Your answer</p>
                <p className="mt-1" data-testid="transcript">
                  {result.transcript.text}
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor={`fix-${p.id}`} className="text-sm font-medium">
                  What we heard
                </label>
                <p className="text-xs opacity-80" id={`fix-help-${p.id}`}>
                  {result.transcript.text
                    ? "Fix any words we misheard. These words are what is scored, never your face or voice."
                    : "We didn't catch any words. Type what you said so your answer counts. Your recording is saved either way."}
                </p>
                <textarea
                  id={`fix-${p.id}`}
                  aria-describedby={`fix-help-${p.id}`}
                  data-testid="transcript"
                  value={fixed}
                  onChange={(e) => setFixed(e.target.value)}
                  onPaste={blockPaste}
                  onDrop={blockPaste}
                  rows={4}
                  className={cn("mt-1 w-full", s.field)}
                />
                {pasteBlocked && (
                  <p className="text-sm" role="status">
                    Paste is off for checkpoints. Type your answer.
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={submit} className={s.primary} autoFocus>
                Submit
              </button>
              {retakes < MAX_RETAKES && (
                <button onClick={retake} className={s.plain}>
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

function TextNote() {
  return (
    <div className="rounded-[4px] border-2 border-[#2e222f] bg-white p-3 text-sm">
      <p className="font-semibold">Answering in text</p>
      <p className="mt-1">You type your answer. It counts exactly the same as video or voice.</p>
    </div>
  );
}
