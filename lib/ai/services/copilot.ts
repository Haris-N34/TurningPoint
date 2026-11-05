import { z } from "zod";
import type { Card } from "@/lib/card/types";
import { SKILL_SLUGS, SKILLS, type SkillSlug } from "@/lib/engine/skills";
import { stripPii } from "../guards/pii";
import { protectedCheck, protectedMentions } from "../guards/protected";
import { quoteIn } from "../guards/quotes";
import type { PromptDef } from "../prompts/types";
import { run, runSync, type RunOptions } from "../run";
import { SYNONYMS } from "./valueMapper";

// Recruiter Copilot (PRD v2 B2): answers questions about one candidate's evidence. Every answer cites
// evidence rows, transcripts or KPIs. It refuses questions about protected traits and "should I hire".
// It sees the blind card only: no name, email or school.

export const Citation = z.object({
  kind: z.enum(["evidence", "transcript", "kpi", "choice"]),
  label: z.string(),
  checkpointId: z.string().optional(),
  quote: z.string().optional(),
  t: z.number().min(0).optional(),
  skill: z.enum(SKILL_SLUGS).optional(),
  kpiId: z.string().optional(),
});
export type Citation = z.infer<typeof Citation>;
export const CopilotOutput = z.object({
  answer: z.string().min(1),
  citations: z.array(Citation),
  refused: z.enum(["protected", "decision", "no_evidence"]).nullable(),
});
export type CopilotOutput = z.infer<typeof CopilotOutput>;

/** What the Copilot may read: the evidence, transcripts, choices and KPIs. Never identity. */
export type BlindCard = Pick<Card, "evidence" | "decisionPath" | "kpis" | "targetSkills"> & {
  checkpoints: { id: string; kind: Card["checkpoints"][number]["kind"]; question: string; transcript: string; words: { w: string; start: number }[] }[];
};
export type CopilotInput = { question: string; card: BlindCard };

export function blindCard(card: Card): BlindCard {
  const known = { name: card.candidate.displayName, university: card.candidate.university };
  return {
    targetSkills: card.targetSkills,
    evidence: card.evidence,
    decisionPath: card.decisionPath,
    kpis: card.kpis,
    // Quotes must stay exact substrings of the stored transcripts, so text is only blinded where it held identity.
    checkpoints: card.checkpoints.map((c) => ({ id: c.id, kind: c.kind, question: c.question, transcript: stripPii(c.transcript.text, known), words: c.transcript.words.map(({ w, start }) => ({ w, start })) })),
  };
}

export const DECISION_Q = /\b(?:should (?:i|we) (?:hire|reject|pass|shortlist|advance|interview|move forward)|hire (?:him|her|them|this)|(?:is|are) (?:he|she|they|this candidate) (?:a )?(?:good|bad|right|strong|weak|great|poor) (?:fit|hire|candidate|choice)|worth hiring|recommend (?:hiring|rejecting)|yes or no|thumbs up|overall score|rate (?:him|her|them|this candidate)|rank (?:him|her|them)|better than|best candidate|auto-?reject)\b/i;

export const REFUSAL = {
  protected: "I can't answer questions about personal characteristics. They are not part of the evidence and must not affect a hiring decision. Ask about a skill or a decision instead.",
  decision: "I don't make or recommend hiring decisions, and there is no overall score. I can show you the evidence for any skill so you can decide.",
  no_evidence: "I can only answer from this card's evidence, and I found nothing on that. Try asking about one of the target skills.",
} as const;

const name = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;
const LEVEL = { strong: "Strong", some: "Some", not_observed: "Not observed", needs_review: "Needs human review" } as const;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const cpLabel = (card: BlindCard, id: string) => {
  const decisions = card.checkpoints.filter((c) => c.kind === "decision");
  const i = decisions.findIndex((c) => c.id === id);
  const c = card.checkpoints.find((x) => x.id === id);
  return i >= 0 ? `Checkpoint ${i + 1}` : c?.kind === "real_life" ? "Real-life story" : c?.kind === "follow_up" ? "Follow-up" : "Answer";
};

function skillsIn(q: string): SkillSlug[] {
  const t = q.toLowerCase();
  return SKILL_SLUGS.filter((s) => {
    const n = name(s).toLowerCase().replace(/\s*\(.*\)/, "");
    return t.includes(n) || t.includes(s) || SYNONYMS[s].strong.some((p) => t.includes(p));
  });
}

const STOP = new Set("what when where which while with would about after again they them their this that there have show showed shown said does did doing they're candidate answer answers".split(" "));
const keywords = (q: string) => (q.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w));

/** Second a substring starts at, from word timings. */
function timeOf(c: BlindCard["checkpoints"][number], quote: string) {
  const i = c.transcript.indexOf(quote);
  if (i < 0) return 0;
  const before = c.transcript.slice(0, i).split(/\s+/).filter(Boolean).length;
  return c.words[before]?.start ?? 0;
}

