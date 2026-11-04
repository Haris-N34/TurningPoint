import { GAME } from "./config";

// Game time is minutes since Monday 00:00. "Wed 14:20" <-> 2*1440 + 14*60 + 20.

export const DAY = 24 * 60;

export function parseTime(s: string): number {
  const m = s.trim().match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Bad game time "${s}". Use e.g. "Wed 14:20".`);
  const day = GAME.dayNames.indexOf(m[1] as (typeof GAME.dayNames)[number]);
  return day * DAY + Number(m[2]) * 60 + Number(m[3]);
}

export function formatTime(t: number): string {
  const day = Math.floor(t / DAY);
  const mins = t - day * DAY;
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${GAME.dayNames[Math.min(day, 6)]} ${hh}:${mm}`;
}

export const dayOf = (t: number) => Math.floor(t / DAY);
export const minuteOfDay = (t: number) => t - dayOf(t) * DAY;
export const dayStartOf = (day: number) => day * DAY + GAME.dayStart;
export const dayEndOf = (day: number) => day * DAY + GAME.dayEnd;

/** 0..1 through the working day (for the HUD ring and lighting). */
export function dayProgress(t: number): number {
  const m = minuteOfDay(t);
  return Math.max(0, Math.min(1, (m - GAME.dayStart) / (GAME.dayEnd - GAME.dayStart)));
}

/** Human duration for countdowns, e.g. "3h 20m" or "1d 2h". */
export function formatDuration(mins: number): string {
  if (mins <= 0) return "now";
  const d = Math.floor(mins / DAY);
  const h = Math.floor((mins % DAY) / 60);
  const m = mins % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}
