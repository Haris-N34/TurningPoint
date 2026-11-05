"use client";

import { useEffect, useRef, useState } from "react";
import { availableOptions, type GameState } from "@/lib/game/engine";
import type { DialogueNode, MapScenario } from "@/lib/game/schema";
import { sfx } from "@/lib/game/sound";
import { useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { pixelTitle } from "./fonts";
import { Portrait } from "./Portrait";
import { Kbd, Panel } from "./ui";

const SPEED = { slow: 45, normal: 25, fast: 10, instant: 0 } as const;

/** Typewriter text with a voice blip per character; Space/Enter or a click skips to the end (A0). */
export function useTypewriter(text: string, speed: keyof typeof SPEED, pitch: number) {
  const [n, setN] = useState(speed === "instant" ? text.length : 0);
  const pos = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => {
    pos.current = 0;
    if (speed === "instant") {
      setN(text.length);
      return;
    }
    setN(0);
    timer.current = setInterval(() => {
      pos.current++;
      setN(pos.current);
      if (pos.current % 2 === 0 && text[pos.current] && text[pos.current] !== " ") sfx.blip(pitch);
      if (pos.current >= text.length) clearInterval(timer.current);
    }, SPEED[speed]);
    return () => clearInterval(timer.current);
  }, [text, speed, pitch]);
  const skip = () => {
    // Stop the ticker so it can't overwrite the skip on its next tick.
    clearInterval(timer.current);
    pos.current = text.length;
    setN(text.length);
  };
  return { shown: text.slice(0, n), done: n >= text.length, skip };
}

const pitchOf = (id: string) => 300 + ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 6) * 70;

