"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/game/engine";
import type { Kpi } from "@/lib/game/kpis";
import type { Look, MapScenario } from "@/lib/game/schema";
import { AVATAR_OPTIONS, characterSheet, FRAME } from "@/lib/game/sprites";
import { useGame } from "@/lib/game/store";
import { formatTime } from "@/lib/game/time";
import { cn } from "@/lib/utils";
import { pixelTitle } from "./fonts";
import { Portrait } from "./Portrait";
import { Panel, PixelButton } from "./ui";

/** The title screen's map: a still image with a slow pan (no game engine on the first screen). */
export function TitleBackdrop({ mapId, label }: { mapId: string; label: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#2e222f]" role="img" aria-label={label} data-testid="title-map">
      <picture>
        <source media="(max-width: 640px)" srcSet={`/assets/title/${mapId}-phone.jpg`} />
        <img src={`/assets/title/${mapId}.jpg`} alt="" fetchPriority="high" className="h-full w-[115%] max-w-none object-cover [image-rendering:pixelated] motion-safe:animate-[tp-pan_28s_ease-in-out_infinite_alternate]" />
      </picture>
      <style>{`@keyframes tp-pan { from { transform: translateX(0) } to { transform: translateX(-13%) } }`}</style>
    </div>
  );
}

export function TitleScreen({ scenario, onStart, canResume, onResume }: { scenario: MapScenario; onStart: () => void; canResume: boolean; onResume: () => void }) {
  const settings = useGame((g) => g.settings);
  const setSettings = useGame((g) => g.setSettings);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !showSettings && (e.target as HTMLElement).tagName !== "BUTTON") {
        // Stop the same keypress from activating the next screen's focused button.
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onStart, showSettings]);
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-[#2e222f]/40 via-transparent to-[#2e222f]/70 p-4 text-center" data-testid="title-screen" onClick={(e) => e.target === e.currentTarget && onStart()}>
      <motion.h1 initial={{ y: -20 }} animate={{ y: 0 }} className={cn(pixelTitle.className, "text-[28px] leading-tight text-[#fff8e7] drop-shadow-[0_4px_0_#2e222f] sm:text-[44px]")}>
        TURNING<br />POINT
      </motion.h1>
      <p className="mt-3 rounded-[4px] bg-[#2e222f]/80 px-3 py-1 text-[#ffd166]">{scenario.title}: {scenario.role}</p>
      <motion.p animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className={cn(pixelTitle.className, "mt-10 text-[12px] text-white drop-shadow-[0_2px_0_#2e222f]")}>
        PRESS ENTER / TAP TO START
      </motion.p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <PixelButton onClick={onStart} data-testid="start">Start</PixelButton>
        {canResume && <PixelButton tone="plain" onClick={onResume} data-testid="resume">Continue</PixelButton>}
        <PixelButton tone="plain" onClick={() => setSettings({ music: !settings.music })} aria-pressed={settings.music}>
          Music {settings.music ? "on" : "off"}
        </PixelButton>
        <PixelButton tone="plain" onClick={() => setShowSettings((x) => !x)} aria-expanded={showSettings}>Settings</PixelButton>
      </div>
      {showSettings && (
        <Panel className="mt-3 w-[min(360px,92vw)] p-3 text-left" onClick={(e) => e.stopPropagation()}>
          <SettingsForm />
        </Panel>
      )}
    </div>
  );
}

export function SettingsForm() {
  const s = useGame((g) => g.settings);
  const set = useGame((g) => g.setSettings);
  return (
    <div className="space-y-2 text-sm" data-testid="settings">
      <label className="flex items-center justify-between gap-2">
        Turn-based mode (no clock pressure)
        <input type="checkbox" checked={s.turnBased} onChange={(e) => set({ turnBased: e.target.checked })} data-testid="set-turn-based" />
      </label>
      <label className="flex items-center justify-between gap-2">
        List view (no map)
        <input type="checkbox" checked={s.view === "list"} onChange={(e) => set({ view: e.target.checked ? "list" : "map" })} data-testid="set-list-view" />
      </label>
      <label className="flex items-center justify-between gap-2">
        Reduced motion
        <input type="checkbox" checked={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} data-testid="set-reduced-motion" />
      </label>
      <label className="flex items-center justify-between gap-2">
        Sound effects
        <input type="checkbox" checked={!s.muted} onChange={(e) => set({ muted: !e.target.checked })} />
      </label>
      <label className="flex items-center justify-between gap-2">
        Music
        <input type="checkbox" checked={s.music} onChange={(e) => set({ music: e.target.checked })} />
      </label>
      <label className="flex items-center justify-between gap-2">
        Text speed
        <select value={s.textSpeed} onChange={(e) => set({ textSpeed: e.target.value as typeof s.textSpeed })} className="rounded border-2 border-[#2e222f] bg-white px-1">
          <option value="slow">Slow</option>
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
          <option value="instant">Instant</option>
        </select>
      </label>
    </div>
  );
}

