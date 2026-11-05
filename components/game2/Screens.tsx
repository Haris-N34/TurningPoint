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
import { PixelIcon, Portrait } from "./Portrait";
import { Eyebrow, Panel, PixelButton } from "./ui";

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

export function TitleScreen({ scenario, onStart, canResume, onResume, brief }: { scenario: MapScenario; onStart: () => void; canResume: boolean; onResume: () => void; brief?: { company: string; title: string } }) {
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
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-y-auto p-4 text-center" data-testid="title-screen" onClick={(e) => e.target === e.currentTarget && onStart()}>
      {/* Vignette: the map stays as mood, the logo owns the middle. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(46,34,47,0.62)_0%,rgba(46,34,47,0.8)_50%,rgba(20,14,24,0.96)_100%)]" aria-hidden />
      <div className="relative flex flex-col items-center" onClick={(e) => e.target === e.currentTarget && onStart()}>
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-[4px] border-2 border-[#ffd166] bg-[#2e222f]/90 px-3 py-0.5 text-[14px] font-semibold uppercase tracking-[0.2em] text-[#ffd166]">
          {scenario.title}
        </motion.p>
        <motion.h1
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 16 }}
          className={cn(pixelTitle.className, "mt-4 text-[34px] leading-[1.15] text-[#fff8e7] [text-shadow:0_4px_0_#c43d22,0_8px_0_#2e222f] sm:text-[56px] lg:text-[64px]")}
        >
          TURNING
          <br />
          POINT
        </motion.h1>
        <p className="mt-5 max-w-[min(520px,90vw)] text-[17px] text-[#fff8e7] sm:text-[19px]">
          You&apos;re the {scenario.role.toLowerCase()}. Midweek, the plan breaks.
        </p>
        {brief && (
          // An employer's challenge: who it is for and the tailored setting.
          <Panel tone="ink" className="mt-3 max-w-[min(560px,92vw)] px-3 py-2 text-left text-[14px]" data-testid="title-brief">
            <h2 className="font-semibold text-[#ffd166]">{brief.company} · {brief.title}</h2>
            <p className="mt-1">{scenario.summary}</p>
          </Panel>
        )}
        <div className="mt-7 flex flex-col items-center gap-2">
          <PixelButton size="lg" className="min-w-[200px]" onClick={onStart} data-testid="start">
            Start
          </PixelButton>
          <motion.p animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-[13px] font-semibold tracking-[0.12em] text-[#fff8e7]/85">
            PRESS ENTER / TAP TO START
          </motion.p>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {canResume && <PixelButton tone="plain" size="sm" onClick={onResume} data-testid="resume">Continue</PixelButton>}
          <PixelButton tone="plain" size="sm" onClick={() => setSettings({ music: !settings.music })} aria-pressed={settings.music}>
            Music {settings.music ? "on" : "off"}
          </PixelButton>
          <PixelButton tone="plain" size="sm" onClick={() => setShowSettings((x) => !x)} aria-expanded={showSettings}>Settings</PixelButton>
        </div>
        {showSettings && (
          <Panel className="mt-3 w-[min(360px,92vw)] p-3 text-left" onClick={(e) => e.stopPropagation()}>
            <SettingsForm />
          </Panel>
        )}
      </div>
    </div>
  );
}

export function SettingsForm() {
  const s = useGame((g) => g.settings);
  const set = useGame((g) => g.setSettings);
  return (
    <div className="space-y-1 text-[15px]" data-testid="settings">
      <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-[3px] px-1 hover:bg-[#2e222f]/5">
        Turn-based mode (no clock pressure)
        <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-[#c43d22]" checked={s.turnBased} onChange={(e) => set({ turnBased: e.target.checked })} data-testid="set-turn-based" />
      </label>
      <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-[3px] px-1 hover:bg-[#2e222f]/5">
        List view (no map)
        <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-[#c43d22]" checked={s.view === "list"} onChange={(e) => set({ view: e.target.checked ? "list" : "map" })} data-testid="set-list-view" />
      </label>
      <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-[3px] px-1 hover:bg-[#2e222f]/5">
        Reduced motion
        <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-[#c43d22]" checked={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} data-testid="set-reduced-motion" />
      </label>
      <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-[3px] px-1 hover:bg-[#2e222f]/5">
        Sound effects
        <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-[#c43d22]" checked={!s.muted} onChange={(e) => set({ muted: !e.target.checked })} />
      </label>
      <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-[3px] px-1 hover:bg-[#2e222f]/5">
        Music
        <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-[#c43d22]" checked={s.music} onChange={(e) => set({ music: e.target.checked })} />
      </label>
      <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-[3px] px-1 hover:bg-[#2e222f]/5">
        Text speed
        <select value={s.textSpeed} onChange={(e) => set({ textSpeed: e.target.value as typeof s.textSpeed })} className="min-h-8 rounded-[4px] border-2 border-[#2e222f] bg-white px-1">
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
        <h2 className={cn(pixelTitle.className, "text-[14px] sm:text-[16px]")}>Make your character</h2>
        <p className="mt-1.5 text-[14px] text-[#6a5a4a]">Just for you. Employers never see your character or this name.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center gap-3 rounded-[4px] border-[3px] border-[#2e222f] bg-[#7cbe6e] bg-[linear-gradient(45deg,#74b566_25%,transparent_25%,transparent_75%,#74b566_75%),linear-gradient(45deg,#74b566_25%,transparent_25%,transparent_75%,#74b566_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] p-3">
            <div className="relative flex flex-col items-center">
              <SpritePreview look={look} scale={7} />
              <span className="-mt-3 h-3 w-16 rounded-[50%] bg-black/25" aria-hidden />
            </div>
            <div className="flex gap-1 rounded-[4px] bg-[#2e222f]/15 p-1">
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
      <p className={cn(pixelTitle.className, "text-[14px] sm:text-[16px]")}>Loading…</p>
      <div className="mt-5 h-4 w-64 overflow-hidden rounded-[2px] border-[3px] border-[#fff8e7] p-0.5">
        <motion.div className="h-full bg-[#ffd166]" initial={{ width: "5%" }} animate={{ width: ready ? "100%" : "80%" }} transition={{ duration: 1.2 }} />
      </div>
      <p className="mt-6 max-w-md text-[15px] text-[#fff8e7]/85"><span className="font-semibold text-[#ffd166]">Tip:</span> {tip}</p>
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#140e18]/70 px-3" role="dialog" aria-modal="true" aria-label="Turning point" data-testid="cutscene">
      <motion.div className="absolute inset-x-0 top-0 bg-black" initial={{ height: 0 }} animate={{ height: "12vh" }} transition={{ duration: reduce ? 0 : 0.35 }} />
      <motion.div className="absolute inset-x-0 bottom-0 bg-black" initial={{ height: 0 }} animate={{ height: "12vh" }} transition={{ duration: reduce ? 0 : 0.35 }} />
      {/* The hit: a red edge flash as the money goes. */}
      {phase === "drain" && !reduce && (
        <motion.div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_40px_rgba(196,61,34,0.85)]" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.25, 0.6, 0] }} transition={{ duration: 1.6, times: [0, 0.12, 0.4, 0.55, 1] }} aria-hidden />
      )}
      {phase === "ring" ? (
        <motion.div initial={reduce ? false : { scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
          <Panel tone="ink" className="flex w-[min(460px,92vw)] items-center gap-4 p-4 sm:p-5" aria-live="assertive">
            <motion.div className="shrink-0 rounded-[6px] border-[3px] border-[#ffd166] p-0.5" animate={reduce ? {} : { borderColor: ["#ffd166", "#c43d22", "#ffd166"] }} transition={{ duration: 0.8, repeat: Infinity }}>
              <Portrait id={caller.portrait} expression="worried" className="size-20 rounded-[3px] bg-[#2e222f] sm:size-24" />
            </motion.div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#ffd166]">Incoming call</p>
              <p className={cn(pixelTitle.className, "mt-2 text-[15px] leading-snug sm:text-[18px]")}>{caller.name}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[14px] text-[#fff8e7]/80" aria-hidden>
                <motion.span animate={reduce ? {} : { rotate: [-14, 14, -14] }} transition={{ duration: 0.2, repeat: Infinity }} className="inline-block">
                  <PixelIcon name="phone" className="size-6" />
                </motion.span>
                Ringing…
              </p>
            </div>
          </Panel>
        </motion.div>
      ) : (
        <motion.div initial={reduce ? false : { y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-[min(640px,94vw)]">
          <Panel className="p-4 sm:p-5">
            <div className="flex gap-4">
              <Portrait id={caller.portrait} expression="worried" className="size-20 shrink-0 rounded-[4px] border-[3px] border-[#2e222f] bg-[#3b2f45] sm:size-28" />
              <div className="min-w-0">
                <Eyebrow className="text-[#c43d22]">Turning point</Eyebrow>
                <h2 className={cn(pixelTitle.className, "mt-1.5 text-[14px] leading-snug sm:text-[17px]")}>{d.title}</h2>
                <p className="mt-2 text-[17px] leading-snug sm:text-[18px]">
                  <span className="font-semibold">{caller.name}:</span> “{d.text}”
                </p>
              </div>
            </div>
            {phase === "drain" && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-[4px] border-2 border-[#2e222f] bg-white px-3 py-2">
                <p className="text-[13px] font-semibold uppercase tracking-wide">Budget</p>
                <motion.p className={cn(pixelTitle.className, "text-[20px] text-[#c43d22] sm:text-[24px]")} animate={reduce ? {} : { x: [0, -3, 3, -2, 2, 0] }} transition={{ duration: 0.4, repeat: 4 }} data-testid="budget-drain">{shown}</motion.p>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              {phase === "call" ? (
                <PixelButton onClick={() => setPhase("drain")} autoFocus data-testid="cutscene-next">Hang up</PixelButton>
              ) : (
                <PixelButton onClick={onDone} autoFocus data-testid="cutscene-done">Face it</PixelButton>
              )}
            </div>
          </Panel>
        </motion.div>
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
        <Eyebrow>Evening recap</Eyebrow>
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
        <h2 className={cn(pixelTitle.className, "text-[16px]")}>Paused</h2>
        <p className="mt-1.5 text-[14px] text-[#6a5a4a]">The clock is stopped. Your progress is saved.</p>
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
        <Eyebrow>Week complete</Eyebrow>
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
