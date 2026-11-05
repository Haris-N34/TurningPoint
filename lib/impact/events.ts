import { z } from "zod";
import type { Store } from "@/lib/store/store";

// Local event logs behind the Part G metrics that no other feature records (G.1).
// Recruiter review time: visible seconds a recruiter spends on one card. Learning survey: the optional
// post-game question "I learned something about how I work" (1 to 5). Both are keyed by attempt only,
// hold no candidate name, email or answer text, and are removed with the attempt.

export const REVIEW_SESSIONS_KEY = "review_sessions";
export const SURVEY_KEY = "learning_survey";
/** One open card counts at most 30 minutes, so a tab left open overnight does not skew the median. */
export const MAX_SESSION_MS = 30 * 60 * 1000;

export const ReviewSessionSchema = z.object({ attemptId: z.string(), challengeId: z.string(), ms: z.number().min(0), at: z.string() });
export type ReviewSession = z.infer<typeof ReviewSessionSchema>;
export const SurveyResponseSchema = z.object({ attemptId: z.string(), rating: z.number().int().min(1).max(5), at: z.string() });
export type SurveyResponse = z.infer<typeof SurveyResponseSchema>;

export const listReviewSessions = (s: Store): ReviewSession[] => s.getJSON(REVIEW_SESSIONS_KEY, z.array(ReviewSessionSchema)) ?? [];
export const listSurveyResponses = (s: Store): SurveyResponse[] => s.getJSON(SURVEY_KEY, z.array(SurveyResponseSchema)) ?? [];

/** Record one card-viewing session. Sessions under a second are noise (a bounce) and are dropped. */
export function logReviewSession(s: Store, session: Omit<ReviewSession, "at"> & { at?: string }) {
  if (session.ms < 1000) return;
  const row = ReviewSessionSchema.parse({ ...session, ms: Math.min(session.ms, MAX_SESSION_MS), at: session.at ?? new Date().toISOString() });
  s.setJSON(REVIEW_SESSIONS_KEY, [...listReviewSessions(s), row]);
}

/** One answer per attempt; answering again replaces it. Optional and never shown to employers. */
export function saveSurveyResponse(s: Store, attemptId: string, rating: number, at = new Date().toISOString()) {
  const row = SurveyResponseSchema.parse({ attemptId, rating, at });
  s.setJSON(SURVEY_KEY, [...listSurveyResponses(s).filter((r) => r.attemptId !== attemptId), row]);
  return row;
}

export const surveyFor = (s: Store, attemptId: string) => listSurveyResponses(s).find((r) => r.attemptId === attemptId);

/** Median, or null for no values. Even counts average the middle two. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Visible-time stopwatch for one card view. Pure: the caller supplies the clock and visibility events. */
export function reviewStopwatch(now: () => number) {
  let total = 0;
  let since: number | null = now();
  return {
    pause() { if (since !== null) { total += now() - since; since = null; } },
    resume() { if (since === null) since = now(); },
    /** Stop and return visible ms so far; the watch restarts from zero. */
    take() { this.pause(); const t = total; total = 0; return t; },
  };
}