export function SpritePreview({ look, scale = 6, dirRow = 0 }: { look: Look; scale?: number; dirRow?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [f, setF] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setF((x) => (x + 1) % 4), 220);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const sheet = characterSheet(look);
    const src = document.createElement("canvas");
    src.width = sheet.width;
    src.height = sheet.height;
    src.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(sheet.data), sheet.width, sheet.height), 0, 0);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const frame = [1, 0, 2, 0][f];
    ctx.drawImage(src, frame * FRAME, dirRow * FRAME, FRAME, FRAME, 0, 0, FRAME * scale, FRAME * scale);
  }, [look, f, scale, dirRow]);
  return <canvas ref={ref} width={FRAME * scale} height={FRAME * scale} className="[image-rendering:pixelated]" aria-hidden />;
}

export function AvatarCreator({ onDone }: { onDone: () => void }) {
  const { look, name } = useGame((g) => g.avatar);
  const setAvatar = useGame((g) => g.setAvatar);
  const set = (k: keyof Look, v: string) => setAvatar({ look: { ...look, [k]: v } });
  const row = (label: string, key: "skin" | "hair" | "outfit") => (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {AVATAR_OPTIONS[key].map((c) => (
          <button key={c} type="button" onClick={() => set(key, c)} aria-label={`${label} ${c}`} aria-pressed={look[key] === c} className={cn("size-8 rounded-[4px] border-[3px] border-[#2e222f]", look[key] === c && "ring-[3px] ring-[#ffd166]")} style={{ backgroundColor: c }} />
        ))}
      </div>
    </fieldset>
  );
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#2e222f]/70 p-3" data-testid="avatar-creator">
      <Panel className="w-[min(560px,96vw)] p-4">
        <h2 className={cn(pixelTitle.className, "text-[14px]")}>Make your character</h2>
        <p className="mt-1 text-sm text-[#6a5a4a]">Just for you. Employers never see your character or this name.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2 rounded-[4px] bg-[#7cbe6e] p-3">
            <SpritePreview look={look} scale={7} />
            <div className="flex gap-1">
              <SpritePreview look={look} scale={3} dirRow={1} />
              <SpritePreview look={look} scale={3} dirRow={3} />
              <SpritePreview look={look} scale={3} dirRow={2} />
            </div>
          </div>
          <div className="space-y-2">
            {row("Skin", "skin")}
            <fieldset>
              <legend className="text-sm font-semibold">Hair style</legend>
              <div className="mt-1 flex flex-wrap gap-1">
                {AVATAR_OPTIONS.hairStyle.map((h) => (
                  <button key={h} type="button" onClick={() => set("hairStyle", h)} aria-pressed={look.hairStyle === h} className={cn("rounded-[4px] border-2 border-[#2e222f] px-2 text-sm capitalize", look.hairStyle === h ? "bg-[#2e222f] text-white" : "bg-white")}>
                    {h}
                  </button>
                ))}
              </div>
            </fieldset>
            {row("Hair colour", "hair")}
            {row("Outfit", "outfit")}
            <fieldset>
              <legend className="text-sm font-semibold">Extra</legend>
              <div className="mt-1 flex flex-wrap gap-1">
                {AVATAR_OPTIONS.extra.map((x) => (
                  <button key={x} type="button" onClick={() => set("extra", x)} aria-pressed={look.extra === x} className={cn("rounded-[4px] border-2 border-[#2e222f] px-2 text-sm capitalize", look.extra === x ? "bg-[#2e222f] text-white" : "bg-white")}>
                    {x}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-semibold">
              Display name
              <input value={name} onChange={(e) => setAvatar({ name: e.target.value.slice(0, 20) })} className="mt-1 block w-full rounded-[4px] border-2 border-[#2e222f] bg-white px-2 py-1 font-normal" placeholder="Optional" data-testid="avatar-name" />
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <PixelButton tone="plain" onClick={onDone} data-testid="avatar-skip">Skip</PixelButton>
          <PixelButton onClick={onDone} data-testid="avatar-done" autoFocus>Let&apos;s go</PixelButton>
        </div>
      </Panel>
    </div>
  );
}

const TIPS = [
  "Problems pop up around the market. You can't fix everything, so choose.",
  "Walking and talking take game time. Your reflexes never count.",
  "Defer something on purpose and say why. That's a decision too.",
  "Hand work to volunteers when it makes sense. Their mood matters.",
  "At surprise checkpoints you explain a choice you just made, by video, voice or text.",
  "Turn-based mode and list view are in Settings. Results are the same.",
];

export function LoadingScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [minDone, setMinDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), 1200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready && minDone) onDone();
  }, [ready, minDone, onDone]);
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#2e222f] p-6 text-center text-[#fff8e7]" data-testid="loading-screen" aria-busy="true">
      <p className={cn(pixelTitle.className, "text-[14px]")}>Loading the market…</p>
      <div className="mt-4 h-3 w-56 overflow-hidden rounded-[2px] border-2 border-[#fff8e7]">
        <motion.div className="h-full bg-[#ffd166]" initial={{ width: "5%" }} animate={{ width: ready ? "100%" : "80%" }} transition={{ duration: 1.2 }} />
      </div>
      <p className="mt-6 max-w-md text-sm">Tip: {tip}</p>
    </div>
  );
}

