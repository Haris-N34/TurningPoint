"use client";

import { create } from "zustand";
import { GAME } from "./config";
import { GameError, newGame, step, type Action, type GameLength, type GameState } from "./engine";
import type { Look, MapScenario } from "./schema";
import { DEFAULT_AVATAR } from "./sprites";

// UI store for the v2 game (PRD v2, A2). The engine state lives here, but every change goes through
// the pure engine `step`, and every action is appended to the input log so a run can be replayed.

export type Screen = "title" | "avatar" | "loading" | "play" | "results";
export type Floater = { id: number; text: string; tone: "good" | "bad" | "neutral"; key: string };
export type Toast = { id: number; text: string };

type Settings = { muted: boolean; music: boolean; reducedMotion: boolean; textSpeed: "slow" | "normal" | "fast" | "instant"; turnBased: boolean; view: "map" | "list"; length: GameLength };

type Store = {
  scenario?: MapScenario;
  state?: GameState;
  log: Action[];
  screen: Screen;
  paused: boolean;
  settings: Settings;
  avatar: { look: Look; name: string };
  floaters: Floater[];
  toasts: Toast[];
  cutscene: boolean;
  recapDay?: number;
  error?: string;
  init: (s: MapScenario, seed: string, opts: { turnBased: boolean; view?: "map" | "list"; length?: GameLength }) => void;
  dispatch: (a: Action) => GameState | undefined;
  setScreen: (s: Screen) => void;
  setPaused: (p: boolean) => void;
  setSettings: (s: Partial<Settings>) => void;
  setAvatar: (a: Partial<{ look: Look; name: string }>) => void;
  floater: (text: string, tone: Floater["tone"], key: string) => void;
  toast: (text: string) => void;
  setCutscene: (on: boolean) => void;
  setRecapDay: (d?: number) => void;
  restore: (s: MapScenario, state: GameState, log: Action[]) => void;
};

let nextId = 1;

export const useGame = create<Store>((set, get) => ({
  log: [],
  screen: "title",
  paused: false,
  settings: { muted: false, music: true, reducedMotion: false, textSpeed: "normal", turnBased: false, view: "map", length: "quick" },
  avatar: { look: DEFAULT_AVATAR, name: "" },
  floaters: [],
  toasts: [],
  cutscene: false,
  init: (s, seed, opts) =>
    set({
      scenario: s,
      state: newGame(s, seed, { turnBased: opts.turnBased, length: opts.length ?? get().settings.length }),
      log: [],
      settings: { ...get().settings, turnBased: opts.turnBased, view: opts.view ?? get().settings.view, length: opts.length ?? get().settings.length },
      error: undefined,
    }),
  restore: (s, state, log) => set({ scenario: s, state, log }),
  dispatch: (a) => {
    const { scenario, state, log } = get();
    if (!scenario || !state) return;
    try {
      const next = step(scenario, state, a);
      if (next === state) return state;
      set({ state: next, log: a.type === "drift" ? log : [...log, a], error: undefined });
      return next;
    } catch (e) {
      set({ error: e instanceof GameError ? e.message : String(e) });
      return undefined;
    }
  },
  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
  setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
  setAvatar: (a) => set({ avatar: { ...get().avatar, ...a } }),
  floater: (text, tone, key) => {
    const f = { id: nextId++, text, tone, key };
    set({ floaters: [...get().floaters, f] });
    setTimeout(() => set({ floaters: get().floaters.filter((x) => x.id !== f.id) }), 1400);
  },
  toast: (text) => {
    const t = { id: nextId++, text };
    set({ toasts: [...get().toasts.slice(-2), t] });
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== t.id) }), 3500);
  },
  setCutscene: (cutscene) => set({ cutscene }),
  setRecapDay: (recapDay) => set({ recapDay }),
}));

export const DRIFT_PER_SECOND = GAME.driftMinutesPerSecond;