export function localCopilot({ question, card }: CopilotInput): CopilotOutput {
  if (protectedMentions(question).length) return { answer: REFUSAL.protected, citations: [], refused: "protected" };
  if (DECISION_Q.test(question)) return { answer: REFUSAL.decision, citations: [], refused: "decision" };
  const lines: string[] = [];
  const citations: Citation[] = [];
  const skills = skillsIn(question);
  for (const s of skills) {
    const e = card.evidence.find((x) => x.skill === s);
    const kpis = (card.kpis ?? []).filter((k) => k.skills.includes(s));
    if (e?.source?.type === "clip") {
      const src = e.source;
      const where = cpLabel(card, src.checkpointId);
      lines.push(`${name(s)}: ${LEVEL[e.level]}. ${where}, at ${mmss(src.startS)}: “${src.quote}”`);
      citations.push({ kind: "evidence", label: `${where} · ${mmss(src.startS)}`, checkpointId: src.checkpointId, quote: src.quote, t: src.startS, skill: s });
    } else if (e?.source?.type === "choice") {
      lines.push(`${name(s)}: ${LEVEL[e.level]}. Shown by the choice “${e.source.optionLabel}”.`);
      citations.push({ kind: "choice", label: `Choice: ${e.source.optionLabel}`, skill: s });
    } else if (e) {
      lines.push(`${name(s)}: ${LEVEL[e.level]} in the answers.`);
    }
    for (const k of kpis.slice(0, 2)) {
      lines.push(`In the game, ${k.label}: ${k.display}. ${k.explanation}`);
      citations.push({ kind: "kpi", label: `KPI: ${k.label}`, kpiId: k.id, skill: s });
    }
  }
  if (!skills.length) {
    const kw = keywords(question);
    const hits: { c: BlindCard["checkpoints"][number]; sentence: string; score: number }[] = [];
    for (const c of card.checkpoints) {
      for (const sentence of c.transcript.split(/(?<=[.!?])\s+/)) {
        const lower = sentence.toLowerCase();
        const score = kw.filter((w) => lower.includes(w)).length;
        if (score && sentence.trim() && quoteIn(c.transcript, sentence)) hits.push({ c, sentence, score });
      }
    }
    for (const h of hits.sort((a, b) => b.score - a.score).slice(0, 2)) {
      const t = timeOf(h.c, h.sentence);
      lines.push(`${cpLabel(card, h.c.id)}, at ${mmss(t)}: “${h.sentence}”`);
      citations.push({ kind: "transcript", label: `${cpLabel(card, h.c.id)} · ${mmss(t)}`, checkpointId: h.c.id, quote: h.sentence, t });
    }
    for (const k of (card.kpis ?? []).filter((k) => kw.some((w) => k.label.toLowerCase().includes(w))).slice(0, 2)) {
      lines.push(`${k.label}: ${k.display}. ${k.explanation}`);
      citations.push({ kind: "kpi", label: `KPI: ${k.label}`, kpiId: k.id });
    }
  }
  if (!citations.length) return { answer: REFUSAL.no_evidence, citations: [], refused: "no_evidence" };
  return { answer: lines.join("\n"), citations, refused: null };
}

export const copilotPrompt: PromptDef<CopilotInput, CopilotOutput> = {
  id: "recruiter-copilot",
  version: "1.0.0",
  service: "Recruiter Copilot",
  tier: "large",
  system: [
    "You answer a recruiter's question about one candidate using only the evidence given (evidence rows, transcripts, KPIs, choices).",
    "Every answer must cite at least one source. Quotes must be copied exactly from a transcript.",
    "Refuse (refused: protected) any question about age, gender, race, ethnicity, disability, accent, religion, pregnancy or nationality.",
    "Refuse (refused: decision) any request to decide, rank, score or recommend hiring. A human decides.",
    "If the evidence has nothing on the question, refused: no_evidence.",
  ].join("\n"),
  render: (i) => JSON.stringify(i),
  schema: CopilotOutput,
  local: localCopilot,
  fallback: () => ({ answer: REFUSAL.no_evidence, citations: [], refused: "no_evidence" }),
  check: (o, i) => {
    if (!o.refused && !o.citations.length) return "answer without a citation";
    for (const c of o.citations) {
      if (c.quote !== undefined) {
        const cp = i.card.checkpoints.find((x) => x.id === c.checkpointId);
        if (!cp || !quoteIn(cp.transcript, c.quote)) return "citation quote not in transcript";
      }
      if (c.kind === "kpi" && !(i.card.kpis ?? []).some((k) => k.id === c.kpiId)) return "citation to a KPI that does not exist";
    }
    return protectedCheck(o.answer);
  },
  fixtures: [],
};

/** Questions that never reach a model: refusals are decided in code first. */
function preRefuse(question: string): CopilotOutput | undefined {
  if (protectedMentions(question).length) return { answer: REFUSAL.protected, citations: [], refused: "protected" };
  if (DECISION_Q.test(question)) return { answer: REFUSAL.decision, citations: [], refused: "decision" };
  return undefined;
}

export function askCopilot(question: string, card: Card, opts: RunOptions = {}): CopilotOutput {
  return preRefuse(question) ?? runSync(copilotPrompt, { question, card: blindCard(card) }, opts).output;
}
export async function askCopilotAsync(question: string, card: Card, opts: RunOptions = {}): Promise<CopilotOutput> {
  return preRefuse(question) ?? (await run(copilotPrompt, { question, card: blindCard(card) }, opts)).output;
}
