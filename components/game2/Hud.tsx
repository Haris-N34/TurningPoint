"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { openIssues, type GameState } from "@/lib/game/engine";
import type { Issue, MapScenario } from "@/lib/game/schema";
import { useGame } from "@/lib/game/store";
import { dayProgress, formatDuration, formatTime } from "@/lib/game/time";
import { cn } from "@/lib/utils";
import { pixelTitle } from "./fonts";
import { Panel, PixelButton } from "./ui";

const SEV = {
  high: { label: "Urgent", bar: "bg-[#c43d22]" },
  medium: { label: "Soon", bar: "bg-[#e0a32e]" },
  low: { label: "Minor", bar: "bg-[#4f9d69]" },
} as const;

function Bar({ label, value, max, colour, testid, display }: { label: string; value: number; max: number; colour: string; testid: string; display: string }) {
  const all = useGame((g) => g.floaters);
  const floaters = all.filter((f) => f.key === testid);
  return (
    <div className="relative" data-testid={testid}>
      <div className="flex items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span>{label}</span>
        <motion.span key={display} initial={{ scale: 1.4, color: "#c43d22" }} animate={{ scale: 1, color: "#2e222f" }} className={cn(pixelTitle.className, "text-[10px]")}>
          {display}
        </motion.span>
      </div>
      <div className="mt-0.5 h-2.5 overflow-hidden rounded-[2px] border-2 border-[#2e222f] bg-[#e8d9b5]" aria-hidden>
        <motion.div className="h-full" style={{ backgroundColor: colour }} initial={false} animate={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} transition={{ type: "spring", stiffness: 90, damping: 16 }} />
      </div>
      <AnimatePresence>
        {floaters.map((f) => (
          <motion.span
            key={f.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -18 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.9 }}
            className={cn("absolute left-full top-0 ml-3 whitespace-nowrap rounded-[3px] border-2 border-[#2e222f] px-1.5 text-[13px] font-bold", f.tone === "good" ? "bg-[#4f9d69] text-white" : f.tone === "bad" ? "bg-[#c43d22] text-white" : "bg-white")}
            data-testid="floater"
          >
            {f.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Resources({ scenario, state }: { scenario: MapScenario; state: GameState }) {
  const trustAvg = Math.round(Object.values(state.trust).reduce((a, b) => a + b, 0) / Object.values(state.trust).length);
  const start = state.tp.budgetBefore ?? scenario.resources.budget.start;
  return (
    <Panel className="w-[min(220px,40vw)] space-y-1 px-2 py-1.5" data-testid="resources">
      <Bar label="Budget" value={state.budget} max={Math.max(start, 1)} colour="#e0a32e" testid="res-budget" display={`$${state.budget.toLocaleString("en-CA")}`} />
      <Bar label="Morale" value={state.morale} max={100} colour="#4f9d69" testid="res-morale" display={String(state.morale)} />
      <Bar label="Trust" value={trustAvg} max={100} colour="#4a6fb0" testid="res-trust" display={String(trustAvg)} />
    </Panel>
  );
}

export function Clock({ state, turnBased }: { state: GameState; turnBased: boolean }) {
  const p = dayProgress(state.t);
  const daysLeft = Math.max(0, 5 - Math.floor(state.t / 1440));
  return (
    <Panel className="px-2 py-1.5 text-center sm:px-3" data-testid="clock" aria-live="polite" aria-label={`Game time ${formatTime(state.t)}, ${daysLeft} days left`}>
      <p className={cn(pixelTitle.className, "whitespace-nowrap text-[12px] leading-none sm:text-[13px]")} data-testid="clock-time">{formatTime(state.t)}</p>
      {/* Day progress as a pixel bar: gold through the day, red in the evening. */}
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[1px] bg-[#e8d9b5]" aria-hidden>
        <div className="h-full" style={{ width: `${Math.round(p * 100)}%`, backgroundColor: p > 0.75 ? "#c43d22" : "#e0a32e" }} />
      </div>
      <p className="mt-1 whitespace-nowrap text-[11px] font-semibold uppercase leading-none tracking-wide text-[#6a5a4a]">
        {daysLeft} days left{turnBased && <span className="text-[#4a6fb0]" data-testid="turn-based"> · Turn-based</span>}
      </p>
    </Panel>
  );
}

export function Toasts() {
  const toasts = useGame((g) => g.toasts);
  // Phones: under the HUD. Tablets and small laptops: bottom left, clear of the issue list. Desktop: under the clock.
  return (
    <div className="pointer-events-none absolute left-1/2 top-[7.5rem] z-30 flex w-[92vw] -translate-x-1/2 flex-col items-center gap-1 sm:bottom-4 sm:left-4 sm:top-auto sm:w-[min(380px,50vw)] sm:translate-x-0 sm:items-start lg:bottom-auto lg:left-1/2 lg:top-[4.75rem] lg:w-[380px] lg:-translate-x-1/2 lg:items-center" aria-live="polite">
      <AnimatePresence>
        {toasts.slice(-2).map((t) => (
          <motion.div key={t.id} layout initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
            <Panel tone="ink" className="flex items-center gap-2 px-2.5 py-1 text-[14px] font-semibold" data-testid="toast">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[3px] bg-[#ffd166] text-[12px] font-bold text-[#2e222f]" aria-hidden>!</span>
              {t.text}
            </Panel>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function IssueTracker({
  scenario,
  state,
  onGo,
  onDelegate,
  onDefer,
  onWait,
}: {
  scenario: MapScenario;
  state: GameState;
  onGo: (i: Issue) => void;
  onDelegate: (i: Issue, to: string) => void;
  onDefer: (i: Issue, reason: string) => void;
  onWait: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [menu, setMenu] = useState<{ id: string; kind: "delegate" | "defer" } | null>(null);
  const issues = openIssues(scenario, state).sort((a, b) => (state.issues[a.id].deadline ?? 0) - (state.issues[b.id].deadline ?? 0));
  const volunteers = scenario.npcs.filter((n) => n.volunteer);
  const urgent = issues.filter((i) => i.severity === "high").length;
  // Issues that appeared in the last game hour get a "New" tag so fresh trouble is easy to spot.
  const fresh = new Set(state.events.filter((e) => e.kind === "spawned" && state.t - e.t < 60).map((e) => e.issue));
  return (
    <Panel className="w-full p-1.5 sm:w-[300px]" data-testid="issue-tracker">
      <div className="flex items-center gap-1.5">
        <button className="flex min-h-8 flex-1 items-center gap-2 rounded-[3px] px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c43d22]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={cn(pixelTitle.className, "text-[10px] uppercase")}>Issues</span>
          <span className="rounded-[3px] bg-[#2e222f] px-1.5 text-[12px] font-bold text-[#ffd166]">{issues.length}</span>
          {urgent > 0 && <span className="text-[12px] font-semibold text-[#c43d22]">{urgent} urgent</span>}
          <span className="ml-auto text-[12px]" aria-hidden>{open ? "▾" : "▸"}</span>
        </button>
        <PixelButton tone="plain" size="sm" className="shrink-0" onClick={onWait} data-testid="wait" title="Let time pass until something happens">
          Wait ▸▸
        </PixelButton>
      </div>
      {open && (
        <ul className="mt-1.5 max-h-[30svh] space-y-1.5 overflow-y-auto overscroll-contain sm:max-h-[max(7.5rem,calc(100svh-19rem))]">
          {issues.map((i) => {
            const st = state.issues[i.id];
            const left = (st.deadline ?? state.t) - state.t;
            const npc = scenario.npcs.find((n) => n.id === i.npc)!;
            const sev = SEV[i.severity];
            const tried = (st.delegate ?? []).map((d) => d.to);
            return (
              <li key={i.id} className="overflow-hidden rounded-[4px] border-2 border-[#2e222f] bg-white" data-testid={`issue-${i.id}`}>
                <div className="flex items-stretch">
                  <span className={cn("w-1.5 shrink-0", sev.bar)} aria-hidden />
                  <div className="min-w-0 flex-1 px-2 py-1">
                    <p className="text-[14px] font-semibold leading-tight">
                      <span className="sr-only">{sev.label}: </span>
                      {fresh.has(i.id) && <span className="mr-1 inline-block -translate-y-px rounded-[3px] bg-[#ffd166] px-1 align-middle text-[10px] font-bold uppercase leading-[14px] tracking-wide text-[#2e222f]">New</span>}
                      {i.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] leading-tight text-[#6a5a4a]">
                      <span>{npc.name}</span>
                      <span data-testid="countdown" className={cn(left < 120 ? "font-bold text-[#c43d22]" : "")}>{formatDuration(left)} left</span>
                      <span className="ml-auto flex gap-2">
                        {i.delegable && (
                          <button className="underline underline-offset-2 hover:text-[#2e222f]" aria-expanded={menu?.id === i.id && menu.kind === "delegate"} onClick={() => setMenu(menu?.id === i.id && menu.kind === "delegate" ? null : { id: i.id, kind: "delegate" })} data-testid={`delegate-${i.id}`}>
                            Delegate
                          </button>
                        )}
                        <button className="underline underline-offset-2 hover:text-[#2e222f]" aria-expanded={menu?.id === i.id && menu.kind === "defer"} onClick={() => setMenu(menu?.id === i.id && menu.kind === "defer" ? null : { id: i.id, kind: "defer" })} data-testid={`defer-${i.id}`}>
                          Defer
                        </button>
                      </span>
                    </div>
                  </div>
                  <button className="m-1 flex min-w-12 items-center justify-center rounded-[4px] border-2 border-[#2e222f] bg-[#c43d22] px-2 text-[14px] font-bold text-white shadow-[inset_0_-3px_0_#9c2c18] hover:bg-[#d4492c] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[#ffd166]" onClick={() => onGo(i)} data-testid={`go-${i.id}`} aria-label={`Go: ${i.title}`}>
                    Go
                  </button>
                </div>
                {menu?.id === i.id && menu.kind === "delegate" && (
                  <div className="flex flex-wrap items-center justify-end gap-1 border-t-2 border-[#2e222f] bg-[#fff8e7] p-1.5" role="group" aria-label="Delegate to">
                    <span className="mr-auto text-[12px] font-semibold">Hand to:</span>
                    {volunteers.map((v) => (
                      <PixelButton key={v.id} tone="plain" size="sm" disabled={tried.includes(v.id)} onClick={() => { setMenu(null); onDelegate(i, v.id); }} data-testid={`delegate-to-${v.id}`}>
                        {v.name}
                      </PixelButton>
                    ))}
                  </div>
                )}
                {menu?.id === i.id && menu.kind === "defer" && (
                  <div className="flex flex-col gap-1 border-t-2 border-[#2e222f] bg-[#fff8e7] p-1.5" role="group" aria-label="Reason to defer">
                    {scenario.deferReasons.map((r) => (
                      <PixelButton key={r} tone="plain" size="sm" className="justify-start text-left" onClick={() => { setMenu(null); onDefer(i, r); }} data-testid="defer-reason">
                        {r}
                      </PixelButton>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {!issues.length && <li className="px-1 py-2 text-[13px] text-[#6a5a4a]">All quiet. Walk around, or wait for news.</li>}
        </ul>
      )}
    </Panel>
  );
}
