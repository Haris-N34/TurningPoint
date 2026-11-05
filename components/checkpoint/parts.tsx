"use client";

import { useEffect, useRef, useState } from "react";
import { pixelTitle } from "@/components/game2/fonts";
import { UNSUPPORTED_MESSAGE } from "@/lib/checkpoint/speech";
import { cn } from "@/lib/utils";
import type { SpeechState } from "./useRecorder";

export function Ring({
  left,
  total,
  label,
  caption,
  pixel,
}: {
  left: number;
  total: number;
  label: string;
  caption: string;
  pixel?: boolean;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <div
        className="relative h-16 w-16"
        role="timer"
        aria-label={`${label}: ${Math.ceil(left)} seconds left`}
      >
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            strokeWidth="5"
            className={
              pixel
                ? "stroke-[#e8d9b5]"
                : "stroke-black/10 dark:stroke-white/10"
            }
          />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            strokeWidth={pixel ? 6 : 5}
            strokeLinecap={pixel ? "butt" : "round"}
            className={cn(
              "transition-[stroke-dashoffset] duration-200",
              pixel ? "stroke-[#c43d22]" : "stroke-orange-600",
            )}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - left / total)}
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center font-semibold tabular-nums", pixel ? cn(pixelTitle.className, "text-[12px]") : "text-sm")}>
          {Math.ceil(left)}
        </span>
      </div>
      {/* The total, so it matches "Take 15 seconds" while the ring counts down. */}
      <span className={cn("font-semibold", pixel ? cn(pixelTitle.className, "text-[9px]") : "text-xs")} data-testid="timer-label">
        {caption}
      </span>
    </div>
  );
}

/**
 * The question, shown in full at once (no typewriter, never cut off). In the game, the option letter in
 * "You chose B, ..." is drawn as the same badge as the A-D choices, so B never reads as 8.
 */
export function TypedQuestion({
  text,
  className,
  pixel,
}: {
  text: string;
  className?: string;
  pixel?: boolean;
}) {
  const m = pixel ? /^You chose ([A-D])\b/.exec(text) : null;
  return (
    <h2
      className={cn(
        "text-xl sm:text-2xl font-semibold leading-snug",
        className,
      )}
      aria-label={text}
      data-testid="checkpoint-question"
    >
      {m ? (
        <span aria-hidden>
          You chose{" "}
          <span
            data-testid="choice-letter"
            className={cn(
              pixelTitle.className,
              "mx-0.5 inline-flex size-6 -translate-y-0.5 items-center justify-center rounded-[3px] bg-[#2e222f] align-middle text-[11px] text-[#ffd166]",
            )}
          >
            {m[1]}
          </span>
          {text.slice(m[0].length)}
        </span>
      ) : (
        <span aria-hidden>{text}</span>
      )}
    </h2>
  );
}

