"use client";

import { Game } from "@/components/game/Game";
import { getScenario } from "@/content/scenarios";
import { PRACTICE_CHALLENGE, PRACTICE_SCENARIO } from "@/lib/practice/practice";

/** A free practice run (C8.1): the same game and checkpoints, never shared, deleted after 24 hours. */
export function PracticePlay() {
  const scenario = getScenario(PRACTICE_SCENARIO)!;
  return (
    <>
      <p className="sticky top-0 z-30 border-b border-dashed border-input/60 bg-secondary px-4 py-1.5 text-center text-xs font-medium tracking-wide text-secondary-foreground" role="status" data-testid="practice-banner">
        Practice run · nothing is shared with employers · deleted from this device after 24 hours
      </p>
      <Game scenario={scenario} challenge={{ ...PRACTICE_CHALLENGE }} />
    </>
  );
}
