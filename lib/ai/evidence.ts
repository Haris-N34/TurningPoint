import type { CardCheckpoint, Evidence } from "@/lib/card/types";
import { verifyEvidence } from "@/lib/card/verify";
import { locateQuote } from "@/lib/checkpoint/transcript";
import type { SkillSlug } from "@/lib/engine/skills";

// Local, rule-based evidence extraction (demo scope: no API keys). It organises evidence for a human;
// it never decides. Inputs are transcripts, the choice log and skill signals only: no name, email,
// school, audio features or video (G2, F1). Grammar, accent and fluency are never considered.

export const EXTRACTOR = { name: "local-rules", version: "0.7.0" };
export const MAX_QUOTE_WORDS = 25;

export type ExtractInput = {
  targetSkills: SkillSlug[];
  /** `question` is the checkpoint question; with the decision it gives the answer's own context (specificity). */
  checkpoints: (Pick<CardCheckpoint, "id" | "nodeId" | "kind" | "transcript"> & { question?: string })[];
  decisionPath: { nodeId: string; optionId: string; optionLabel: string; prompt?: string }[];
  /** Skills each choice node is designed to surface (scenario skillSignals). */
  nodeSkills: Record<string, SkillSlug[]>;
};

// Words that suggest a sentence is about a skill. Kept plain on purpose so the rules can be read and defended.
const SKILL_WORDS: Record<SkillSlug, RegExp> = {
  "problem-solving": /\b(problem|fix|fixed|solve|solution|figured|worked out|broke it down|root cause|plan b|workaround)\b/i,
  adaptability: /\b(chang\w*|switch\w*|adjust\w*|adapt\w*|new plan|pivot\w*|instead|rather than|re-?plan\w*|shift\w*)\b/i,
  resilience: /\b(kept going|still|recover\w*|bounced back|finished|despite|didn'?t give up|tried again|setback|learned)\b/i,
  ambiguity: /\b(didn'?t know|unclear|uncertain|not sure|guess\w*|risk\w*|bet|without knowing|best call|judg(e)?ment call)\b/i,
  prioritization: /\b(instead of|rather than|first|priorit\w*|protect\w*|cut|matter\w*|most important|trade-?off|focus\w*|dropped)\b/i,
  creativity: /\b(donat\w*|borrow\w*|cheaper|free|idea|found a way|reused|creative|swap\w*|partner\w*|asked .* for)\b/i,
  // A person or team action, not just the word "team" (judge feedback): asked, paired, called in, worked with...
  collaboration: /\b(asked (?:\w+ ){0,3}(?:who|them|the team|people|everyone|for help)|asked \w+ to|paired|called (?:everyone|the team|them|people) in|called in|worked with|work(?:ed)? together|together with|told (?:the team|everyone|them|the volunteers)|delegat\w*|handed (?:it|\w+) (?:to|over)|split (?:the|it|up)|shared (?:the|it|out)|teamed up|brought (?:in|\w+ in|people together|everyone together)|vot(?:e|ed|ing)|consulted|checked with|sat down with|the team agreed|we agreed|set up (?:a |an )?(?:\w+ ){0,3}(?:standup|stand-up|meeting|call|rota|check-in|huddle)|ran (?:a |an )?(?:\w+ ){0,2}(?:standup|stand-up|meeting|huddle)|got (?:them|everyone|both|the team) (?:talking|together|on board))\b/i,
  empathy: /\b(felt|feel\w*|worr\w*|affect\w*|for them|their side|listen\w*|hear\w*|stress\w*|upset|car(e|ed|es|ing))\b/i,
  communication: /\b(told|tell\w*|explain\w*|wr(o|i)te\w*|messag\w*|email\w*|talk\w*|said|say\w*|announc\w*|updat\w*|let .* know)\b/i,
  feedback: /\b(feedback|critici\w*|crit|pointed out|said .* (mess|wrong)|learned|next time|changed .* because|took it on board)\b/i,
  analytical: /\b(data|numbers?|chart|trend|evidence|analys\w*|compar\w*|measur\w*|pattern|percent|figures?)\b/i,
  curiosity: /\b(asked around|found out|dug|look\w* into|curious|explor\w*|discover\w*|investigat\w*|wondered|why\b)\b/i,
};

// Rubric features (PRD, Evidence rubric). Dialect-neutral spellings included so wording style is not penalised (G4).
const REASON = /\b(because|cause|cuz|cos|since|so that|so|that'?s why|the reason|in order to)\b/i;
const TRADE_OFF = /\b(instead of|rather than|trade-?off|cost (us|me)|gave up|give up|lose|losing|but|over)\b/i;
const AWARE = /\b(team|volunteers?|people|they|them|everyone|vendors?|affect\w*|would change|next time|i'?d (do|change))\b/i;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

// Specificity (Strong needs it). Generic trade-off talk ("the team needed it first, but it cost us time") fits
// any decision, so it caps at Some. Specific means the answer names something from its own decision (a noun
// or name from the question, the option picked or the issue), or a concrete detail: a number, an amount, a day.
const GENERIC = new Set(
  (("this that with from they them their there then than what when where which while would could should about after before " +
    "again also because cause into just like more most much only other over some such very will your yours have having been being " +
    "were does doing done make made take took give gave keep kept said says tell told think thought know knew feel felt want wanted " +
    "need needed needs first last next time times team teams people person everyone everybody someone something thing things stuff " +
    "work worked plan plans planned decision decide decided choose chose chosen choice pick picked option options call calls way ways " +
    "lose lost cost costs trade trade-off tradeoff instead rather better best worse right wrong good important priority prioritise " +
    "prioritize prioritised prioritized matter matters mattered really still even well many lots much less whole part parts point " +
    "affect affects affected impact impacts involved involve outcome result results reason reasons sure maybe guess why walk through " +
    "real life faced broke happened happen changed change changes something like").split(" ")),
);
const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
const contentWords = (text: string) => (text.match(/[A-Za-z][A-Za-z'-]{3,}/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !GENERIC.has(w));
const NUMBER_WORDS = /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|half|quarter|dozen)\b/i;
const DAYS = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

/**
 * True if the text names something concrete: a number, an amount, a day or month. Capital letters are never
 * used, so writing in lower case or with typos changes nothing (F1).
 */
export function hasConcreteDetail(text: string): boolean {
  return /\d/.test(text) || NUMBER_WORDS.test(text) || DAYS.test(text);
}

// Abstract words that sound like an answer but name nothing that happened. They never count as detail.
const ABSTRACT = new Set(
  (("situation situations project projects challenge challenges approach process problem problems solution solutions issue issues " +
    "task tasks goal goals stakeholder stakeholders informed inform ensure ensured ensuring handle handled handling manage managed " +
    "managing similar suddenly quickly effectively efficient efficiently clear clearly open openly honest honestly transparent " +
    "communication communicate communicated collaboration collaborate collaborated adapt adapted adapting adaptable flexible " +
    "resilience resilient priorities prioritising prioritizing balance balanced considered consider considering understand " +
    "understood understanding perspective perspectives needs concerns concern everyone's overall ultimately successful success " +
    "difficult hard tough easy key crucial essential necessary situation's aligned align alignment").split(" ")),
);
export const detailWords = (text: string) => new Set(contentWords(text).filter((w) => !ABSTRACT.has(w)).map(stem));
export const RICH_DETAIL_WORDS = 8;

/**
 * True if the answer is specific: it names something from its own decision (question, option, issue), or it
 * holds a concrete detail (number, amount, day), or it describes what happened in rich concrete words.
 */
export function isSpecific(text: string, context: string[]): boolean {
  const ctx = new Set(context.flatMap(contentWords).map(stem));
  if (ctx.size && contentWords(text).some((w) => ctx.has(stem(w)))) return true;
  return hasConcreteDetail(text) || detailWords(text).size >= RICH_DETAIL_WORDS;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => words(s).length >= 4);
}

/** A verbatim window of at most 25 words, centred on the most informative part of the sentence. */
function trimQuote(sentence: string): string {
  const w = words(sentence);
  if (w.length <= MAX_QUOTE_WORDS) return w.join(" ");
  const m = sentence.match(TRADE_OFF) ?? sentence.match(REASON);
  const at = m?.index !== undefined ? words(sentence.slice(0, m.index)).length : 0;
  const start = Math.max(0, Math.min(at - 8, w.length - MAX_QUOTE_WORDS));
  return w.slice(start, start + MAX_QUOTE_WORDS).join(" ");
}

type Candidate = { checkpointId: string; quote: string; level: "strong" | "some"; score: number };

/**
 * Judge one answer for one skill. The rubric applies to the whole answer (a reason in one sentence and
 * the trade-off in the next still counts); the quote is the single sentence that best shows it.
 */
function judge(skill: SkillSlug, text: string, signalled: boolean, context: string[]): { level: Candidate["level"]; quotes: string[] } | undefined {
  const ss = sentences(text);
  const relevant = ss.filter((x) => SKILL_WORDS[skill].test(x));
  // Collaboration is never inferred from the decision's design alone: the answer must show people being brought in.
  if (!relevant.length && (!signalled || skill === "collaboration")) return undefined;
  const reason = REASON.test(text);
  const trade = TRADE_OFF.test(text);
  const aware = AWARE.test(text);
  let level: Candidate["level"] | undefined;
  if (relevant.length && reason && trade && aware && isSpecific(text, context)) level = "strong";
  else if (reason) level = "some";
  if (!level) return undefined;
  const pool = relevant.length ? relevant : ss;
  const rank = (x: string) => (TRADE_OFF.test(x) ? 2 : 0) + (REASON.test(x) ? 1 : 0) + (SKILL_WORDS[skill].test(x) ? 1 : 0);
  // Best first; the rest are fallbacks if a better-fitting skill already uses the best quote.
  const quotes = [...new Set([...pool].sort((a, b) => rank(b) - rank(a)).map(trimQuote))];
  return quotes.length ? { level, quotes } : undefined;
}

// AI summary lines (judge feedback): specific to each skill and to its own quote, so no two skills on a card
// read the same. A plain lead per skill and level, then up to three concrete words from the quote itself.
const LEAD: Record<SkillSlug, Record<Candidate["level"], string>> = {
  "problem-solving": { strong: "Breaks the problem down and names what the fix costs.", some: "Proposes a fix and says why." },
  adaptability: { strong: "Changes the plan and names what the change costs.", some: "Adjusts the plan and says why." },
  resilience: { strong: "Recovers from the setback and says what changed after.", some: "Keeps going after the setback and says why." },
  ambiguity: { strong: "Makes the call without full information and weighs the risk.", some: "Makes a call under uncertainty and says why." },
  prioritization: { strong: "Protects what matters most and names what gets cut.", some: "Puts one thing first and says why." },
  creativity: { strong: "Finds another way and names what it gives up.", some: "Finds another way and says why." },
  collaboration: { strong: "Brings people in and weighs the time it costs.", some: "Involves others in the decision and says why." },
  empathy: { strong: "Lets how people feel shape the trade-off.", some: "Notices who is affected and responds." },
  communication: { strong: "Tells the right people early and weighs what to say.", some: "Explains the decision to others." },
  feedback: { strong: "Acts on criticism and names what it cost.", some: "Responds to feedback and says why." },
  analytical: { strong: "Reads the evidence and weighs the options.", some: "Uses evidence to reach the decision." },
  curiosity: { strong: "Digs for what others missed before deciding.", some: "Looks into the problem before deciding." },
};

/** One plain sentence per skill and level (judge feedback: no keyword lists). Distinct across skills, so never repeated on a card. */
export function summaryLine(skill: SkillSlug, level: Candidate["level"], _quote?: string): string {
  void _quote;
  return LEAD[skill][level];
}

export function extractEvidence(input: ExtractInput): Evidence[] {
  // The decision behind a checkpoint: its question, the option picked and the issue or prompt.
  const contextFor = (cp: ExtractInput["checkpoints"][number]) => {
    const d = input.decisionPath.filter((x) => x.nodeId === cp.nodeId);
    return [cp.question ?? "", ...d.flatMap((x) => [x.optionLabel, x.prompt ?? ""])].filter(Boolean);
  };
  const usable = input.checkpoints.filter((c) => c.transcript.text.trim());
  // Every candidate quote for every skill, scored. Level and design signal first, then the quote's rank.
  const candidates: (Candidate & { skill: SkillSlug })[] = [];
  for (const skill of input.targetSkills)
    for (const cp of usable) {
      const signalled = cp.kind === "decision" && (input.nodeSkills[cp.nodeId] ?? []).includes(skill);
      const j = judge(skill, cp.transcript.text, signalled, contextFor(cp));
      if (!j) continue;
      const base = (j.level === "strong" ? 10 : 5) + (signalled ? 2 : 0) + (cp.kind === "real_life" ? 1 : 0);
      // A quote in the skill's own words beats one picked only because the decision was meant to surface the skill
      // (a prioritization sentence must not back Resilience when a real setback sentence exists).
      j.quotes.forEach((quote, k) => candidates.push({ skill, checkpointId: cp.id, quote, level: j.level, score: base + (SKILL_WORDS[skill].test(quote) ? 3 : 0) - k * 0.01 }));
    }
  // One quote backs at most one skill per card: the best-fitting skill takes it, the other uses its next-best
  // quote or, with none left, reads Not observed. Ties keep the employer's skill order.
  const order = (s: SkillSlug) => input.targetSkills.indexOf(s);
  candidates.sort((a, b) => b.score - a.score || order(a.skill) - order(b.skill));
  const chosen = new Map<SkillSlug, Candidate>();
  const used = new Set<string>();
  for (const c of candidates) {
    const key = `${c.checkpointId}\u0000${c.quote}`;
    if (chosen.has(c.skill) || used.has(key)) continue;
    chosen.set(c.skill, c);
    used.add(key);
  }
  const raw: Evidence[] = input.targetSkills.map((skill) => {
    if (!usable.length) return { skill, level: "needs_review" as const };
    const best = chosen.get(skill);
    if (!best) return { skill, level: "not_observed" as const };
    const cp = usable.find((c) => c.id === best.checkpointId)!;
    const loc = locateQuote(cp.transcript, best.quote);
    if (!loc) return { skill, level: "needs_review" as const };
    return {
      skill,
      level: best.level,
      sentence: summaryLine(skill, best.level, best.quote),
      source: { type: "clip" as const, checkpointId: best.checkpointId, quote: best.quote, startS: loc.startS, endS: loc.endS },
    };
  });

  // G1: the same check the card runs. Anything unverifiable is dropped here too.
  const { evidence } = verifyEvidence({
    evidence: raw,
    checkpoints: input.checkpoints as CardCheckpoint[],
    decisionPath: input.decisionPath.map((d) => ({ ...d, prompt: "", decidedMs: 0, at: "" })),
  });
  return evidence;
}
