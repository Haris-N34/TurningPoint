import { z } from "zod";
import { CardSchema, passNeedsReason, PASS_REASON_ERROR, type Card } from "@/lib/card/types";
import { isPracticeChallenge } from "@/lib/practice/practice";

// Local-only data layer (demo scope: no database). Everything lives in one storage backend,
// localStorage in the browser and an in-memory map in tests. Recordings live in IndexedDB (media.ts).

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export class MemoryKV implements KV {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

const PREFIX = "tp:";

/**
 * Writes that never throw (QA night #22). A full disk (Safari stops at about 5 MB; the 200-candidate demo cohort
 * uses most of it) used to throw QuotaExceededError out of every save and crash the game. A failed write is kept
 * in memory for this session instead, reads see it, and `onFull` tells the app so it can warn.
 */
export function safeKV(inner: KV, onFull: (key: string) => void = () => {}): KV {
  const overlay = new Map<string, string>();
  const all = () => {
    const ks = new Set<string>(overlay.keys());
    for (let i = 0; i < inner.length; i++) {
      const k = inner.key(i);
      if (k != null) ks.add(k);
    }
    return [...ks];
  };
  return {
    getItem: (k) => (overlay.has(k) ? overlay.get(k)! : inner.getItem(k)),
    setItem(k, v) {
      try {
        inner.setItem(k, v);
        overlay.delete(k);
      } catch {
        overlay.set(k, v);
        onFull(k);
      }
    },
    removeItem(k) {
      overlay.delete(k);
      try {
        inner.removeItem(k);
      } catch {
        // Nothing stored there to remove.
      }
    },
    // Fast path: with nothing held in memory, iterate the real storage directly.
    key: (i) => (overlay.size ? all()[i] ?? null : inner.key(i)),
    get length() {
      return overlay.size ? all().length : inner.length;
    },
  };
}

const warnFull = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("tp:storage-full"));
};

export const Role = z.enum(["candidate", "recruiter", "admin", "witness"]);
export type Role = z.infer<typeof Role>;

export const AccommodationsSchema = z.object({
  timeMultiplier: z.union([z.literal(1), z.literal(1.5), z.literal(2)]).default(1),
  textOnly: z.boolean().default(false),
  screenReader: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  lowBandwidth: z.boolean().default(false),
});
export type Accommodations = z.infer<typeof AccommodationsSchema>;

export const ProfileSchema = z.object({
  displayName: z.string().default(""),
  email: z.string().default(""),
  university: z.string().default(""),
  verified: z.boolean().default(false),
  defaultMode: z.enum(["video", "voice", "text"]).default("voice"),
  accommodations: AccommodationsSchema.default(AccommodationsSchema.parse({})),
  /** Off by default (PV2). */
  improvementOptIn: z.boolean().default(false),
  consentedToRecording: z.boolean().default(false),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ShareSchema = z.object({
  id: z.string(),
  attemptId: z.string(),
  challengeId: z.string(),
  reused: z.boolean(),
  createdAt: z.string(),
  revokedAt: z.string().optional(),
});
export type Share = z.infer<typeof ShareSchema>;

export const ReviewSchema = z.object({
  attemptId: z.string(),
  challengeId: z.string(),
  decision: z.enum(["shortlist", "hold", "pass"]),
  reason: z.string().optional(),
  note: z.string().optional(),
  at: z.string(),
}).refine(passNeedsReason, PASS_REASON_ERROR);
export type Review = z.infer<typeof ReviewSchema>;

/** A run in progress, saved after every step so it resumes on refresh (C2.4). */
export const SavedRunSchema = z.object({
  attemptId: z.string(),
  challengeId: z.string(),
  scenarioId: z.string(),
  seed: z.string(),
  // Engine RunState and pending checkpoint data; validated by the engine on load.
  state: z.unknown(),
  extra: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["playing", "paused", "finished"]),
  startedAt: z.string(),
  updatedAt: z.string(),
  practice: z.boolean().default(false),
});
export type SavedRun = z.infer<typeof SavedRunSchema>;

function read<T>(kv: KV, key: string, schema: z.ZodType<T>): T | undefined {
  const raw = kv.getItem(PREFIX + key);
  if (raw == null) return undefined;
  try {
    const r = schema.safeParse(JSON.parse(raw));
    return r.success ? r.data : undefined;
  } catch {
    return undefined;
  }
}

function write(kv: KV, key: string, value: unknown) {
  kv.setItem(PREFIX + key, JSON.stringify(value));
}

function keys(kv: KV, prefix: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < kv.length; i++) {
    const k = kv.key(i);
    if (k?.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length));
  }
  return out;
}

