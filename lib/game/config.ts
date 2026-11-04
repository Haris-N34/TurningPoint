// Every game-feel constant in one place (PRD v2, A5). Changing these never changes what a candidate
// is scored on: KPIs use game time and outcomes only, never real-time speed.

export const GAME = {
  /** Working day in game minutes from midnight. */
  dayStart: 9 * 60,
  dayEnd: 18 * 60,
  /** Mon=0 .. Fri=4 are working days; Sat=5 is market day (finale). */
  workDays: 5,
  dayNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const,
  /** Walking costs this many game minutes per 10 tiles of path (zone to zone, fixed per route). */
  walkMinutesPer10Tiles: 10,
  /** Ambient drift while on the map: game minutes per real second (map view only, never in turn-based). */
  driftMinutesPerSecond: 2,
  /** Delegating costs this much morale and time. */
  delegateMoraleCost: 5,
  delegateMinutes: 15,
  /** Deferring takes a short moment and applies half the expiry consequence, with no escalation. */
  deferMinutes: 5,
  deferPenaltyShare: 0.5,
  /** Delegation succeeds when volunteer reliability x 100 + (morale - 50) / 2 reaches this, per severity. */
  delegateThreshold: { low: 40, medium: 55, high: 70 },
  /** Checkpoint caps (A9). */
  seededCheckpoints: [2, 3] as const,
  maxVideoCheckpoints: 4,
  /** The order question fires the first time this many issues are open at once. */
  orderQuestionOpenIssues: 3,
  /** Evening recap length in real seconds (UI). */
  recapSeconds: 10,
} as const;

export type Severity = keyof typeof GAME.delegateThreshold;
