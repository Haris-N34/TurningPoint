import { parseScenario, type Scenario } from "@/lib/engine/schema";

// Local stand-in for AI scenario tailoring (E1.3). Rewrites names, setting and details for an industry
// with plain word swaps. The result must pass schema validation or the original is kept.

export const INDUSTRIES = ["Non-profit", "Energy", "Banking", "Tech", "Healthcare", "Retail"] as const;
export type Industry = (typeof INDUSTRIES)[number];

type Lexicon = [RegExp, string | ((m: string) => string)][];

const LEX: Record<Industry, Lexicon> = {
  "Non-profit": [],
  Energy: [
    [/pop-up food market/gi, "community energy fair"],
    [/food market/gi, "energy fair"],
    [/market day/gi, "fair day"],
    [/\bmarket\b/gi, "fair"],
    [/local non-profit/gi, "regional utility"],
    [/non-profit lead/gi, "utility partner lead"],
    [/non-profit/gi, "utility"],
    [/food vendors/gi, "solar installers"],
    [/big-name trucks/gi, "national contractors"],
    [/vendors?/gi, (m: string) => (m.toLowerCase().endsWith("s") ? "suppliers" : "supplier")],
    [/community hall/gi, "field office"],
    [/social media/gi, "site safety briefings"],
    [/queue/gi, "booking line"],
  ],
  Banking: [
    [/pop-up food market/gi, "student financial literacy week"],
    [/food market/gi, "literacy week"],
    [/market day/gi, "launch day"],
    [/\bmarket\b/gi, "event"],
    [/local non-profit/gi, "credit union"],
    [/non-profit lead/gi, "branch manager"],
    [/non-profit/gi, "credit union"],
    [/food vendors/gi, "workshop hosts"],
    [/big-name trucks/gi, "big-name speakers"],
    [/vendors?/gi, (m: string) => (m.toLowerCase().endsWith("s") ? "speakers" : "speaker")],
    [/community hall/gi, "branch lobby"],
    [/queue/gi, "sign-in desk"],
  ],
  Tech: [
    [/pop-up food market/gi, "weekend hackathon"],
    [/food market/gi, "hackathon"],
    [/market day/gi, "demo day"],
    [/\bmarket\b/gi, "hackathon"],
    [/local non-profit/gi, "local startup hub"],
    [/non-profit lead/gi, "hub director"],
    [/non-profit/gi, "startup hub"],
    [/food vendors/gi, "mentor teams"],
    [/big-name trucks/gi, "big-name sponsors"],
    [/vendors?/gi, (m: string) => (m.toLowerCase().endsWith("s") ? "mentors" : "mentor")],
    [/community hall/gi, "co-working space"],
    [/queue/gi, "check-in line"],
  ],
  Healthcare: [
    [/pop-up food market/gi, "community health clinic day"],
    [/food market/gi, "clinic day"],
    [/market day/gi, "clinic day"],
    [/\bmarket\b/gi, "clinic"],
    [/local non-profit/gi, "community health centre"],
    [/non-profit lead/gi, "clinic coordinator"],
    [/non-profit/gi, "health centre"],
    [/food vendors/gi, "volunteer nurses"],
    [/big-name trucks/gi, "a mobile clinic van"],
    [/vendors?/gi, (m: string) => (m.toLowerCase().endsWith("s") ? "providers" : "provider")],
    [/community hall/gi, "church basement"],
    [/queue/gi, "wait list"],
  ],
  Retail: [
    [/pop-up food market/gi, "holiday pop-up shop"],
    [/food market/gi, "pop-up shop"],
    [/market day/gi, "opening day"],
    [/\bmarket\b/gi, "shop"],
    [/local non-profit/gi, "local makers' collective"],
    [/non-profit lead/gi, "collective lead"],
    [/non-profit/gi, "makers' collective"],
    [/food vendors/gi, "local makers"],
    [/big-name trucks/gi, "big-name brands"],
    [/vendors?/gi, (m: string) => (m.toLowerCase().endsWith("s") ? "makers" : "maker")],
    [/community hall/gi, "mall unit"],
    [/queue/gi, "checkout line"],
  ],
};

function swap(text: string, lex: Lexicon, company?: string): string {
  let out = text;
  for (const [re, to] of lex) out = typeof to === "string" ? out.replace(re, to) : out.replace(re, to);
  if (company) out = out.replace(/\{company\}/g, company);
  // Keep sentence starts capitalised after a swap.
  return out.replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c: string) => p + c.toUpperCase());
}

export type TailorResult = { scenario: Scenario; changed: boolean; error?: string };

export function tailorScenario(base: Scenario, industry: Industry, company?: string): TailorResult {
  const lex = LEX[industry];
  if (!lex.length) return { scenario: base, changed: false };
  try {
    const t = (s: string) => swap(s, lex, company);
    const draft = structuredClone(base) as Scenario;
    draft.title = t(draft.title);
    if (draft.summary) draft.summary = t(draft.summary);
    draft.industryFlavour = industry.toLowerCase();
    for (const d of draft.disruptions) {
      d.title = t(d.title);
      d.text = t(d.text);
    }
    for (const n of draft.nodes) {
      n.text = t(n.text);
      if (n.art) n.art.alt = t(n.art.alt);
      if (n.type === "choice") {
        for (const o of n.options) o.label = t(o.label);
        if (n.fallbackQuestion) n.fallbackQuestion = t(n.fallbackQuestion);
      }
    }
    return { scenario: parseScenario(draft), changed: true };
  } catch (e) {
    return { scenario: base, changed: false, error: e instanceof Error ? e.message : String(e) };
  }
}