export function Cutscene({ scenario, state, onDone }: { scenario: MapScenario; state: GameState; onDone: () => void }) {
  const d = scenario.turningPoint.disruptions.find((x) => x.id === state.tp.disruptionId)!;
  const caller = scenario.npcs.find((n) => n.id === d.caller)!;
  const [phase, setPhase] = useState<"ring" | "call" | "drain">("ring");
  const budget = useMotionValue(state.tp.budgetBefore ?? state.budget);
  const shown = useTransform(budget, (v) => `$${Math.round(v).toLocaleString("en-CA")}`);
  const reduce = useGame((g) => g.settings.reducedMotion);
  useEffect(() => {
    const t = setTimeout(() => setPhase("call"), reduce ? 0 : 1600);
    return () => clearTimeout(t);
  }, [reduce]);
  useEffect(() => {
    if (phase !== "drain") return;
    const c = animate(budget, state.tp.budgetAfter ?? state.budget, { duration: reduce ? 0 : 2.4, ease: "easeOut" });
    return () => c.stop();
  }, [phase, budget, state, reduce]);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Turning point" data-testid="cutscene">
      <motion.div className="absolute inset-x-0 top-0 bg-black" initial={{ height: 0 }} animate={{ height: "11vh" }} />
      <motion.div className="absolute inset-x-0 bottom-0 bg-black" initial={{ height: 0 }} animate={{ height: "11vh" }} />
      {phase === "ring" ? (
        <motion.div animate={reduce ? {} : { rotate: [-8, 8, -8] }} transition={{ duration: 0.25, repeat: Infinity }} className={cn(pixelTitle.className, "rounded-[6px] bg-[#fff8e7] px-6 py-4 text-[14px]")}>
          📞 Incoming call: {caller.name}
        </motion.div>
      ) : (
        <Panel className="w-[min(560px,92vw)] p-4">
          <div className="flex gap-3">
            <Portrait id={caller.portrait} expression="worried" className="size-20 shrink-0 rounded-[4px] border-[3px] border-[#2e222f] bg-[#3b2f45]" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#c43d22]">Turning point</p>
              <h2 className={cn(pixelTitle.className, "mt-1 text-[13px] leading-snug")}>{d.title}</h2>
              <p className="mt-2 text-[16px]">{caller.name}: “{d.text}”</p>
            </div>
          </div>
          {phase === "drain" && (
            <div className="mt-3 rounded-[4px] border-2 border-[#2e222f] bg-white p-2 text-center">
              <p className="text-xs font-semibold uppercase">Budget</p>
              <motion.p className={cn(pixelTitle.className, "text-[18px] text-[#c43d22]")} data-testid="budget-drain">{shown}</motion.p>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            {phase === "call" ? (
              <PixelButton onClick={() => setPhase("drain")} autoFocus data-testid="cutscene-next">Hang up</PixelButton>
            ) : (
              <PixelButton onClick={onDone} autoFocus data-testid="cutscene-done">Face it</PixelButton>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function Recap({ state, day, onDone }: { state: GameState; day: number; onDone: () => void }) {
  const r = state.recaps.find((x) => x.day === day)!;
  const [left, setLeft] = useState(10);
  useEffect(() => {
    const t = setInterval(() => setLeft((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#2e222f]/70 p-4" role="dialog" aria-label="Evening recap" data-testid="recap">
      <Panel className="w-[min(420px,92vw)] p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#9c2c18]">Evening recap</p>
        <h2 className={cn(pixelTitle.className, "mt-1 text-[13px]")}>{names[day]} is done</h2>
        <dl className="mt-3 grid grid-cols-2 gap-1 text-sm">
          <dt>Handled</dt><dd className="text-right font-bold">{r.resolved + r.delegated}</dd>
          <dt>Deferred with a reason</dt><dd className="text-right font-bold">{r.deferred}</dd>
          <dt>Ran out of time</dt><dd className="text-right font-bold">{r.expired}</dd>
          <dt>Budget</dt><dd className="text-right font-bold">${r.budget.toLocaleString("en-CA")}</dd>
          <dt>Team morale</dt><dd className="text-right font-bold">{r.morale}</dd>
        </dl>
        <p className="mt-3 text-sm italic">Tomorrow morning: what&apos;s the one thing you&apos;d do differently?</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[#6a5a4a]">Continues in {left}s</span>
          <PixelButton onClick={onDone} autoFocus data-testid="recap-next">Next morning</PixelButton>
        </div>
      </Panel>
    </div>
  );
}

export function PauseMenu({ onResume }: { onResume: () => void }) {
  const [how, setHow] = useState(false);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#2e222f]/75 p-4" role="dialog" aria-modal="true" aria-label="Paused" data-testid="pause-menu">
      <Panel className="w-[min(420px,92vw)] p-4">
        <h2 className={cn(pixelTitle.className, "text-[14px]")}>Paused</h2>
        <p className="mt-1 text-sm">The clock is stopped. Your progress is saved.</p>
        <div className="mt-3"><SettingsForm /></div>
        {how && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            <li>Walk with WASD or arrows, click or tap to walk. E or Enter to talk.</li>
            <li>Every problem can be handled (Go), delegated to a volunteer, or deferred with a reason. Ignored ones run out of time.</li>
            <li>Time moves when you act, and slowly while you walk around. Turn-based mode stops that.</li>
            <li>Checkpoints ask you to explain a choice. Only your words count.</li>
          </ul>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <PixelButton tone="plain" onClick={() => setHow((x) => !x)}>How to play</PixelButton>
          <PixelButton onClick={onResume} autoFocus data-testid="pause-resume">Resume</PixelButton>
        </div>
      </Panel>
    </div>
  );
}

function Counter({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const v = useMotionValue(0);
  const shown = useTransform(v, (x) => `${x.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    const c = animate(v, to, { duration: 1.2, ease: "easeOut" });
    return () => c.stop();
  }, [to, v]);
  return <motion.span>{shown}</motion.span>;
}

export function ResultsScreen({ scenario, state, kpis, onContinue }: { scenario: MapScenario; state: GameState; kpis: Kpi[]; onContinue: () => void }) {
  const moments = state.events.filter((e) => ["resolved", "delegated", "deferred", "expired", "turning_point"].includes(e.kind)).slice(0, 14);
  const label = (e: (typeof moments)[number]) => {
    if (e.kind === "turning_point") return `Turning point: ${scenario.turningPoint.disruptions.find((d) => d.id === e.detail)?.title}`;
    const i = scenario.issues.find((x) => x.id === e.issue);
    const verb = { resolved: "Handled", delegated: "Delegated", deferred: "Deferred", expired: "Ran out of time" }[e.kind as "resolved"];
    return `${verb}: ${i?.title}`;
  };
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-[#2e222f]/85 p-3 sm:p-6" data-testid="results-screen">
      <Panel className="mx-auto w-[min(860px,96vw)] p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#9c2c18]">Market day · week complete</p>
        <h2 className={cn(pixelTitle.className, "mt-1 text-[16px]")}>Week in review</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.id} className="rounded-[4px] border-2 border-[#2e222f] bg-white p-2" data-testid={`kpi-${k.id}`}>
              <p className="text-[11px] font-semibold uppercase leading-tight">{k.label}</p>
              <p className={cn(pixelTitle.className, "mt-1 text-[13px]")}>
                {k.value === null ? "–" : k.value <= 1 && k.id !== "stakeholder-balance" && k.id !== "morale-trajectory" && k.id !== "recovery-speed" && k.id !== "discoveries" ? <Counter to={k.value * 100} suffix="%" /> : <Counter to={k.value} decimals={k.id === "recovery-speed" ? 1 : 0} />}
              </p>
              <p className="mt-1 text-[11px] text-[#6a5a4a]">{k.display}</p>
            </div>
          ))}
        </div>
        <h3 className="mt-4 text-sm font-bold">Your key moments</h3>
        <ol className="mt-1 flex gap-2 overflow-x-auto pb-2">
          {moments.map((e, i) => (
            <li key={i} className={cn("min-w-[150px] rounded-[4px] border-2 border-[#2e222f] p-2 text-[12px]", e.kind === "turning_point" ? "bg-[#c43d22] text-white" : e.kind === "expired" ? "bg-[#e8d9b5]" : "bg-white")}>
              <span className="block font-bold">{formatTime(e.t)}</span>
              {label(e)}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm">One last thing: link this week to something real you&apos;ve lived through.</p>
        <div className="mt-3 flex justify-end">
          <PixelButton onClick={onContinue} autoFocus data-testid="results-continue">Continue</PixelButton>
        </div>
      </Panel>
    </div>
  );
}