export function DialogueBox({
  scenario,
  state,
  node,
  speed,
  onChoose,
  onLeave,
}: {
  scenario: MapScenario;
  state: GameState;
  node: DialogueNode;
  speed: keyof typeof SPEED;
  onChoose: (id: "a" | "b" | "c" | "d") => void;
  onLeave: () => void;
}) {
  const [line, setLine] = useState(0);
  const lines = [...node.lines, { who: "you", text: node.prompt, expression: "neutral" as const }];
  const cur = lines[Math.min(line, lines.length - 1)];
  const isPrompt = line >= lines.length - 1;
  const speaker = cur.who === "you" ? undefined : scenario.npcs.find((n) => n.id === cur.who);
  const tw = useTypewriter(cur.text, speed, pitchOf(cur.who));
  const opts = availableOptions(node, state);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(0);

  // Players mash Enter to skip text; ignore choice activation briefly after the choices appear.
  const shownAt = useRef(0);
  useEffect(() => {
    if (isPrompt && tw.done) {
      shownAt.current = performance.now();
      btns.current[0]?.focus();
    }
  }, [isPrompt, tw.done]);
  // The picked option flashes for a beat before the box closes (no delay with reduced motion).
  const [picked, setPicked] = useState<string | null>(null);
  const reduce = useGame((g) => g.settings.reducedMotion);
  const pick = (id: "a" | "b" | "c" | "d") => {
    if (picked || performance.now() - shownAt.current < 350) return;
    if (reduce) return onChoose(id);
    setPicked(id);
    setTimeout(() => onChoose(id), 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!tw.done && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        tw.skip();
        return;
      }
      if (!isPrompt && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        sfx.click();
        setLine((l) => l + 1);
        return;
      }
      if (isPrompt && tw.done) {
        const cols = 1;
        const move = (d: number) => {
          e.preventDefault();
          const next = (focus + d + opts.length) % opts.length;
          setFocus(next);
          btns.current[next]?.focus();
        };
        if (e.key === "ArrowRight") move(1);
        else if (e.key === "ArrowLeft") move(-1);
        else if (e.key === "ArrowDown") move(cols);
        else if (e.key === "ArrowUp") move(-cols);
        else if (/^[a-d]$/i.test(e.key) && opts.some((o) => o.id === e.key.toLowerCase())) pick(e.key.toLowerCase() as "a");
        else if (e.key === "Escape") onLeave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tw, isPrompt, opts, focus, onChoose, onLeave]);

  const facing = scenario.npcs.find((n) => n.id === node.npc);
  const portraitId = speaker?.portrait ?? facing?.portrait ?? "laptop";
  // Your own lines show the person you're facing (their portrait), so name them, not "You". At the laptop it's just you.
  const tag = speaker?.name ?? (node.npc === "laptop" || !facing ? "You" : facing.name);
  const expression = cur.who === "you" ? (node.lines.at(-1)?.expression ?? "neutral") : cur.expression;

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-40 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[min(820px,94vw)] sm:-translate-x-1/2 tp-dialogue" role="dialog" aria-label={`Talking with ${node.npc === "laptop" || !facing ? "yourself" : facing.name}`} data-testid="dialogue">
      <SpeakerPlate name={tag} />
      {/* Phones: portrait beside the line, choices full width below. Desktop: everything right of the portrait. */}
      <Panel className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 p-3 pt-4 sm:gap-x-4 sm:p-4 sm:pt-5">
        <Portrait id={portraitId} expression={expression} className="row-span-1 size-16 shrink-0 self-start rounded-[4px] border-[3px] border-[#2e222f] bg-[#3b2f45] sm:row-span-4 sm:size-24" />
        <div className="contents">
          <p className="min-h-[2.75rem] cursor-pointer self-center sm:self-start text-[17px] leading-snug sm:text-[18px]" aria-live="polite" onClick={() => (tw.done ? !isPrompt && setLine((l) => l + 1) : tw.skip())} data-testid="dialogue-text">
            <span className="sr-only">{cur.text}</span>
            <span aria-hidden>{tw.shown}</span>
            {tw.done && !isPrompt && <span className="ml-1 inline-block text-[#c43d22] motion-safe:animate-bounce" aria-hidden>▼</span>}
          </p>
          {node.charts && isPrompt && tw.done && (
            <div className="col-span-2 sm:col-span-1 sm:col-start-2 mt-2 grid gap-2 sm:grid-cols-3" aria-label="Data view">
              {node.charts.map((c) => {
                const max = Math.max(...c.points.map((p) => p[1]));
                return (
                  <figure key={c.title} className="rounded-[4px] border-2 border-[#2e222f] bg-white p-2">
                    <figcaption className="text-xs font-semibold">{c.title}</figcaption>
                    <ul className="mt-1 space-y-0.5">
                      {c.points.map(([label, v]) => (
                        <li key={label} className="flex items-center gap-1 text-[11px]">
                          <span className="w-16 truncate">{label}</span>
                          <span className="h-2 bg-[#4a6fb0]" style={{ width: `${(v / max) * 60}%` }} aria-hidden />
                          <span>{v}{c.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </figure>
                );
              })}
            </div>
          )}
          {isPrompt && tw.done && (
            <div className="col-span-2 sm:col-span-1 sm:col-start-2 mt-2 flex flex-col gap-1.5" role="group" aria-label="Your choice">
              {opts.map((o, i) => (
                <button
                  key={o.id}
                  ref={(el) => {
                    btns.current[i] = el;
                  }}
                  onClick={() => pick(o.id)}
                  onFocus={() => setFocus(i)}
                  data-testid={`choice-${o.id}`}
                  data-picked={picked === o.id ? "1" : undefined}
                  className={cn(
                    picked === o.id && "!bg-[#c43d22] !text-white",
                    picked && picked !== o.id && "opacity-50",
                    "group flex min-h-10 items-center gap-2.5 rounded-[4px] border-2 border-[#2e222f] bg-white px-2 py-1 text-left text-[15px] leading-snug shadow-[inset_0_-3px_0_#e8d9b5] hover:bg-[#fff1c4] focus-visible:bg-[#ffe08a] focus-visible:outline-none sm:text-[16px]",
                  )}
                >
                  <span className={cn(pixelTitle.className, "flex size-6 shrink-0 items-center justify-center rounded-[3px] bg-[#2e222f] text-[10px] text-[#ffd166] group-focus-visible:bg-[#c43d22] group-focus-visible:text-white")}>{o.id.toUpperCase()}</span>
                  <span className="min-w-0 flex-1">{o.label}</span>
                  <span className="hidden text-[#c43d22] group-focus-visible:inline" aria-hidden>◀</span>
                </button>
              ))}
            </div>
          )}
          <div className="col-span-2 sm:col-span-1 sm:col-start-2 mt-2 flex items-center justify-between gap-2 text-[12px] text-[#6a5a4a]">
            <span className="hidden sm:inline">
              {isPrompt ? (<><Kbd>↑↓</Kbd> pick · <Kbd>Enter</Kbd> choose · or press <Kbd>A</Kbd>-<Kbd>D</Kbd></>) : (<><Kbd>Enter</Kbd> or click to continue</>)}
            </span>
            <button className="ml-auto rounded-[3px] px-1 underline underline-offset-2 hover:text-[#2e222f]" onClick={onLeave} data-testid="leave">
              Walk away
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/** The name tab that sits on the dialogue box's top edge. */
function SpeakerPlate({ name }: { name: string }) {
  return (
    <span className="absolute -top-3 left-3 z-10 rounded-[4px] border-[3px] border-[#2e222f] bg-[#c43d22] px-2.5 py-0.5 text-[14px] font-semibold leading-none text-white shadow-[0_3px_0_#2e222f] sm:left-5">
      {name}
    </span>
  );
}

/** A short reaction after a choice: portrait expression changes and the NPC says one line (A0). */
export function ReactionBox({ scenario, npc, expression, line }: { scenario: MapScenario; npc: string; expression: "neutral" | "worried" | "happy" | "angry"; line?: string }) {
  const n = scenario.npcs.find((x) => x.id === npc);
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-40 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[min(820px,94vw)] sm:-translate-x-1/2 tp-dialogue" data-testid="reaction">
      <SpeakerPlate name={n?.name ?? "You"} />
      <Panel className="flex items-center gap-3 p-3 pt-4 sm:gap-4 sm:p-4 sm:pt-5">
        <Portrait id={n?.portrait ?? "laptop"} expression={expression} className="size-16 shrink-0 rounded-[4px] border-[3px] border-[#2e222f] bg-[#3b2f45] sm:size-24" />
        <p className="text-[17px] sm:text-[18px]">{line ?? "…"}</p>
      </Panel>
    </div>
  );
}