/** Live mic level so the candidate can see we hear them. Loudness only, never stored or scored. */
export function MicMeter({ level, pixel }: { level: number; pixel?: boolean }) {
  const bars = 12;
  const on = Math.round(Math.min(1, level) * bars);
  return (
    <div
      className="flex items-center gap-2"
      data-testid="mic-meter"
      data-level={level.toFixed(2)}
    >
      <span className="text-xs font-semibold" aria-hidden>
        Mic
      </span>
      <div
        role="meter"
        aria-label="Microphone level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="flex h-4 items-end gap-[3px]"
      >
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-1.5",
              pixel ? "rounded-none" : "rounded-sm",
              i < on
                ? i > bars * 0.8
                  ? "bg-[#c43d22]"
                  : "bg-[#3a7d44]"
                : pixel
                  ? "bg-[#e8d9b5]"
                  : "bg-black/10 dark:bg-white/15",
            )}
            style={{ height: `${6 + (i / bars) * 10}px` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Seconds since the mic was last clearly picking something up. */
export function useQuiet(level: number, running: boolean) {
  const last = useRef(0);
  const [quietS, setQuietS] = useState(0);
  useEffect(() => {
    last.current = performance.now();
    setQuietS(0);
    if (!running) return;
    const t = setInterval(
      () => setQuietS((performance.now() - last.current) / 1000),
      500,
    );
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (level > 0.06) last.current = performance.now();
  }, [level]);
  return quietS;
}

/** What speech to text has heard so far, with the words still being worked out shown lighter. */
export function Captions({
  heard,
  interim,
  speech,
  pixel,
}: {
  heard: string;
  interim: string;
  speech: SpeechState;
  pixel?: boolean;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [heard, interim]);
  const status =
    speech.kind === "listening"
      ? "Listening. Your words appear below as you speak."
      : speech.kind === "error"
        ? speech.message
        : speech.kind === "unsupported"
          ? UNSUPPORTED_MESSAGE
          : "";
  return (
    <div className="space-y-1">
      <p
        className="text-xs"
        role="status"
        data-testid="speech-status"
        data-speech={speech.kind}
      >
        {status}
      </p>
      {speech.kind !== "unsupported" && (
        <div
          ref={box}
          data-testid="live-captions"
          aria-label="Live captions"
          className={cn(
            "max-h-24 min-h-12 overflow-y-auto p-2 text-sm",
            pixel
              ? "rounded-[4px] border-2 border-[#2e222f] bg-white"
              : "rounded-xl bg-black/[.04] dark:bg-white/[.06]",
          )}
        >
          {heard || interim ? (
            <>
              <span>{heard}</span>{" "}
              <span className="opacity-60" data-testid="interim">
                {interim}
              </span>
            </>
          ) : (
            <span className="opacity-60">
              {speech.kind === "listening"
                ? "Start talking. We'll show your words here."
                : "No words yet."}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Three interviewers behind a desk, drawn as pixels. Used when no character is involved. */
export function PanelPortrait({ className }: { className?: string }) {
  const px = (x: number, y: number, w: number, h: number, fill: string) => (
    <rect x={x} y={y} width={w} height={h} fill={fill} />
  );
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("[image-rendering:pixelated]", className)}
      shapeRendering="crispEdges"
      role="img"
      aria-label="The hiring panel: three interviewers at a desk"
    >
      {px(0, 0, 32, 32, "#3e6b8a")}
      {px(0, 22, 32, 10, "#8a5a3b")}
      {px(0, 22, 32, 2, "#a8744f")}
      {/* left */}
      {px(3, 9, 6, 6, "#e0b48c")}
      {px(3, 8, 6, 2, "#2e222f")}
      {px(2, 15, 8, 7, "#5b3b6b")}
      {px(4, 11, 1, 1, "#2e222f")}
      {px(7, 11, 1, 1, "#2e222f")}
      {/* middle */}
      {px(13, 6, 6, 7, "#8d5a3c")}
      {px(12, 5, 8, 3, "#1c1418")}
      {px(12, 13, 8, 9, "#c43d22")}
      {px(14, 9, 1, 1, "#1c1418")}
      {px(17, 9, 1, 1, "#1c1418")}
      {px(15, 11, 2, 1, "#5e3424")}
      {/* right */}
      {px(23, 9, 6, 6, "#f1c9a5")}
      {px(23, 8, 6, 2, "#c98b2a")}
      {px(22, 15, 8, 7, "#2f6b4a")}
      {px(24, 11, 1, 1, "#2e222f")}
      {px(27, 11, 1, 1, "#2e222f")}
      {/* papers */}
      {px(6, 23, 5, 2, "#fff8e7")}
      {px(20, 23, 4, 2, "#fff8e7")}
    </svg>
  );
}

/** A number in the game's title font: in the pixel body font 5 reads as S and 8 as B. */
export function Num({ children, pixel }: { children: React.ReactNode; pixel?: boolean }) {
  return pixel ? <span className={cn(pixelTitle.className, "text-[0.75em]")}>{children}</span> : <>{children}</>;
}
