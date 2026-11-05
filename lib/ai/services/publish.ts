import { getMapScenario, MAP_FOR_TEMPLATE } from "@/content/maps";
import type { Challenge } from "@/lib/challenge/challenge";
import type { Store } from "@/lib/store/store";
import type { RunOptions } from "../run";
import { loadVariants, makeVariants, saveVariants, type VariantTable } from "./variants";

// Publish-time AI (B.3): game content is generated once when a challenge is published and cached with it.
// The game only ever reads what is stored here; it never calls a model.

export function preparePublishedContent(st: Store, c: Pick<Challenge, "id" | "templateId">, opts: RunOptions = {}): VariantTable | undefined {
  const mapId = MAP_FOR_TEMPLATE[c.templateId];
  const map = mapId ? getMapScenario(mapId) : undefined;
  if (!map) return undefined;
  const existing = loadVariants(st, c.id);
  if (existing) return existing;
  const table = makeVariants(map, opts);
  saveVariants(st, c.id, table);
  return table;
}
