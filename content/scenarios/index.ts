import { parseScenario, type Scenario } from "@/lib/engine/schema";
import sample from "./sample.json";
import launchWeek from "./launch-week.json";

// Every scenario the app can play.
const RAW: Record<string, unknown> = { sample, "launch-week": launchWeek };

export const SCENARIO_IDS = Object.keys(RAW);

const cache = new Map<string, Scenario>();
export function getScenario(id: string): Scenario | undefined {
  if (!(id in RAW)) return undefined;
  if (!cache.has(id)) cache.set(id, parseScenario(RAW[id]));
  return cache.get(id);
}
