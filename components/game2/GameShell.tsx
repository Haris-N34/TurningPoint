"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Checkpoint, type CheckpointResult, type IntegrityNote } from "@/components/checkpoint/Checkpoint";
import { RealLife, type RealStory } from "@/components/checkpoint/RealLife";
import { getMapScenario } from "@/content/maps";
import { interviewQuestion } from "@/lib/ai/services/interviewer";
import { buildMapCard } from "@/lib/card/buildMap";
import type { CardCheckpoint } from "@/lib/card/types";
import { bus } from "@/lib/game/bus";
import { GAME } from "@/lib/game/config";
import { forLength, openIssues, replay, type Action, type CheckpointDue, type GameLength, type GameState } from "@/lib/game/engine";
import { DEMO_JUMP_SEED, playToTurningPoint } from "@/lib/game/demoJump";
import { computeKpis } from "@/lib/game/kpis";
import type { Issue, Look } from "@/lib/game/schema";
import { music, sfx } from "@/lib/game/sound";
import { scenarioForRun } from "@/lib/ai/services/publish";
import { applyMapOverrides, type MapOverrides } from "@/lib/challenge/mapTailor";
import { useGame } from "@/lib/game/store";
import { parseTime } from "@/lib/game/time";
import type { SkillSlug } from "@/lib/engine/skills";
import { store, type Profile } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { DialogueBox, ReactionBox } from "./DialogueBox";
import { pixelBody, pixelTitle } from "./fonts";
import { Clock, IssueTracker, Resources, Toasts } from "./Hud";
import { ListView } from "./ListView";
import { AvatarCreator, Cutscene, LoadingScreen, PauseMenu, Recap, ResultsScreen, TitleScreen, TitleBackdrop } from "./Screens";
import { Eyebrow, Panel, PixelButton } from "./ui";

const MapCanvas = dynamic(() => import("@/components/game/MapCanvas"), { ssr: false });

export type ShellChallenge = { id: string; title: string; company: string; targetSkills?: SkillSlug[] };
type Reaction = { npc: string; expression: "neutral" | "worried" | "happy" | "angry"; line?: string };

function newAttemptId() {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
  return "att_" + r.replace(/-/g, "").slice(0, 10);
}

