import type { Scenario } from "./schema";

/** 32-bit FNV-1a hash of a string, used to turn an attempt id into a numeric seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, deterministic PRNG. Same seed, same sequence, every platform. */
export function rng(seed: string | number): () => number {
  let a = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RunPlan = {
  seed: string;
  disruptionId: string;
  /** Choice node ids whose checkpoint fires right after the candidate decides (2 or 3, C4.1). */
  checkpointNodeIds: string[];
  /** Resolved variation values, e.g. { "budget.start": 5200, teamSize: 8 }. */
  vars: Record<string, number>;
};

function roundNice(n: number, lo: number, hi: number): number {
  const span = Math.abs(hi - lo);
  const step = span >= 1000 ? 100 : span >= 100 ? 10 : 1;
  return Math.round(n / step) * step;
}

/**
 * Everything that varies per candidate, derived only from the seed (PRD, Per-candidate variation):
 * which disruption fires, which 2 or 3 eligible checkpoints activate, and number changes.
 * Store the seed and the run can be replayed exactly.
 */
export function planRun(s: Scenario, seed: string): RunPlan {
  const r = rng(seed);
  const pool = s.disruptionPool;
  const disruptionId = pool[Math.floor(r() * pool.length)];

  const eligible = s.nodes.filter((n) => n.type === "choice" && n.checkpointEligible).map((n) => n.id);
  const count = Math.min(eligible.length, r() < 0.5 ? 2 : 3);
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = new Set(shuffled.slice(0, count));
  const checkpointNodeIds = eligible.filter((id) => picked.has(id));

  const vars: Record<string, number> = {};
  for (const key of Object.keys(s.variation).sort()) {
    const [lo, hi] = s.variation[key];
    vars[key] = roundNice(lo + r() * (hi - lo), lo, hi);
  }
  return { seed, disruptionId, checkpointNodeIds, vars };
}
