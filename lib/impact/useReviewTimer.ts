"use client";

import { useEffect } from "react";
import { store } from "@/lib/store/store";
import { logReviewSession, reviewStopwatch } from "./events";

/** Records visible time on a recruiter card (G.1 recruiter minutes). Pauses while the tab is hidden. */
export function useReviewTimer(attemptId: string, challengeId: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const w = reviewStopwatch(() => Date.now());
    const flush = () => { try { logReviewSession(store(), { attemptId, challengeId, ms: w.take() }); } catch { /* telemetry never breaks the screen */ } };
    const vis = () => { if (document.visibilityState === "hidden") flush(); else w.resume(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("pagehide", flush); flush(); };
  }, [attemptId, challengeId, active]);
}