export function GameShell({ mapId, challenge, sandbox = false, overrides }: { mapId: string; challenge: ShellChallenge; sandbox?: boolean; overrides?: MapOverrides }) {
  // The employer's wording and checkpoint edits (E1.3, E1.4). Ids and effects are untouched, so replay stays valid.
  // The engine always gets the authored map (`base`); it derives the quick variant from the run's length itself.
  const base = useMemo(() => applyMapOverrides(getMapScenario(mapId)!, overrides), [mapId, overrides]);
  const router = useRouter();
  const screen = useGame((g) => g.screen);
  const state = useGame((g) => g.state);
  const settings = useGame((g) => g.settings);
  const paused = useGame((g) => g.paused);
  const cutscene = useGame((g) => g.cutscene);
  const recapDay = useGame((g) => g.recapDay);
  const avatar = useGame((g) => g.avatar);
  const error = useGame((g) => g.error);
  // What the screens show: the scenario for this run's length (Quick mode by default, "Full week" in Settings).
  const length = state?.length ?? settings.length;
  const scenario = useMemo(() => forLength(base, length), [base, length]);
  const { dispatch, setScreen, setPaused, setCutscene, setRecapDay, floater, toast, init, restore, setSettings } = useGame.getState();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attemptId, setAttemptId] = useState("");
  const [ready, setReady] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  // The last reaction stays readable after the 1.5 s popup closes (tests, screen readers via the log).
  const [lastReaction, setLastReaction] = useState<string>("");
  const [answers, setAnswers] = useState<CardCheckpoint[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityNote[]>([]);
  const [phase, setPhase] = useState<"game" | "real-life">("game");
  const [orderRanking, setOrderRanking] = useState<string[] | null>(null);
  const [resumable, setResumable] = useState<{ attemptId: string; log: Action[]; seed: string; answers: CardCheckpoint[]; integrity: IntegrityNote[]; avatar?: { look: Look; name: string }; turnBased: boolean; length: GameLength; view?: "map" | "list"; reducedMotion?: boolean } | null>(null);
  const prev = useRef<GameState | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  const [sawLoading, setSawLoading] = useState(false);
  useEffect(() => {
    if (screen === "loading") setSawLoading(true);
  }, [screen]);
  const shownTp = useRef(false);

  // Profile, accommodations and any unfinished run on this device.
  useEffect(() => {
    useGame.setState({ screen: "title", state: undefined, log: [], paused: false, cutscene: false, recapDay: undefined });
    const s = store();
    const p = s.getProfile();
    setProfile(p);
    // Extra-time accommodations switch on turn-based mode automatically (A5).
    if (p.accommodations.timeMultiplier > 1) setSettings({ turnBased: true });
    if (p.accommodations.reducedMotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setSettings({ reducedMotion: true });
    setHydrated(true);
    if (!sandbox) {
      const r = s.activeRun(challenge.id);
      const extra = r?.extra as { map?: string; log?: Action[]; answers?: CardCheckpoint[]; integrity?: IntegrityNote[]; avatar?: { look: Look; name: string }; turnBased?: boolean; length?: GameLength; view?: "map" | "list"; reducedMotion?: boolean } | undefined;
      if (r && extra?.map === mapId && extra.log)
        setResumable({ attemptId: r.attemptId, log: extra.log, seed: r.seed, answers: extra.answers ?? [], integrity: extra.integrity ?? [], avatar: extra.avatar, turnBased: !!extra.turnBased, length: extra.length ?? "full", view: extra.view, reducedMotion: extra.reducedMotion });
    }
    return () => music.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, challenge.id]);

  useEffect(() => sfx.setEnabled(!settings.muted), [settings.muted]);
  useEffect(() => bus.on("ready", () => setReady(true)) as unknown as void, []);
  useEffect(() => () => bus.off("ready"), []);

  const start = useCallback(() => {
    sfx.click();
    setScreen("avatar");
  }, [setScreen]);

  const [jump, setJump] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setJump(q.get("jump") === "turning-point");
    // ?week=full starts the five-day week (same as the "Full week" setting).
    if (q.get("week") === "full") setSettings({ length: "full" });
    else if (q.get("week") === "quick") setSettings({ length: "quick" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // First-time coach hint: only on a fresh run (never the demo jump or a resume), gone after the first action.
  const coach = useRef(false);
  const begin = useCallback(() => {
    coach.current = !jump;
    const id = newAttemptId();
    setAttemptId(id);
    init(base, jump ? DEMO_JUMP_SEED : id, { turnBased: settings.turnBased, view: settings.view, length: settings.length });
    if (jump) {
      // Demo jump (P.2): a scripted sensible player runs Monday and Tuesday on the fixed seed (sponsor pulls out).
      // Its recaps, checkpoints and toasts stay silent; only the turning point itself is new, so the cutscene plays.
      const j = playToTurningPoint(base, DEMO_JUMP_SEED, { turnBased: settings.turnBased, length: settings.length });
      prev.current = { ...j.state, events: j.state.events.slice(0, j.tpIndex) };
      shownTp.current = false;
      restore(base, j.state, j.log);
    }
    setReady(settings.view === "list");
    setScreen("loading");
  }, [init, restore, base, settings.turnBased, settings.view, settings.length, setScreen, jump]);

  const resume = useCallback(() => {
    if (!resumable) return;
    const st = replay(base, resumable.seed, resumable.log, { turnBased: resumable.turnBased, length: resumable.length });
    shownTp.current = st.tp.fired;
    prev.current = st;
    restore(base, st, resumable.log);
    setAttemptId(resumable.attemptId);
    setAnswers(resumable.answers);
    setIntegrity(resumable.integrity);
    if (resumable.avatar) useGame.setState({ avatar: resumable.avatar });
    // The player's view and motion choices come back with the run (QA #20).
    const view = resumable.view ?? settings.view;
    setSettings({ turnBased: resumable.turnBased, length: resumable.length, view, ...(resumable.reducedMotion ? { reducedMotion: true } : {}) });
    coach.current = false;
    setReady(view === "list");
    setScreen("loading");
  }, [resumable, base, restore, setScreen, setSettings, settings.view]);

  // Save after every change so a refresh resumes exactly (C2.4).
  useEffect(() => {
    if (!state || sandbox || jump || !attemptId) return;
    store().saveRun({
      attemptId,
      challengeId: challenge.id,
      scenarioId: `map:${mapId}`,
      seed: state.seed,
      state: { t: state.t, ended: state.ended },
      extra: { map: mapId, log: useGame.getState().log, answers, integrity, avatar, turnBased: state.turnBased, length: state.length, view: settings.view, reducedMotion: settings.reducedMotion },
      status: state.ended && phase === "real-life" ? "finished" : "playing",
      startedAt: new Date().toISOString(),
      practice: false,
    });
  }, [state, answers, integrity, attemptId, sandbox, jump, challenge.id, mapId, avatar, phase, settings.view, settings.reducedMotion]);

  // Music: calm, then tense after the turning point (A0).
  useEffect(() => {
    if (screen !== "play" || !settings.music || settings.muted) return music.stop();
    music.play(state?.tp.fired ? "tense" : "calm");
    return () => music.stop();
  }, [screen, settings.music, settings.muted, state?.tp.fired]);

  const frozen = paused || cutscene || !!state?.dialogue || (state?.checkpointsDue.length ?? 0) > 0 || recapDay !== undefined || !!reaction || !!state?.ended;
  useEffect(() => bus.emit("freeze", { frozen }), [frozen]);

  // Ambient drift: 2 game minutes per real second on the map, never in turn-based mode or list view (A5).
  useEffect(() => {
    if (screen !== "play" || settings.view !== "map" || state?.turnBased) return;
    const t = setInterval(() => {
      if (document.hidden || frozen) return;
      dispatch({ type: "drift", minutes: GAME.driftMinutesPerSecond });
    }, 1000);
    return () => clearInterval(t);
  }, [screen, settings.view, state?.turnBased, frozen, dispatch]);

  // The clock pauses when the tab loses focus (A5).
  useEffect(() => {
    const onVis = () => document.hidden && screen === "play" && setPaused(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && screen === "play" && !state?.dialogue && !(state?.checkpointsDue.length ?? 0)) setPaused(!useGame.getState().paused);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
    };
  }, [screen, setPaused, state?.dialogue, state?.checkpointsDue.length]);

  // The browser's storage is full (store emits tp:storage-full): say so once, calmly, in the game.
  useEffect(() => {
    let told = false;
    const onFull = () => {
      if (told) return;
      told = true;
      toast("This browser's storage is full, so progress may not save. Free some space to keep it.");
    };
    window.addEventListener("tp:storage-full", onFull);
    return () => window.removeEventListener("tp:storage-full", onFull);
  }, [toast]);

  // Toasts wait while the cutscene plays, then show as one line (only the cutscene is on screen during it).
  // Quick mode's day end: a 2-second banner that never pauses play.
  const [dayBanner, setDayBanner] = useState<{ id: number; text: string; sub: string } | null>(null);
  useEffect(() => {
    if (!dayBanner) return;
    const t = setTimeout(() => setDayBanner(null), 2000);
    return () => clearTimeout(t);
  }, [dayBanner]);
  const heldToasts = useRef<{ text: string; issue?: string }[]>([]);
  const note = useCallback((text: string, hold = false, issue?: string) => (hold || useGame.getState().cutscene ? heldToasts.current.push({ text, issue }) : toast(text)), [toast]);
  useEffect(() => {
    if (cutscene || !heldToasts.current.length) return;
    const all = heldToasts.current;
    heldToasts.current = [];
    const st = useGame.getState().state;
    // Only issues that are still open count as new (the demo jump spawns and expires some on the way).
    const fresh = all.filter((t) => t.text.startsWith("New issue") && (!t.issue || st?.issues[t.issue]?.status === "open")).map((t) => t.text);
    const lost = all.filter((t) => t.text.startsWith("Ran out")).map((t) => t.text);
    const other = all.filter((t) => !t.text.startsWith("New issue") && !t.text.startsWith("Ran out")).map((t) => t.text);
    // The demo jump fast-forwards past problems nobody saw; don't report those.
    if (lost.length && !jump) toast(lost.length > 1 ? `${lost.length} problems ran out of time` : lost[0]);
    if (fresh.length) toast(fresh.length > 1 ? `${fresh.length} new issues. They're in your list.` : fresh[0]);
    other.slice(-1).forEach((t) => toast(t));
  }, [cutscene, toast, jump]);

  // Juice and notifications from engine changes (A0).
  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (!p || !state || p === state) return;
    const db = state.budget - p.budget, dm = state.morale - p.morale;
    const ta = (x: GameState) => Object.values(x.trust).reduce((a, b) => a + b, 0) / Object.values(x.trust).length;
    const dt = Math.round(ta(state) - ta(p));
    if (db) floater(`${db > 0 ? "+" : "-"}$${Math.abs(db).toLocaleString("en-CA")}`, db > 0 ? "good" : "bad", "res-budget");
    if (dm) floater(`${dm > 0 ? "+" : ""}${dm} morale`, dm > 0 ? "good" : "bad", "res-morale");
    if (dt) floater(`${dt > 0 ? "+" : ""}${dt} trust`, dt > 0 ? "good" : "bad", "res-trust");
    const fresh = state.events.slice(p.events.length);
    const hold = fresh.some((e) => e.kind === "turning_point") && !shownTp.current;
    // Quick mode's day-end banner already counts what ran out at the end of the day; no toast per issue.
    const bannerDay = scenario.recapModal === false && state.recaps.length > p.recaps.length;
    for (const e of fresh) {
      const issue = scenario.issues.find((i) => i.id === e.issue);
      if (e.kind === "spawned" && issue && !issue.hidden) {
        note(`New issue at ${scenario.zones.find((z) => z.id === issue.zone)?.name}: ${issue.title}`, hold, issue.id);
        sfx.notify();
      } else if (e.kind === "expired" && issue && !issue.hidden && bannerDay) {
        sfx.fail();
      } else if (e.kind === "expired" && issue && !issue.hidden) {
        note(`Ran out of time: ${issue.title}`, hold);
        sfx.fail();
        bus.emit("shake", { intensity: 0.006 });
      } else if ((e.kind === "resolved" || e.kind === "delegated") && issue) {
        sfx.success();
        bus.emit("burst", { npc: issue.npc });
      } else if (e.kind === "delegate_failed" && issue) {
        note(`${scenario.npcs.find((n) => n.id === e.detail)?.name} couldn't sort out ${issue.title.toLowerCase()}`, hold);
        sfx.fail();
      } else if (e.kind === "turning_point" && !shownTp.current) {
        shownTp.current = true;
        sfx.ring();
        setCutscene(true);
      }
    }
    // A recap from the same step as the turning point is stale: the cutscene takes over.
    if (state.recaps.length > p.recaps.length && !state.ended && !hold) {
      const day = state.recaps.at(-1)!.day;
      // Quick mode: no recap modal, just a short non-blocking note (bus "dayDone" for a banner).
      if (scenario.recapModal === false) {
        bus.emit("dayDone", { day });
        const r = state.recaps.at(-1)!;
        setDayBanner({ id: Date.now(), text: `${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][day]} done`, sub: `${r.resolved + r.delegated} handled · ${r.expired} ran out` });
      } else setRecapDay(day);
    }
  }, [state, scenario, floater, note, setCutscene, setRecapDay]);

  const talk = useCallback(
    (issue: Issue) => {
      sfx.click();
      dispatch({ type: "talk", issue: issue.id });
    },
    [dispatch],
  );

  // Phaser -> React: interact with an NPC, entering a zone.
  useEffect(() => {
    const onInteract = ({ npc }: { npc: string }) => {
      const st = useGame.getState().state;
      if (!st || st.dialogue) return;
      const rank = { high: 0, medium: 1, low: 2 };
      const issue = scenario.issues.filter((i) => i.npc === npc && st.issues[i.id].status === "open").sort((a, b) => rank[a.severity] - rank[b.severity])[0];
      if (issue) talk(issue);
      else {
        const n = scenario.npcs.find((x) => x.id === npc);
        if (n && n.id !== "laptop") toast(`${n.name}: "All good here for now."`);
      }
    };
    const onZone = ({ zone }: { zone: string }) => {
      const st = useGame.getState().state;
      if (zone && st && zone !== st.zone && !st.dialogue) dispatch({ type: "move", zone });
    };
    bus.on("interact", onInteract);
    bus.on("zone", onZone);
    return () => {
      bus.off("interact", onInteract);
      bus.off("zone", onZone);
    };
  }, [scenario, talk, dispatch, toast]);

  const choose = (option: "a" | "b" | "c" | "d") => {
    if (!state?.dialogue) return;
    const issue = scenario.issues.find((i) => i.id === state.dialogue!.issue)!;
    const node = scenario.nodes.find((n) => n.id === state.dialogue!.node)!;
    const opt = node.options.find((o) => o.id === option)!;
    sfx.click();
    dispatch({ type: "choose", issue: issue.id, option });
    if (opt.reaction) {
      bus.emit("emote", { npc: issue.npc, emote: opt.reaction.emote });
      setReaction({ npc: node.npc, expression: opt.reaction.expression, line: opt.reaction.line });
      setLastReaction(`${node.npc}:${opt.reaction.expression}`);
      // A spoken reaction stays long enough to read; a silent one is a short beat for the floaters.
      setTimeout(() => setReaction(null), settings.reducedMotion ? 600 : opt.reaction.line ? 1500 : 700);
    }
    if (opt.effects.budget && opt.effects.budget < -400) bus.emit("shake", { intensity: 0.004 });
  };

  const goTo = (i: Issue) => {
    if (settings.view === "list" || settings.reducedMotion || !ready) talk(i);
    else bus.emit("walkTo", { npc: i.npc, thenInteract: true });
  };

  const onCheckpointDone = (due: CheckpointDue, r: CheckpointResult) => {
    setAnswers((a) => [...a, r.checkpoint]);
    setIntegrity((x) => [...x, ...r.integrity]);
    if (due.kind === "order") dispatch({ type: "orderAnswer", ranking: orderRanking ?? [] });
    else dispatch({ type: "checkpointDone", id: due.id });
    setOrderRanking(null);
  };

  const finish = (res: { results: CheckpointResult[]; story: RealStory }) => {
    const all = [...answers, ...res.results.map((r) => r.checkpoint)];
    const ints = [...integrity, ...res.results.flatMap((r) => r.integrity)];
    if (sandbox || !state || !profile) return router.push("/admin");
    const card = buildMapCard({
      attemptId,
      scenario,
      state,
      answers: all,
      integrity: ints,
      realStory: res.story,
      challenge,
      candidate: { displayName: profile.displayName, university: profile.university || undefined, verified: profile.verified },
      timeMultiplier: profile.accommodations.timeMultiplier,
    });
    const s = store();
    s.saveCard(card);
    s.share(attemptId, challenge.id, false);
    s.saveRun({ attemptId, challengeId: challenge.id, scenarioId: `map:${mapId}`, seed: state.seed, state: { t: state.t, ended: true }, extra: { map: mapId, log: useGame.getState().log, answers: all, integrity: ints, length: state.length }, status: "finished", startedAt: new Date().toISOString(), practice: false });
    router.push(`/results/${attemptId}`);
  };

  // Test hooks for Playwright (A11). Only with NEXT_PUBLIC_TEST_HOOKS=1.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TEST_HOOKS !== "1") return;
    const w = window as unknown as { __tp?: unknown };
    w.__tp = {
      getState: () => useGame.getState().state,
      log: () => useGame.getState().log,
      error: () => useGame.getState().error,
      moveTo: (zone: string) => dispatch({ type: "move", zone }),
      talk: (npc: string) => bus.emit("interact", { npc }),
      act: (issue: string, action: "talk" | "delegate" | "defer", arg?: string) =>
        action === "talk" ? dispatch({ type: "talk", issue }) : action === "delegate" ? dispatch({ type: "delegate", issue, to: arg! }) : dispatch({ type: "defer", issue, reason: arg ?? scenario.deferReasons[0] }),
      choose: (option: "a" | "b" | "c" | "d") => dispatch({ type: "choose", issue: useGame.getState().state!.dialogue!.issue, option }),
      setClock: (time: string) => {
        const target = parseTime(time);
        for (let i = 0; i < 50; i++) {
          const st = useGame.getState().state;
          if (!st || st.ended || st.t >= target || st.dialogue) break;
          for (const c of st.checkpointsDue) dispatch(c.kind === "order" ? { type: "orderAnswer", ranking: [] } : { type: "checkpointDone", id: c.id });
          dispatch({ type: "wait" });
        }
      },
      openIssues: () => openIssues(scenario, useGame.getState().state!).map((i) => i.id),
    };
    return () => {
      delete w.__tp;
    };
  }, [dispatch, scenario]);

  const logLen = useGame((g) => g.log.length);
  const showCoach = screen === "play" && coach.current && logLen === 0;
  const due = state?.checkpointsDue[0];
  const showCheckpoint = !!due && !reaction && !cutscene && recapDay === undefined;
  const kpis = useMemo(() => (state?.ended ? computeKpis(scenario, state) : []), [state, scenario]);
  // Dialogue wording variants cached at publish (B.3), picked by the run's seed. Ids and effects never change.
  const seed = state?.seed;
  const worded = useMemo(() => (seed && !challenge.id.startsWith("map-") ? scenarioForRun(store(), challenge.id, scenario, seed) : scenario), [seed, scenario, challenge.id]);
  const node = state?.dialogue ? worded.nodes.find((n) => n.id === state.dialogue!.node) : undefined;

  return (
    // Framer animations follow the game's reduced-motion setting as well as the OS preference.
    <MotionConfig reducedMotion={settings.reducedMotion ? "always" : "user"}>
    <div className={cn(pixelBody.className, "fixed inset-0 z-[60] overflow-hidden bg-[#2e222f] text-[#2e222f]")} data-testid="game-shell" data-screen={screen} data-ready={hydrated ? "1" : "0"} data-saw-loading={sawLoading ? "1" : "0"} data-last-reaction={lastReaction}>
      {/* Title: a still of the map, so the first screen paints fast on phones (A.20). The live map starts at the avatar step. */}
      {screen === "title" && <TitleBackdrop mapId={mapId} label={`${scenario.title}, seen from above`} />}
      {screen === "avatar" && <MapCanvas scenario={scenario} avatar={avatar.look} attract label={`${scenario.title}, seen from above`} />}
      {screen === "title" && <TitleScreen scenario={scenario} onStart={start} canResume={!!resumable} onResume={resume} brief={challenge.id.startsWith("map-") ? undefined : challenge} />}
      {screen === "avatar" && <AvatarCreator onDone={begin} />}
      {(screen === "loading" || screen === "play" || screen === "results") && state && (
        <>
          {settings.view === "map" ? (
            <MapCanvas scenario={scenario} avatar={avatar.look} label="Top-down map of the market. Use the issue list or list view for the same actions." />
          ) : (
            <ListView scenario={scenario} state={state} onTalk={talk} onMove={(z) => dispatch({ type: "move", zone: z })} onDelegate={(i, to) => dispatch({ type: "delegate", issue: i.id, to })} onDefer={(i, r) => dispatch({ type: "defer", issue: i.id, reason: r })} />
          )}
          <AnimatePresence>{screen === "loading" && <LoadingScreen key="loading" ready={ready} onDone={() => setScreen(state.ended ? "results" : "play")} />}</AnimatePresence>
        </>
      )}
      {screen === "play" && state && (
        <>
          {/* HUD: hidden while the cutscene plays so only the cutscene is on screen. */}
          {!cutscene && (
            <div className="tp-scale pointer-events-none absolute inset-x-2 top-2 z-20 flex items-start justify-between gap-2" data-testid="hud">
              <div className="pointer-events-auto"><Resources scenario={scenario} state={state} /></div>
              <div className="pointer-events-auto absolute left-1/2 top-0 -translate-x-1/2 max-sm:static max-sm:translate-x-0"><Clock state={state} turnBased={state.turnBased} /></div>
              <div className="pointer-events-auto flex gap-1 max-sm:flex-col">
                <PixelButton tone="plain" size="sm" className="min-h-9" onClick={() => setSettings({ view: settings.view === "map" ? "list" : "map" })} data-testid="toggle-view" aria-label={settings.view === "map" ? "List view" : "Map view"}>
                  {settings.view === "map" ? "List" : "Map"}
                </PixelButton>
                <PixelButton tone="plain" size="sm" className="min-h-9 min-w-9" onClick={() => setPaused(true)} aria-label="Pause" data-testid="pause">
                  <span aria-hidden className="tracking-[-0.1em]">❚❚</span>
                </PixelButton>
              </div>
            </div>
          )}
          {/* One tracker: bottom sheet on phones, right-hand quest log on desktop. Out of the way while talking. */}
          {/* List view already lists every issue by place, so it only needs the Wait control. */}
          {!cutscene && !node && !reaction && settings.view === "list" && (
            // A solid footer band: list cards scroll under it instead of being covered by a floating button.
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 border-t-[3px] border-[#2e222f] bg-[#5f9a52] px-3 py-2">
              {showCoach && !showCheckpoint && (
                <p className="rounded-[4px] border-2 border-[#2e222f] bg-[#ffd166] px-2 py-1 text-[14px] font-semibold text-[#2e222f]" role="status" data-testid="coach">
                  Press Talk on a problem to start. Wait for news lets time pass.
                </p>
              )}
              <PixelButton tone="plain" onClick={() => dispatch({ type: "wait" })} data-testid="wait">Wait for news ▸▸</PixelButton>
            </div>
          )}
          {!cutscene && !node && !reaction && !showCheckpoint && settings.view === "map" && (
            <div className="tp-scale absolute inset-x-2 bottom-2 z-20 sm:inset-x-auto sm:bottom-auto sm:right-2 sm:top-[3.25rem]">
              <IssueTracker coach={showCoach && !cutscene && !showCheckpoint} scenario={scenario} state={state} onGo={goTo} onDelegate={(i, to) => dispatch({ type: "delegate", issue: i.id, to })} onDefer={(i, r) => dispatch({ type: "defer", issue: i.id, reason: r })} onWait={() => dispatch({ type: "wait" })} />
            </div>
          )}
          {/* A pixel frame around the Phaser minimap (160x120, 12 px from the corner; hidden when frozen or short). */}
          {settings.view === "map" && !frozen && (
            <div className="pointer-events-none absolute bottom-[9px] right-[9px] z-10 h-[126px] w-[166px] rounded-[4px] border-[3px] border-[#2e222f] shadow-[0_3px_0_#2e222f] [@media(max-height:479px)]:hidden" aria-hidden data-testid="minimap-frame" />
          )}
          {!cutscene && <Toasts />}
          <AnimatePresence>
            {dayBanner && !cutscene && (
              <motion.div key={dayBanner.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-[38%] z-30 flex justify-center px-3" role="status" data-testid="day-banner">
                <Panel tone="ink" className="px-5 py-2 text-center">
                  <p className={cn(pixelTitle.className, "text-[14px] uppercase text-[#ffd166] sm:text-[16px]")}>{dayBanner.text}</p>
                  <p className="mt-1 text-[14px]">{dayBanner.sub}</p>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
          {error && <p role="alert" className="absolute bottom-40 left-1/2 z-30 -translate-x-1/2 rounded bg-white px-2 text-sm">{error}</p>}
          {node && !reaction && !cutscene && recapDay === undefined && (
            <DialogueBox key={state.dialogue!.issue} scenario={scenario} state={state} node={node} speed={settings.textSpeed} onChoose={choose} onLeave={() => dispatch({ type: "leave" })} />
          )}
          {reaction?.line && <ReactionBox scenario={scenario} {...reaction} />}
          {/* A silent reaction shows no box, but input still waits for the beat to end (a checkpoint may be next). */}
          {reaction && !reaction.line && <div className="absolute inset-0 z-40" data-testid="reaction" aria-hidden />}
          {cutscene && (
            <Cutscene
              scenario={scenario}
              state={state}
              onDone={() => {
                setCutscene(false);
                const d = scenario.turningPoint.disruptions.find((x) => x.id === state.tp.disruptionId)!;
                bus.emit("shake", { intensity: 0.01 });
                bus.emit("pan", { npcs: d.spawn.map((id) => scenario.issues.find((i) => i.id === id)!.npc) });
              }}
            />
          )}
          {recapDay !== undefined && !cutscene && <Recap state={state} day={recapDay} onDone={() => setRecapDay(undefined)} />}
          {showCheckpoint && due && profile && (
            due.kind === "order" && !orderRanking ? (
              <OrderPick scenario={scenario} state={state} onDone={setOrderRanking} />
            ) : (
              <Checkpoint
                key={due.id}
                id={due.kind === "order" ? "order" : due.id}
                nodeId={due.issue ?? "order"}
                kind="decision"
                title={due.kind === "order" ? "The order question" : due.kind === "explain" ? "Explain your pick" : "Checkpoint"}
                question={interviewQuestion(scenario, state, due).question}
                questionSource={interviewQuestion(scenario, state, due).source}
                attemptId={attemptId}
                multiplier={profile.accommodations.timeMultiplier}
                defaultMode={profile.defaultMode}
                textOnly={profile.accommodations.textOnly}
                persistMedia={!sandbox}
                variant="game"
                interviewer={((n) => (n ? { name: n.name, role: `${n.role} · asking for the hiring panel`, portrait: n.portrait } : undefined))(scenario.npcs.find((n) => n.id === scenario.issues.find((i) => i.id === due.issue)?.npc))}
                onDone={(r) => onCheckpointDone(due, r)}
              />
            )
          )}
          {paused && <PauseMenu onResume={() => setPaused(false)} />}
          {state.ended && !due && (
            <div className="absolute inset-0 z-40">
              <PixelButton className="absolute bottom-4 left-1/2 -translate-x-1/2" onClick={() => setScreen("results")} data-testid="to-results">
                See the week
              </PixelButton>
            </div>
          )}
        </>
      )}
      {screen === "results" && state && phase === "game" && <ResultsScreen scenario={scenario} state={state} kpis={kpis} onContinue={() => setPhase("real-life")} />}
      {screen === "results" && state && phase === "real-life" && profile && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#2e222f]/85 p-3">
          <Panel className="w-[min(640px,96vw)] p-4">
            <RealLife attemptId={attemptId} nodeId="rl" prompt="When have you faced something like this in real life?" profile={profile} persistMedia={!sandbox} variant="game" onModeChange={() => {}} onDone={finish} />
          </Panel>
        </div>
      )}
      {/* Big screens (1080p and up): the HUD grows with the map so it never looks lost. */}
      <style>{`@media (min-width: 1700px) and (min-height: 950px) { [data-testid="game-shell"] .tp-scale { zoom: 1.25; } [data-testid="game-shell"] .tp-dialogue { zoom: 1.25; } [data-testid="game-shell"] [data-testid="checkpoint"] > div { zoom: 1.2; } }`}</style>
      {sandbox && <p className="absolute left-1/2 top-0 z-[70] -translate-x-1/2 bg-amber-200 px-3 text-sm font-semibold">Preview as candidate · nothing is saved</p>}
    </div>
    </MotionConfig>
  );
}

/** First half of the order question: rank the open problems; the "why" is the checkpoint answer (A9). */
function OrderPick({ scenario, state, onDone }: { scenario: ReturnType<typeof getMapScenario> & object; state: GameState; onDone: (r: string[]) => void }) {
  const open = openIssues(scenario, state);
  const [rank, setRank] = useState<string[]>([]);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#2e222f]/75 p-3" role="dialog" aria-label="The order question" data-testid="order-pick">
      <Panel className="w-[min(520px,94vw)] p-4">
        <Eyebrow>Checkpoint</Eyebrow>
        <h2 className={cn(pixelTitle.className, "mt-1.5 text-[13px] leading-relaxed")}>You&apos;ve got {open.length} open problems. Which are you going to first?</h2>
        <p className="mt-1 text-sm">Tap them in the order you&apos;ll handle them. Then say why.</p>
        <ul className="mt-3 space-y-1.5">
          {open.map((i) => {
            const n = rank.indexOf(i.id);
            return (
              <li key={i.id}>
                <button className={cn("flex min-h-11 w-full items-center gap-2 rounded-[4px] border-2 border-[#2e222f] p-2 text-left text-[15px] shadow-[inset_0_-3px_0_#e8d9b5] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[#ffd166]", n >= 0 ? "bg-[#ffe08a]" : "bg-white hover:bg-[#fff1c4]")} onClick={() => setRank((r) => (n >= 0 ? r.filter((x) => x !== i.id) : [...r, i.id]))} data-testid={`rank-${i.id}`}>
                  <span className={cn(pixelTitle.className, "flex size-6 shrink-0 items-center justify-center rounded-[3px] border-2 border-[#2e222f] text-[10px]", n >= 0 ? "bg-[#2e222f] text-[#ffd166]" : "bg-white")}>{n >= 0 ? n + 1 : ""}</span>
                  {i.title}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-end">
          <PixelButton disabled={rank.length < Math.min(open.length, 2)} onClick={() => onDone(rank)} data-testid="rank-done">
            Next: say why
          </PixelButton>
        </div>
      </Panel>
    </div>
  );
}
