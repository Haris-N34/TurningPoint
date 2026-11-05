import type { SavedRun, Store } from "@/lib/store/store";

// Practice mode (C8.1). Same game, same checkpoints. A practice run is never shared with an employer
// (the store refuses), never counted in employer views, and is deleted from this device after 24 hours.

export const PRACTICE_PREFIX = "practice:";
export const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000;
export const PRACTICE_SCENARIO = "sample";
export const PRACTICE_CHALLENGE = { id: `${PRACTICE_PREFIX}${PRACTICE_SCENARIO}`, title: "Practice run", company: "Turning Point practice" } as const;

export const isPracticeChallenge = (challengeId: string | undefined) => !!challengeId?.startsWith(PRACTICE_PREFIX);

const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

/** When this practice run is deleted: 24 hours after it started. */
export const practiceExpiresAt = (run: Pick<SavedRun, "startedAt">) => plus(run.startedAt, PRACTICE_TTL_MS);

/**
 * Delete practice runs and cards older than 24 hours. Age counts from the run's start, or from the card's
 * finish when the run is gone. Returns the attempt ids removed, so their recordings can go too.
 */
export function purgeExpiredPractice(s: Store, now: Date): string[] {
  const t = now.getTime();
  const expired = (iso: string) => t - Date.parse(iso) > PRACTICE_TTL_MS;
  const ids = new Set<string>();
  for (const r of s.listRuns()) if (r.practice && expired(r.startedAt)) ids.add(r.attemptId);
  for (const c of s.listCards({ practice: true })) {
    const run = s.getRun(c.attemptId);
    if (run ? expired(run.startedAt) : expired(c.finishedAt)) ids.add(c.attemptId);
  }
  for (const id of ids) s.deleteAttempt(id);
  return [...ids].sort();
}

export type MediaPurger = { deletePrefix: (prefix: string) => Promise<void> };

/** Store purge plus the recordings (IndexedDB keys are `<attemptId>/<checkpointId>`). */
export async function purgePracticeData(s: Store, m: MediaPurger, now: Date): Promise<string[]> {
  const ids = purgeExpiredPractice(s, now);
  for (const id of ids) {
    try {
      await m.deletePrefix(`${id}/`);
    } catch {
      // No IndexedDB here: nothing was recorded on this device.
    }
  }
  return ids;
}
