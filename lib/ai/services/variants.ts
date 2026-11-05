import { z } from "zod";
import { hashSeed } from "@/lib/engine/seed";
import type { MapScenario } from "@/lib/game/schema";
import type { Store } from "@/lib/store/store";
import { protectedCheck } from "../guards/protected";
import type { PromptDef } from "../prompts/types";
import { runSync, type RunOptions } from "../run";

// Dialogue Variants (PRD v2 B2): three wordings of every NPC line, made once at publish and cached with the
// challenge. During play a line is picked by the run's seed. Nothing is generated live, and the meaning
// (every number, every name) stays fixed.

export const VARIANT_COUNT = 3;
export type VariantLine = { key: string; who: string; text: string };
export type VariantsInput = { lines: VariantLine[] };
export const VariantsOutput = z.object({
  variants: z.array(z.object({ key: z.string(), texts: z.array(z.string().min(1)).length(VARIANT_COUNT) })),
});
export type VariantsOutput = z.infer<typeof VariantsOutput>;
export type VariantTable = Record<string, string[]>;

const PAIRS: [string, string][] = [
  ["I'm", "I am"], ["we're", "we are"], ["you're", "you are"], ["they're", "they are"], ["it's", "it is"],
  ["don't", "do not"], ["can't", "cannot"], ["won't", "will not"], ["isn't", "is not"], ["aren't", "are not"],
  ["didn't", "did not"], ["doesn't", "does not"], ["we've", "we have"], ["I've", "I have"], ["that's", "that is"],
  ["there's", "there is"], ["we'll", "we will"], ["I'll", "I will"], ["you'll", "you will"], ["wasn't", "was not"],
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const caseLike = (src: string, to: string) => (src[0] === src[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);

/** Expand contractions, or contract expansions if there are none. Meaning unchanged. */
function toggleContractions(text: string): string {
  let out = text;
  for (const [short, long] of PAIRS) out = out.replace(new RegExp(`\\b${esc(short)}\\b`, "gi"), (m) => caseLike(m, long));
  if (out !== text) return out;
  for (const [short, long] of PAIRS) out = out.replace(new RegExp(`\\b${esc(long)}\\b`, "gi"), (m) => caseLike(m, short));
  return out;
}

const OPENERS = ["Okay.", "Right.", "Listen.", "Quick one."];
const ALT_OPENERS = ["Look.", "Heads up.", "Hey.", "Alright."];

export function localVariants(line: VariantLine): string[] {
  const h = hashSeed(line.who);
  const toggled = toggleContractions(line.text);
  const v1 = toggled !== line.text ? toggled : `${ALT_OPENERS[h % ALT_OPENERS.length]} ${line.text}`;
  const v2 = `${OPENERS[(h >>> 3) % OPENERS.length]} ${line.text}`;
  return [line.text, v1, v2];
}

/** Numbers and money in a line: every variant must keep exactly these. */
const facts = (s: string) => (s.match(/\$?\d[\d,.]*%?/g) ?? []).map((x) => x.replace(/[.,]$/, "")).sort().join("|");

export const variantsPrompt: PromptDef<VariantsInput, VariantsOutput> = {
  id: "dialogue-variants",
  version: "1.0.1",
  service: "Dialogue Variants",
  tier: "fast",
  system: [
    `For each NPC line write ${VARIANT_COUNT} wordings. The first is the original line unchanged.`,
    "Keep the meaning, tone, every number, amount, name and deadline exactly. Similar length. Plain spoken English.",
  ].join("\n"),
  render: (i) => JSON.stringify(i.lines),
  schema: VariantsOutput,
  local: (i) => ({ variants: i.lines.map((l) => ({ key: l.key, texts: localVariants(l) })) }),
  fallback: (i) => ({ variants: i.lines.map((l) => ({ key: l.key, texts: Array(VARIANT_COUNT).fill(l.text) })) }),
  check: (o, i) => {
    for (const l of i.lines) {
      const v = o.variants.find((x) => x.key === l.key);
      if (!v) return `missing variants for ${l.key}`;
      if (v.texts.some((t) => facts(t) !== facts(l.text))) return `a variant of ${l.key} changed a number`;
      if (v.texts.some((t) => t.length > l.text.length * 2 + 20)) return `a variant of ${l.key} is much longer`;
    }
    return protectedCheck(...o.variants.flatMap((v) => v.texts));
  },
  fixtures: [
    {
      name: "two lines",
      input: {
        lines: [
          { key: "n1:0", who: "maya", text: "We're $400 short and the hall wants it by Friday." },
          { key: "n1:1", who: "theo", text: "Can you talk to the vendors before noon?" },
        ],
      },
    },
  ],
};

/** Every NPC line in a map scenario, keyed node:index. */
export const npcLines = (s: MapScenario): VariantLine[] =>
  s.nodes.flatMap((n) => n.lines.map((l, i) => ({ key: `${n.id}:${i}`, who: l.who, text: l.text })));

export function makeVariants(s: MapScenario, opts: RunOptions = {}): VariantTable {
  const { output } = runSync(variantsPrompt, { lines: npcLines(s) }, opts);
  return Object.fromEntries(output.variants.map((v) => [v.key, v.texts]));
}

/** The scenario as one candidate sees it: each line's wording picked by seed. Pure lookup, no generation. */
export function applyVariants(s: MapScenario, table: VariantTable | undefined, seed: string): MapScenario {
  if (!table) return s;
  return {
    ...s,
    nodes: s.nodes.map((n) => ({
      ...n,
      lines: n.lines.map((l, i) => {
        const key = `${n.id}:${i}`;
        const texts = table[key];
        return texts?.length ? { ...l, text: texts[hashSeed(`${seed}:${key}`) % texts.length] } : l;
      }),
    })),
  };
}

const VariantTableSchema = z.record(z.string(), z.array(z.string()));
export const saveVariants = (st: Store, challengeId: string, t: VariantTable) => st.setJSON(`variants:${challengeId}`, t);
export const loadVariants = (st: Store, challengeId: string) => st.getJSON(`variants:${challengeId}`, VariantTableSchema);
