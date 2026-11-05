import { INDUSTRIES, tailorScenario, type Industry } from "@/lib/challenge/tailor";
import { ScenarioSchema, type Scenario } from "@/lib/engine/schema";
import { protectedCheck } from "../guards/protected";
import { stableStringify, type PromptDef } from "../prompts/types";
import { runSync, type RunOptions } from "../run";

// Scenario Tailor (PRD v2 B2): rewrites names, setting and wording for the employer's industry at publish
// time. Structure is locked: ids, branches, effects, costs and checkpoint flags must come back unchanged.

export type TailorInput = { scenario: Scenario; industry: Industry; company?: string };

/** Keys whose string values are wording. Everything else is structure and must not change. */
const WORDING = new Set(["title", "summary", "text", "alt", "label", "fallbackQuestion", "industryFlavour"]);

function skeleton(v: unknown, key = ""): unknown {
  if (typeof v === "string") return WORDING.has(key) ? "" : v;
  if (Array.isArray(v)) return v.map((x) => skeleton(x));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, skeleton(x, k)]));
  return v;
}

/** True when two scenarios differ only in wording. */
export const sameStructure = (a: Scenario, b: Scenario) => stableStringify(skeleton(a)) === stableStringify(skeleton(b));

export const tailorPrompt: PromptDef<TailorInput, Scenario> = {
  id: "scenario-tailor",
  version: "1.0.0",
  service: "Scenario Tailor",
  tier: "large",
  system: [
    "Rewrite this workplace scenario's wording for the given industry and company.",
    "Change only text fields (title, summary, text, alt, label, fallbackQuestion, industryFlavour).",
    "Keep every id, branch, effect, number and flag exactly as given. Keep the meaning and difficulty of every choice.",
  ].join("\n"),
  render: (i) => JSON.stringify({ industry: i.industry, company: i.company ?? null, scenario: i.scenario }),
  schema: ScenarioSchema as unknown as PromptDef<TailorInput, Scenario>["schema"],
  local: (i) => tailorScenario(i.scenario, i.industry, i.company).scenario,
  fallback: (i) => i.scenario,
  check: (o, i) => {
    if (!sameStructure(i.scenario, o)) return "structure changed (ids, branches, effects or flags)";
    return protectedCheck(...o.nodes.map((n) => n.text));
  },
  fixtures: [],
};

export { INDUSTRIES };

/** Tailor at publish/build time. An invalid rewrite is never used: the original comes back with a note. */
export function tailor(scenario: Scenario, industry: Industry, company?: string, opts: RunOptions = {}) {
  const r = runSync(tailorPrompt, { scenario, industry, company }, opts);
  const changed = r.valid && stableStringify(r.output) !== stableStringify(scenario);
  return { scenario: r.output, changed, error: r.valid ? undefined : r.error };
}
