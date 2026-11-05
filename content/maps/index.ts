import { parseMapScenario, type MapScenario } from "@/lib/game/schema";
import clientPivot from "./client-pivot.json";
import launchWeek from "./launch-week.json";

// Every v2 map scenario the game can play.
const RAW: Record<string, unknown> = { "launch-week": launchWeek, "client-pivot": clientPivot };

export const MAP_IDS = Object.keys(RAW);
const cache = new Map<string, MapScenario>();
export function getMapScenario(id: string): MapScenario | undefined {
  if (!(id in RAW)) return undefined;
  if (!cache.has(id)) cache.set(id, parseMapScenario(RAW[id]));
  return cache.get(id);
}

/** Map version of a classic template, if one exists (so challenges built on it play as a map game). */
export const MAP_FOR_TEMPLATE: Record<string, string> = { "launch-week": "launch-week" };
