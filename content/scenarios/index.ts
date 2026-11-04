import { parseScenario, type Scenario } from "@/lib/engine/schema";
import sample from "./sample.json";

// Every scenario the app can play. Add Launch Week and Client Rescue here when they land.
const RAW: Record<string, unknown> = { sample };

export const SCENARIO_IDS = Object.keys(RAW);

const cache = new Map<string, Scenario>();
export function getScenario(id: string): Scenario | undefined {
  if (!(id in RAW)) return undefined;
  if (!cache.has(id)) cache.set(id, parseScenario(RAW[id]));
  return cache.get(id);
}
