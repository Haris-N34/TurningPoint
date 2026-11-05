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
  high: { label: "Urgent", icon: "!!", cls: "bg-[#d9472b] text-white" },
  medium: { label: "Soon", icon: "!", cls: "bg-[#e0a32e] text-[#2e222f]" },
  low: { label: "Minor", icon: "·", cls: "bg-[#4f9d69] text-white" },
} as const;

function Bar({ label, value, max, colour, testid, display }: { label: string; value: number; max: number; colour: string; testid: string; display: string }) {
  const all = useGame((g) => g.floaters);
  const floaters = all.filter((f) => f.key === testid);
  return (
    <div className="relative" data-testid={testid}>
      <div className="flex items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span>{label}</span>
        <motion.span key={display} initial={{ scale: 1.4, color: "#d9472b" }} animate={{ scale: 1, color: "#2e222f" }} className={cn(pixelTitle.className, "text-[10px]")}>
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
            className={cn("absolute right-0 top-0 rounded-[3px] px-1 text-xs font-bold", f.tone === "good" ? "bg-[#4f9d69] text-white" : f.tone === "bad" ? "bg-[#d9472b] text-white" : "bg-white")}
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
  const daysLeft = Math.max(0, 5 - Math.floor(state.t / 1440));
  const start = state.tp.budgetBefore ?? scenario.resources.budget.start;
  return (
    <Panel className="w-[min(230px,46vw)] space-y-1.5 p-2" data-testid="resources">
      <Bar label="Budget" value={state.budget} max={Math.max(start, 1)} colour="#e0a32e" testid="res-budget" display={`$${state.budget.toLocaleString("en-CA")}`} />
      <Bar label="Team morale" value={state.morale} max={100} colour="#4f9d69" testid="res-morale" display={String(state.morale)} />
      <Bar label="Community trust" value={trustAvg} max={100} colour="#4a6fb0" testid="res-trust" display={String(trustAvg)} />
      <p className="text-[11px] font-semibold uppercase tracking-wide">
        Days left <span className={cn(pixelTitle.className, "text-[10px]")}>{daysLeft}</span>
      </p>
    </Panel>
  );
}

export function Clock({ state, turnBased }: { state: GameState; turnBased: boolean }) {
  const p = dayProgress(state.t);
  const r = 15, c = 2 * Math.PI * r;
  return (
    <Panel className="flex items-center gap-2 px-3 py-1.5" data-testid="clock" aria-live="polite" aria-label={`Game time ${formatTime(state.t)}`}>
      <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e8d9b5" strokeWidth="5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={p > 0.75 ? "#d9472b" : "#e0a32e"} strokeWidth="5" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      <div>
        <p className={cn(pixelTitle.className, "text-[13px]")} data-testid="clock-time">{formatTime(state.t)}</p>
        {turnBased && <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4a6fb0]" data-testid="turn-based">Turn-based mode</p>}
      </div>
    </Panel>
  );
}

export function Toasts() {
  const toasts = useGame((g) => g.toasts);
  return (
    <div className="pointer-events-none absolute left-1/2 top-20 z-30 flex w-[min(360px,90vw)] -translate-x-1/2 flex-col gap-1" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}>
            <Panel className="px-3 py-1.5 text-sm font-semibold" data-testid="toast">{t.text}</Panel>
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
  return (
    <Panel className="w-[min(300px,92vw)] p-2" data-testid="issue-tracker">
      <button className="flex w-full items-center justify-between text-left text-sm font-bold" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>Issues ({issues.length})</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="mt-1 max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
          {issues.map((i) => {
            const st = state.issues[i.id];
            const left = (st.deadline ?? state.t) - state.t;
            const zone = scenario.zones.find((z) => z.id === i.zone)!;
            const npc = scenario.npcs.find((n) => n.id === i.npc)!;
            const sev = SEV[i.severity];
            const tried = (st.delegate ?? []).map((d) => d.to);
            return (
              <li key={i.id} className="rounded-[4px] border-2 border-[#2e222f] bg-white p-1.5" data-testid={`issue-${i.id}`}>
                <div className="flex items-start gap-1.5">
                  <span className={cn("mt-0.5 shrink-0 rounded-[3px] px-1 text-[10px] font-bold", sev.cls)} aria-label={sev.label}>
                    {sev.icon} {sev.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight">{i.title}</p>
                    <p className="text-[11px] text-[#6a5a4a]">
                      {npc.name} · {zone.name} · <span data-testid="countdown" className={cn(left < 120 && "font-bold text-[#d9472b]")}>{formatDuration(left)} left</span>
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button className="rounded-[3px] border-2 border-[#2e222f] bg-[#d9472b] px-2 text-[12px] font-bold text-white" onClick={() => onGo(i)} data-testid={`go-${i.id}`}>
                    Go
                  </button>
                  {i.delegable && (
                    <button className="rounded-[3px] border-2 border-[#2e222f] bg-white px-2 text-[12px]" onClick={() => setMenu(menu?.id === i.id && menu.kind === "delegate" ? null : { id: i.id, kind: "delegate" })} data-testid={`delegate-${i.id}`}>
                      Delegate
                    </button>
                  )}
                  <button className="rounded-[3px] border-2 border-[#2e222f] bg-white px-2 text-[12px]" onClick={() => setMenu(menu?.id === i.id && menu.kind === "defer" ? null : { id: i.id, kind: "defer" })} data-testid={`defer-${i.id}`}>
                    Defer
                  </button>
                </div>
                {menu?.id === i.id && menu.kind === "delegate" && (
                  <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Delegate to">
                    {volunteers.map((v) => (
                      <button key={v.id} disabled={tried.includes(v.id)} className="rounded-[3px] bg-[#e8d9b5] px-2 text-[12px] disabled:opacity-40" onClick={() => { setMenu(null); onDelegate(i, v.id); }} data-testid={`delegate-to-${v.id}`}>
                        {v.name}
                      </button>
                    ))}
                  </div>
                )}
                {menu?.id === i.id && menu.kind === "defer" && (
                  <div className="mt-1 flex flex-col gap-1" role="group" aria-label="Reason to defer">
                    {scenario.deferReasons.map((r) => (
                      <button key={r} className="rounded-[3px] bg-[#e8d9b5] px-2 text-left text-[12px]" onClick={() => { setMenu(null); onDefer(i, r); }} data-testid="defer-reason">
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {!issues.length && <li className="text-[12px] text-[#6a5a4a]">All quiet. Walk around, or wait for news.</li>}
        </ul>
      )}
      <PixelButton tone="plain" className="mt-2 min-h-9 w-full py-0.5 text-[13px]" onClick={onWait} data-testid="wait">
        Wait for news
      </PixelButton>
    </Panel>
  );
}
