import { z } from "zod";
import type { PromptDef } from "../prompts/types";
import { runSync, type RunOptions } from "../run";

// Fairness Monitor (PRD v2 B2, B3): shortlist rate by answer mode and by opt-in group, with the four-fifths
// warning. Aggregates only; any group smaller than 10 is suppressed. No model is involved: it is arithmetic.

export const MIN_GROUP = 10;
export const FOUR_FIFTHS = 0.8;

export type FairnessRow = { mode: "video" | "voice" | "text"; group?: string; shortlisted: boolean };
export type FairnessInput = { rows: FairnessRow[] };
const Group = z.object({ name: z.string(), n: z.number().int(), rate: z.number().nullable(), ratio: z.number().nullable(), suppressed: z.boolean(), warning: z.boolean() });
export const FairnessOutput = z.object({ byMode: z.array(Group), byGroup: z.array(Group), warnings: z.array(z.string()) });
export type FairnessOutput = z.infer<typeof FairnessOutput>;

function groups(rows: FairnessRow[], key: (r: FairnessRow) => string | undefined) {
  const m = new Map<string, FairnessRow[]>();
  for (const r of rows) {
    const k = key(r);
    if (k) m.set(k, [...(m.get(k) ?? []), r]);
  }
  const raw = [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, rs]) => {
    const suppressed = rs.length < MIN_GROUP;
    return { name, n: rs.length, rate: suppressed ? null : rs.filter((r) => r.shortlisted).length / rs.length, suppressed };
  });
  const top = Math.max(0, ...raw.map((g) => g.rate ?? 0));
  return raw.map((g) => {
    const ratio = g.rate === null || top === 0 ? null : +(g.rate / top).toFixed(3);
    return { ...g, rate: g.rate === null ? null : +g.rate.toFixed(3), ratio, warning: ratio !== null && ratio < FOUR_FIFTHS };
  });
}

export function localFairness({ rows }: FairnessInput): FairnessOutput {
  const byMode = groups(rows, (r) => r.mode);
  const byGroup = groups(rows, (r) => r.group);
  const warnings = [...byMode, ...byGroup]
    .filter((g) => g.warning)
    .map((g) => `${g.name}: shortlist rate is ${Math.round((g.ratio ?? 0) * 100)}% of the highest group (below four-fifths). Review for adverse impact.`);
  return { byMode, byGroup, warnings };
}

export const fairnessPrompt: PromptDef<FairnessInput, FairnessOutput> = {
  id: "fairness-monitor",
  version: "1.0.0",
  service: "Fairness Monitor",
  tier: "fast",
  localOnly: true,
  system: "Arithmetic only; never sent to a model.",
  render: () => "",
  schema: FairnessOutput,
  local: localFairness,
  fallback: () => ({ byMode: [], byGroup: [], warnings: [] }),
  check: (o) => ([...o.byMode, ...o.byGroup].some((g) => g.n < MIN_GROUP && g.rate !== null) ? "small group not suppressed" : undefined),
  fixtures: [
    {
      name: "text mode lower",
      input: {
        rows: [
          ...Array.from({ length: 20 }, (_, i) => ({ mode: "voice" as const, shortlisted: i < 10 })),
          ...Array.from({ length: 20 }, (_, i) => ({ mode: "text" as const, shortlisted: i < 6 })),
          ...Array.from({ length: 5 }, () => ({ mode: "video" as const, shortlisted: true })),
        ],
      },
    },
  ],
};

export const fairnessReport = (rows: FairnessRow[], opts: RunOptions = {}) => runSync(fairnessPrompt, { rows }, opts).output;
