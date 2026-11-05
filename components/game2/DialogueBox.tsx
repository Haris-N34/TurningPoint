"use client";

import { useEffect, useRef, useState } from "react";
import { availableOptions, type GameState } from "@/lib/game/engine";
import type { DialogueNode, MapScenario } from "@/lib/game/schema";
import { sfx } from "@/lib/game/sound";
import { cn } from "@/lib/utils";
import { Portrait } from "./Portrait";
import { Panel } from "./ui";

const SPEED = { slow: 45, normal: 25, fast: 10, instant: 0 } as const;

/** Typewriter text with a voice blip per character; Space/Enter or a click skips to the end (A0). */
export function useTypewriter(text: string, speed: keyof typeof SPEED, pitch: number) {
  const [n, setN] = useState(speed === "instant" ? text.length : 0);
  useEffect(() => {
    if (speed === "instant") return setN(text.length);
    setN(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setN(i);
      if (i % 2 === 0 && text[i] && text[i] !== " ") sfx.blip(pitch);
      if (i >= text.length) clearInterval(t);
    }, SPEED[speed]);
    return () => clearInterval(t);
  }, [text, speed, pitch]);
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => setN(text.length) };
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

  useEffect(() => {
    if (isPrompt && tw.done) btns.current[0]?.focus();
  }, [isPrompt, tw.done]);

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
        const cols = 2;
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
        else if (/^[a-d]$/i.test(e.key) && opts.some((o) => o.id === e.key.toLowerCase())) onChoose(e.key.toLowerCase() as "a");
        else if (e.key === "Escape") onLeave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tw, isPrompt, opts, focus, onChoose, onLeave]);

  const portraitId = speaker?.portrait ?? scenario.npcs.find((n) => n.id === node.npc)?.portrait ?? "laptop";
  const expression = cur.who === "you" ? (node.lines.at(-1)?.expression ?? "neutral") : cur.expression;

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-40 sm:inset-x-auto sm:left-1/2 sm:w-[min(760px,94vw)] sm:-translate-x-1/2" role="dialog" aria-label={`Talking with ${speaker?.name ?? "yourself"}`} data-testid="dialogue">
      <Panel className="flex gap-3 p-3 sm:p-4">
        <div className="hidden shrink-0 flex-col items-center sm:flex">
          <Portrait id={portraitId} expression={expression} className="size-24 rounded-[4px] border-[3px] border-[#2e222f] bg-[#3b2f45]" />
          <span className="mt-1 rounded-[3px] bg-[#2e222f] px-2 text-xs font-semibold text-[#fff8e7]">{speaker?.name ?? (cur.who === "you" ? "You" : "")}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9c2c18] sm:hidden">{speaker?.name ?? "You"}</p>
          <p className="min-h-[3.25rem] text-[17px] leading-snug" aria-live="polite" onClick={() => (tw.done ? !isPrompt && setLine((l) => l + 1) : tw.skip())} data-testid="dialogue-text">
            <span className="sr-only">{cur.text}</span>
            <span aria-hidden>{tw.shown}</span>
            {tw.done && !isPrompt && <span className="ml-1 inline-block animate-bounce" aria-hidden>▼</span>}
          </p>
          {node.charts && isPrompt && tw.done && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3" aria-label="Data view">
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
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-label="Your choice">
              {opts.map((o, i) => (
                <button
                  key={o.id}
                  ref={(el) => {
                    btns.current[i] = el;
                  }}
                  onClick={() => onChoose(o.id)}
                  onFocus={() => setFocus(i)}
                  data-testid={`choice-${o.id}`}
                  className={cn(
                    "flex min-h-11 items-start gap-2 rounded-[4px] border-[3px] border-[#2e222f] bg-white px-2 py-1.5 text-left text-[15px] leading-snug shadow-[inset_0_-3px_0_#e0cfa6] hover:bg-[#fff1c4] focus-visible:bg-[#ffe08a] focus-visible:outline-none",
                  )}
                >
                  <span className="mt-0.5 shrink-0 rounded-[3px] bg-[#2e222f] px-1.5 text-xs font-bold text-[#ffd166]">{o.id.toUpperCase()}</span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex justify-between text-[11px] text-[#6a5a4a]">
            <span>{isPrompt ? "Arrows to pick, Enter to choose" : "Enter or click to continue"}</span>
            <button className="underline" onClick={onLeave} data-testid="leave">
              Walk away
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/** A short reaction after a choice: portrait expression changes and the NPC says one line (A0). */
export function ReactionBox({ scenario, npc, expression, line }: { scenario: MapScenario; npc: string; expression: "neutral" | "worried" | "happy" | "angry"; line?: string }) {
  const n = scenario.npcs.find((x) => x.id === npc);
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-40 sm:inset-x-auto sm:left-1/2 sm:w-[min(760px,94vw)] sm:-translate-x-1/2" data-testid="reaction">
      <Panel className="flex items-center gap-3 p-3">
        <Portrait id={n?.portrait ?? "laptop"} expression={expression} className="size-16 rounded-[4px] border-[3px] border-[#2e222f] bg-[#3b2f45]" />
        <p className="text-[17px]">{line ?? "…"}</p>
      </Panel>
    </div>
  );
}
