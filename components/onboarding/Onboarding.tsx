"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { withAccommodation } from "@/lib/store/accommodations";
import { useRecorder, type Mode } from "@/components/checkpoint/useRecorder";
import { store, type Profile } from "@/lib/store/store";

const STEPS = ["Your challenge", "The checkpoints", "Make it yours", "Device check"];

export function Onboarding({ scenarioId, title }: { scenarioId: string; title: string }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true);
  const request = useRef(0);
  const loaded = profile !== null;
  const video = useRef<HTMLVideoElement>(null);
  const { stream, level, release, prepare } = useRecorder();
  useEffect(() => { alive.current = true; setProfile(store().getProfile()); return () => { alive.current = false; }; }, []);
  useEffect(() => { heading.current?.focus(); }, [step, loaded]);
  useEffect(() => { if (video.current) video.current.srcObject = stream; }, [stream, step]);

  if (!profile) return <p role="status" className="p-8">Loading your preferences…</p>;
  const mode = profile.accommodations.textOnly ? "text" : profile.defaultMode;
  const multiplier = profile.accommodations.timeMultiplier;
  function save(next: Profile) { setProfile(store().saveProfile(next)); }
  function selectMode(next: Mode) {
    request.current++; release(); setChecked(false); setMessage("");
    save({ ...profile!, defaultMode: next, accommodations: { ...profile!.accommodations, textOnly: next === "text" } });
  }
  async function checkDevices() {
    release(); setChecking(true); setChecked(false); setMessage("");
    const current = ++request.current;
    const ready = await prepare(mode);
    if (!alive.current || current !== request.current) {
      ready?.getTracks().forEach(track => track.stop());
      release();
      if (alive.current) setChecking(false);
      return;
    }
    setChecking(false);
    if (ready) {
      setChecked(true);
      setMessage("Device connected. Check your preview and speak to see the microphone level. Nothing is being recorded.");
    } else {
      save({ ...profile!, defaultMode: "text", accommodations: { ...profile!.accommodations, textOnly: true } });
      setMessage("Camera or microphone access is unavailable. Text mode is ready, with the same opportunity to show your thinking.");
    }
  }
  function changeStep(next: number) { request.current++; release(); setChecked(false); setStep(next); }

  return <section className="mx-auto max-w-5xl px-5 py-10 sm:py-16" aria-label="Challenge introduction">
    <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">Before your turning point</p>
      <p className="text-sm text-muted-foreground">{step + 1} / 4 · {STEPS[step]}</p>
    </div>
    <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
      <aside className="rounded-3xl bg-secondary p-8">
        <p className="font-display text-6xl text-primary" aria-hidden="true">0{step + 1}</p>
        <p className="mt-6 text-lg font-semibold">{title}</p>
        <p className="mt-3 text-muted-foreground">A plan. A change. Your next move.</p>
        <ol aria-label="Preparation steps" className="mt-8 space-y-3 text-sm">{STEPS.map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined} className={step === i ? "font-semibold text-foreground" : "text-muted-foreground"}>{i < step ? "✓ " : `${i + 1}. `}{label}</li>)}</ol>
      </aside>
      <div className="min-w-0">
        <h1 ref={heading} tabIndex={-1} className="font-display text-4xl leading-tight outline-none">{["Show how you think when plans change.", "A pause to explain your next move.", "Set yourself up to take part.", "Make sure your format works."][step]}</h1>
        {step === 0 && <div className="mt-6 space-y-5 text-lg leading-relaxed">
          <p>You will guide a team through a short story, make decisions and balance limited resources. Partway through, the situation changes.</p>
          <p>Allow around 15 minutes. You can pause between decisions and return in this browser. This demo stores your progress on this device.</p>
          <p>There is no single winning route and no automatic rejection. A human reviews the evidence you choose to share.</p>
        </div>}
        {step === 1 && <div className="mt-6 space-y-5 text-lg leading-relaxed">
          <p>Two or three surprise checkpoints ask about choices you just made. You will know checkpoints are coming, but not exactly when.</p>
          <p>Normally you have 15 seconds to think and 60 seconds to answer. Your final real-life reflection gives 30 seconds to think and up to 120 seconds to answer, followed by a short question.</p>
          <p>Use video, voice or timed text. Change format at any checkpoint. Nothing requires a camera. One retake is available.</p>
          <p className="rounded-xl border border-border bg-card p-4 font-medium">Only your words and choices are reviewed. We never score faces, emotion, voice tone, accent, grammar or fluency.</p>
        </div>}
        {step === 2 && <form onSubmit={e => e.preventDefault()} className="mt-6 space-y-7">
          <fieldset><legend className="mb-3 font-semibold">Your default answer format</legend><div className="flex flex-wrap gap-3">{(["video", "voice", "text"] as Mode[]).map(m => <label key={m} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4"><input type="radio" name="answer-mode" checked={mode === m} onChange={() => selectMode(m)} />{m === "text" ? "Text only" : m === "video" ? "Video" : "Voice"}</label>)}</div><p className="mt-2 text-sm text-muted-foreground">You can change this again at every checkpoint.</p></fieldset>
          <fieldset><legend className="mb-3 font-semibold">Extra time, whenever you need it</legend><div className="flex flex-wrap gap-3">{([1, 1.5, 2] as const).map(value => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4"><input type="radio" name="time-multiplier" checked={multiplier === value} onChange={() => save({ ...profile, accommodations: { ...profile.accommodations, timeMultiplier: value } })} />{value}× time</label>)}</div><p className="mt-2 text-sm text-muted-foreground">Your decision checkpoints: {Math.round(15 * multiplier)} seconds to think, {60 * multiplier} seconds to answer. Employers only see “adjusted timing”.</p></fieldset>
          <div className="space-y-3">{([["screenReader", "Screen reader mode"], ["reducedMotion", "Reduce motion"], ["lowBandwidth", "Low bandwidth"]] as const).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={profile.accommodations[key]} onChange={e => save(withAccommodation(profile, key, e.target.checked))} />{label}</label>)}</div>
          <p className="text-sm text-muted-foreground">Preferences save automatically on this device. You do not need to give a reason.</p>
        </form>}
        {step === 3 && <div className="mt-6 space-y-5">
          <p>Check your camera and microphone, or continue with text. The check does not record or save media.</p>
          <fieldset disabled={checking}><legend className="mb-3 font-semibold">Answer format</legend><div className="flex flex-wrap gap-3">{(["video", "voice", "text"] as Mode[]).map(m => <label key={m} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-4"><input type="radio" name="device-mode" checked={mode === m} onChange={() => selectMode(m)} />{m === "text" ? "Text only" : m === "video" ? "Video" : "Voice"}</label>)}</div></fieldset>
          {mode === "text" ? <p className="rounded-xl border border-border bg-secondary p-5">Text mode is ready. No camera or microphone needed.</p> : <>
            {mode === "video" && <video ref={video} autoPlay playsInline muted aria-label="Live camera preview" className="aspect-video w-full rounded-2xl bg-secondary object-cover" />}
            <label className="block text-sm font-medium">Microphone level <meter min={0} max={1} value={level} aria-label="Microphone level" className="mt-2 block h-5 w-full" /></label>
            <Button onClick={checkDevices} disabled={checking || checked}>{checking ? "Connecting…" : checked ? "Device connected" : "Check devices"}</Button>
          </>}
          <p role="status" className="text-sm text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">Keep this demo in one browser. A separate consent screen explains local recording and data use before you start.</p>
        </div>}
        <nav aria-label="Preparation navigation" className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          {step > 0 && <Button variant="outline" disabled={checking} onClick={() => changeStep(step - 1)}>Back</Button>}
          {step < 3 ? <Button onClick={() => changeStep(step + 1)}>Continue</Button> : <Button asChild><Link href={`/play/${scenarioId}`} onClick={() => { request.current++; release(); }}>Continue to challenge</Link></Button>}
          {step === 3 && mode !== "text" && <Button variant="ghost" onClick={() => selectMode("text")}>Use text instead</Button>}
        </nav>
      </div>
    </div>
  </section>;
}
