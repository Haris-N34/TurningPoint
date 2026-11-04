"use client";

import { Game } from "@/components/game/Game";
import { getScenario } from "@/content/scenarios";

/** Play a base template directly (development and practice). */
export function TemplatePlay({ scenarioId }: { scenarioId: string }) {
  const scenario = getScenario(scenarioId)!;
  return <Game scenario={scenario} challenge={{ id: scenarioId, title: scenario.title, company: "Turning Point demo" }} />;
}
