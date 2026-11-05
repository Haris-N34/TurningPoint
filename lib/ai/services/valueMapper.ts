import { z } from "zod";
import { SKILL_SLUGS, SKILLS, type SkillSlug } from "@/lib/engine/skills";
import { protectedCheck } from "../guards/protected";
import type { PromptDef } from "../prompts/types";
import { run, runSync, type RunOptions } from "../run";

// Value Mapper (PRD v2 B2): maps an employer's own competency names (or job text) onto the shared 12-skill
// framework, with a confidence. The admin confirms, changes or rejects every mapping; nothing is applied
// without them.

export type MapperInput = { terms: string[] };
export const Mapping = z.object({
  term: z.string(),
  skill: z.enum(SKILL_SLUGS).nullable(),
  confidence: z.number().min(0).max(1),
  why: z.string(),
  alternatives: z.array(z.enum(SKILL_SLUGS)).default([]),
});
export const MapperOutput = z.object({ mappings: z.array(Mapping) });
export type Mapping = z.infer<typeof Mapping>;
export type MapperOutput = z.infer<typeof MapperOutput>;

/** Phrases that signal each skill. Strong phrases are near-synonyms; weak ones are hints. Plain on purpose. */
export const SYNONYMS: Record<SkillSlug, { strong: string[]; weak: string[] }> = {
  "problem-solving": { strong: ["problem solving", "problem-solving", "solve problems", "troubleshoot", "root cause", "solution oriented", "solutions"], weak: ["fix", "issue", "resolve"] },
  adaptability: { strong: ["adaptab", "flexib", "agil", "embrace change", "adjust to change", "pivot"], weak: ["change", "adjust", "versatil"] },
  resilience: { strong: ["resilien", "grit", "persever", "bounce back", "fail forward", "failing forward", "tenacity"], weak: ["setback", "pressure", "persist"] },
  ambiguity: { strong: ["ambigu", "uncertain", "judgment", "judgement", "decision making", "decision-making", "make decisions", "make the call"], weak: ["decide", "risk", "unclear"] },
  prioritization: { strong: ["prioriti", "time management", "manage time", "triage", "first things first", "focus on what matters"], weak: ["deadline", "organi", "plan", "efficien"] },
  creativity: { strong: ["creativ", "innovat", "resourceful", "ingenuity", "do more with less", "inventive"], weak: ["ideas", "new ways", "original"] },
  collaboration: { strong: ["collaborat", "teamwork", "team player", "work with others", "cross-functional", "partnership"], weak: ["team", "together", "cooperat", "stakeholder"] },
  empathy: { strong: ["empath", "customer obsess", "care for", "emotional intelligence", "compassion", "put people first"], weak: ["customer", "listen", "inclusive", "people first", "kind"] },
  communication: { strong: ["communicat", "storytell", "explain", "present", "articulat", "translate between", "tech and business"], weak: ["writ", "speak", "influence", "clear"] },
  feedback: { strong: ["feedback", "coachab", "growth mindset", "learn from mistakes", "take criticism", "open to input"], weak: ["learn", "improve", "humble", "humility"] },
  analytical: { strong: ["analytic", "data-driven", "data driven", "critical thinking", "quantitative", "insight", "evidence-based"], weak: ["data", "numbers", "metrics", "logic", "reason"] },
  curiosity: { strong: ["curio", "discover", "explor", "inquisitive", "ask questions", "investigat", "learn new things", "lifelong learn"], weak: ["new", "research", "find out", "wonder"] },
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function mapTerm(term: string): Mapping {
  const t = norm(term);
  const exact = SKILLS.find((s) => norm(s.name) === t || s.slug === t || norm(s.name.replace(/\s*\(.*\)/, "")) === t);
  if (exact) return { term, skill: exact.slug, confidence: 0.95, why: `Same name as "${exact.name}" in the framework.`, alternatives: [] };
  const scored = SKILL_SLUGS.map((slug) => {
    const strong = SYNONYMS[slug].strong.filter((p) => t.includes(p));
    const weak = SYNONYMS[slug].weak.filter((p) => t.includes(p));
    return { slug, score: strong.length * 3 + weak.length, hit: strong[0] ?? weak[0], strong: strong.length > 0 };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || SKILL_SLUGS.indexOf(a.slug) - SKILL_SLUGS.indexOf(b.slug));
  if (!scored.length) return { term, skill: null, confidence: 0, why: "No close match in the framework. Pick one or reject.", alternatives: [] };
  const [top, ...rest] = scored;
  const tie = rest[0]?.score === top.score;
  const confidence = Math.max(0.3, Math.min(0.9, (top.strong ? 0.8 : 0.5) - (tie ? 0.2 : 0) + (top.score >= 6 ? 0.1 : 0)));
  const name = SKILLS.find((s) => s.slug === top.slug)!.name;
  return { term, skill: top.slug, confidence: +confidence.toFixed(2), why: `"${top.hit}" is a signal for ${name}.`, alternatives: rest.slice(0, 2).map((r) => r.slug) };
}

export const valueMapperPrompt: PromptDef<MapperInput, MapperOutput> = {
  id: "value-mapper",
  version: "1.0.0",
  service: "Value Mapper",
  tier: "fast",
  system: [
    "Map each employer competency to the closest skill in this framework, or null if none fits:",
    ...SKILLS.map((s) => `- ${s.slug}: ${s.name}. ${s.definition}`),
    "Give a confidence from 0 to 1 and a one-sentence reason. A human confirms every mapping.",
  ].join("\n"),
  render: (i) => JSON.stringify(i.terms),
  schema: MapperOutput,
  local: (i) => ({ mappings: i.terms.map(mapTerm) }),
  fallback: (i) => ({ mappings: i.terms.map((term) => ({ term, skill: null, confidence: 0, why: "Mapping unavailable. Pick a skill by hand.", alternatives: [] })) }),
  check: (o, i) => (o.mappings.length !== i.terms.length ? "one mapping per term" : protectedCheck(...o.mappings.map((m) => m.why))),
  fixtures: [
    { name: "demo terms", input: { terms: ["Communicate tech and business", "Analytical thinking", "Make new discoveries"] } },
    { name: "unknown", input: { terms: ["Synergy"] } },
  ],
};

/** Split pasted text into terms: one per line or comma. */
export const splitTerms = (text: string) =>
  text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

export const mapValues = (terms: string[], opts: RunOptions = {}) => runSync(valueMapperPrompt, { terms }, opts).output.mappings;
export const mapValuesAsync = async (terms: string[], opts: RunOptions = {}) => (await run(valueMapperPrompt, { terms }, opts)).output.mappings;