export function makeStore(raw: KV, now: () => Date = () => new Date(), opts: { onFull?: (key: string) => void } = {}) {
  const kv = safeKV(raw, opts.onFull ?? warnFull);
  const iso = () => now().toISOString();
  return {
    // Role
    getRole: (): Role => read(kv, "role", Role) ?? "candidate",
    setRole: (r: Role) => write(kv, "role", r),

    // Profile
    getProfile: (): Profile => read(kv, "profile", ProfileSchema) ?? ProfileSchema.parse({}),
    saveProfile(p: Partial<Profile>) {
      const merged = ProfileSchema.parse({ ...this.getProfile(), ...p });
      write(kv, "profile", merged);
      return merged;
    },

    // Runs
    getRun: (attemptId: string) => read(kv, `run:${attemptId}`, SavedRunSchema),
    saveRun(run: Omit<SavedRun, "updatedAt">) {
      // A practice challenge always makes a practice run (C8.1), whatever the caller passed.
      // A run keeps its first start: callers that save after every move pass "now" (QA night #44).
      const prev = read(kv, `run:${run.attemptId}`, SavedRunSchema);
      const startedAt = prev && prev.startedAt < run.startedAt ? prev.startedAt : run.startedAt;
      const full = SavedRunSchema.parse({ ...run, startedAt, practice: run.practice || isPracticeChallenge(run.challengeId), updatedAt: iso() });
      write(kv, `run:${run.attemptId}`, full);
      return full;
    },
    listRuns: (): SavedRun[] =>
      keys(kv, "run:").map((k) => read(kv, k, SavedRunSchema)).filter((r): r is SavedRun => !!r),
    /** The run to resume for a challenge, if one is unfinished. */
    activeRun(challengeId: string) {
      return this.listRuns()
        .filter((r) => r.challengeId === challengeId && r.status !== "finished")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    },

    // Cards
    getCard: (attemptId: string): Card | undefined => read(kv, `card:${attemptId}`, CardSchema),
    saveCard: (card: Card) => write(kv, `card:${card.attemptId}`, CardSchema.parse(card)),
    /** Real cards by default. Practice cards (C8.1) only with `{ practice: true }`, so no employer view lists them. */
    listCards: (opts: { practice?: boolean } = {}): Card[] =>
      keys(kv, "card:")
        .map((k) => read(kv, k, CardSchema))
        .filter((c): c is Card => !!c && isPracticeChallenge(c.challenge.id) === !!opts.practice),
    isPractice(attemptId: string) {
      return !!this.getRun(attemptId)?.practice || isPracticeChallenge(this.getCard(attemptId)?.challenge.id);
    },
    /** Remove one attempt: run, card, its shares and reviews. Recordings are cleared by the caller. */
    deleteAttempt(attemptId: string) {
      kv.removeItem(PREFIX + `run:${attemptId}`);
      kv.removeItem(PREFIX + `card:${attemptId}`);
      kv.removeItem(PREFIX + `camera-check:${attemptId}`);
      write(kv, "shares", this.listShares().filter((x) => x.attemptId !== attemptId));
      write(kv, "reviews", this.listReviews().filter((x) => x.attemptId !== attemptId));
      // Impact event logs (G.1) are keyed by attempt and go with it.
      for (const k of ["x:review_sessions", "x:learning_survey", "x:impact_demo_second_look"]) {
        const rows = read(kv, k, z.array(z.object({ attemptId: z.string() }).passthrough()));
        if (rows) write(kv, k, rows.filter((x) => x.attemptId !== attemptId));
      }
    },

    // Shares (C7.3, C7.4)
    listShares: (): Share[] => read(kv, "shares", z.array(ShareSchema)) ?? [],
    /** Returns undefined for a practice run: practice is never shared with an employer (C8.1). */
    share(attemptId: string, challengeId: string, reused: boolean): Share | undefined {
      if (isPracticeChallenge(challengeId) || this.isPractice(attemptId)) return undefined;
      const all = this.listShares();
      const existing = all.find((s) => s.attemptId === attemptId && s.challengeId === challengeId);
      if (existing && !existing.revokedAt) return existing;
      const s: Share = { id: `sh_${attemptId}_${challengeId}`, attemptId, challengeId, reused, createdAt: iso() };
      write(kv, "shares", [...all.filter((x) => x.id !== s.id), s]);
      return s;
    },
    revokeShare(attemptId: string, challengeId: string) {
      const all = this.listShares().map((s) =>
        s.attemptId === attemptId && s.challengeId === challengeId && !s.revokedAt ? { ...s, revokedAt: iso() } : s,
      );
      write(kv, "shares", all);
    },
    sharesFor(challengeId: string) {
      return this.listShares().filter((s) => s.challengeId === challengeId);
    },

    // Reviews (E3.7): a pass needs a reason.
    listReviews: (): Review[] => read(kv, "reviews", z.array(ReviewSchema)) ?? [],
    review(r: Omit<Review, "at">): Review {
      if (!passNeedsReason(r)) throw new Error("A pass needs a reason");
      const full = ReviewSchema.parse({ ...r, at: iso() });
      const rest = this.listReviews().filter((x) => !(x.attemptId === r.attemptId && x.challengeId === r.challengeId));
      write(kv, "reviews", [...rest, full]);
      return full;
    },
    reviewFor(attemptId: string, challengeId: string) {
      return this.listReviews().find((x) => x.attemptId === attemptId && x.challengeId === challengeId);
    },

    // Generic JSON slots for other features (challenges, witnesses, settings).
    getJSON: <T>(key: string, schema: z.ZodType<T>) => read(kv, `x:${key}`, schema),
    setJSON: (key: string, value: unknown) => write(kv, `x:${key}`, value),

    /**
     * Delete everything held for the candidate (C7.5): profile, runs, cards, shares, reviews of their
     * cards, witnesses, add-ons (E8.2) and ATS exports. Employer challenges and UI settings stay. Media is cleared
     * separately (media.clear), see deleteMyData.
     */
    deleteAll() {
      const candidateKeys = ["profile", "shares", "reviews", "x:witnesses", "x:ats_exports", "x:addons", "x:review_sessions", "x:learning_survey", "x:impact_demo_second_look"];
      for (const k of keys(kv, "")) {
        if (candidateKeys.includes(k) || k.startsWith("run:") || k.startsWith("card:") || k.startsWith("camera-check:") || /^x:(resume_private|invite|reported):/.test(k)) kv.removeItem(PREFIX + k);
      }
    },
  };
}

export type Store = ReturnType<typeof makeStore>;

let browserStore: Store | undefined;
/** The app's store. In the browser it uses localStorage; on the server a throwaway memory store. */
export function store(): Store {
  if (typeof window === "undefined") return makeStore(new MemoryKV());
  if (!browserStore) {
    let kv: KV;
    try {
      kv = window.localStorage;
      kv.setItem("tp:probe", "1");
      kv.removeItem("tp:probe");
    } catch {
      kv = new MemoryKV();
    }
    browserStore = makeStore(kv);
  }
  return browserStore;
}
