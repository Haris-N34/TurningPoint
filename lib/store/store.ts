import { z } from "zod";
import { CardSchema, passNeedsReason, PASS_REASON_ERROR, type Card } from "@/lib/card/types";

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

export function makeStore(kv: KV, now: () => Date = () => new Date()) {
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
      const full = SavedRunSchema.parse({ ...run, updatedAt: iso() });
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
    listCards: (): Card[] => keys(kv, "card:").map((k) => read(kv, k, CardSchema)).filter((c): c is Card => !!c),

    // Shares (C7.3, C7.4)
    listShares: (): Share[] => read(kv, "shares", z.array(ShareSchema)) ?? [],
    share(attemptId: string, challengeId: string, reused: boolean): Share {
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
     * cards, witnesses and ATS exports. Employer challenges and UI settings stay. Media is cleared
     * separately (media.clear), see deleteMyData.
     */
    deleteAll() {
      const candidateKeys = ["profile", "shares", "reviews", "x:witnesses", "x:ats_exports"];
      for (const k of keys(kv, "")) {
        if (candidateKeys.includes(k) || k.startsWith("run:") || k.startsWith("card:") || k.startsWith("x:resume_private:")) kv.removeItem(PREFIX + k);
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
