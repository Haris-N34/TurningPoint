import { challengeMap, type Challenge } from "@/lib/challenge/challenge";
import type { MapScenario } from "@/lib/game/schema";
import type { Store } from "@/lib/store/store";
import type { RunOptions } from "../run";
import { applyVariants, loadVariants, makeVariants, saveVariants, type VariantTable } from "./variants";

// Publish-time AI (B.3): game content is generated once when a challenge is published and cached with it.
// The game only ever reads what is stored here; it never calls a model.

/** The map a candidate plays for a challenge: cached wordings picked by the run's seed. A pure lookup. */
export function scenarioForRun(st: Store, challengeId: string, map: MapScenario, seed: string): MapScenario {
  return applyVariants(map, loadVariants(st, challengeId), seed);
}

/** Variants are made from the employer's edited map, so a tailored or edited line keeps its new wording. */
export function preparePublishedContent(st: Store, c: Pick<Challenge, "id" | "templateId" | "mapOverrides">, opts: RunOptions = {}): VariantTable | undefined {
  const map = challengeMap(c)?.map;
  if (!map) return undefined;
  const existing = loadVariants(st, c.id);
  if (existing) return existing;
  const table = makeVariants(map, opts);
  saveVariants(st, c.id, table);
  return table;
}
