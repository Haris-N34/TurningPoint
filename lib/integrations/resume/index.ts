import type { Card } from "@/lib/card/types";
import { verifyEvidence } from "@/lib/card/verify";
import { SKILLS, type SkillSlug } from "@/lib/engine/skills";
import { isBullet, isHeading, redactResume, splitRoleLine } from "./redact";

export { redactResume } from "./redact";

// Resume Analyzer (PRD v2 C4; C.5, C.6, C.8). Deterministic and local: no model, no network.
// Order is fixed: redact first, then the analyzer sees only redacted text.
// Resume items are "Claimed"; game items are "Observed". A claim is "Backed by game evidence" or
// "Not yet shown". It is never called false.

export const CLAIMED = "Claimed";
export const OBSERVED = "Observed";
export const BACKED = "Backed by game evidence";
export const NOT_YET_SHOWN = "Not yet shown";

export type ExtractedClaim = { text: string; roleLabel: string; action: string; result?: string; hasNumber: boolean; skills: SkillSlug[] };
export type ClaimLink =
  | { type: "clip"; skill: SkillSlug; checkpointId: string; startS: number; quote: string }
  | { type: "kpi"; skill: SkillSlug; kpiId: string; label: string }
  | { type: "choice"; skill: SkillSlug; nodeId: string; optionLabel: string };
export type ResumeClaim = ExtractedClaim & { id: string; backed: boolean; link?: ClaimLink };
export type ResumeAnalysis = { source: "upload" | "ats"; consentAt: string; redactions: number; claims: ResumeClaim[] };

// Keyword cues per skill. Plain and auditable; the same words always map to the same skills.
const CUES: Record<SkillSlug, RegExp> = {
  "problem-solving": /\b(solved|fix(ed|ing)?|troubleshoot\w*|resolved|streamlin\w*|organi[sz]ed|redesign\w*)\b/i,
  adaptability: /\b(adapt\w*|pivot\w*|changed|switched|adjust\w*|when (the )?(funding|budget|plan|schedule)\b)/i,
  resilience: /\b(despite|recover\w*|setbacks?|half|dropped|bounced back|persever\w*)\b/i,
  ambiguity: /\b(uncertain\w*|ambigu\w*|unclear|incomplete|without (clear|full)|judg(e)?ment call)\b/i,
  prioritization: /\b(cut|prioriti\w*|protect\w*|focus(ed)?|deadlines?|triag\w*|scheduled)\b/i,
  creativity: /\b(donat\w*|negotiat\w*|repurpos\w*|creativ\w*|designed|built|invent\w*|saving|saved)\b/i,
  collaboration: /\b(team|volunteers?|coworkers?|together|collaborat\w*|partner\w*|led|co-?led)\b/i,
  empathy: /\b(listen\w*|support(ed|ing)?|mentor\w*|cared|wellbeing|well-being|welcom\w*)\b/i,
  communication: /\b(informed|present\w*|wrote|explain\w*|communicat\w*|told|updates?|newsletter|pitched)\b/i,
  feedback: /\b(feedback|critique|revised|iterat\w*|improved after)\b/i,
  analytical: /\b(analy\w*|data|metrics|forecast\w*|counts?|measured|tracked|spreadsheets?)\b/i,
  curiosity: /\b(research\w*|investigat\w*|explored|discovered|learned|interviewed)\b/i,
};

const RESULT = /,?\s*\b(saving|saved|resulting in|which|leading to|increasing|reducing|raising|so that|to achieve|growing|cutting costs)\b/i;

/** Pull structured achievements out of REDACTED resume text. This is the "analyzer" step. */
export function extractClaims(redacted: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  let section = "";
  let role = "Role";
  for (const line of redacted.split("\n")) {
    if (isHeading(line)) {
      section = line.trim().toLowerCase();
      continue;
    }
    if (!line.trim() || line.trim().startsWith("[")) continue;
    if (!isBullet(line)) {
      if (section !== "education" && section !== "skills") role = splitRoleLine(line).role;
      continue;
    }
    const text = line.replace(/^\s*[-•*–]\s+/, "").trim();
    const m = text.match(RESULT);
    const action = (m ? text.slice(0, m.index) : text).replace(/[,.;]\s*$/, "").trim();
    const result = m ? text.slice(m.index! + (m[0].startsWith(",") ? 1 : 0)).trim().replace(/\.$/, "") : undefined;
    const skills = SKILLS.map((s) => s.slug).filter((s) => CUES[s].test(text));
    claims.push({ text, roleLabel: role, action, result, hasNumber: /\d/.test(text), skills });
  }
  return claims;
}

/** Link each claim to observed game evidence for one of its skills. Clip first, then choice, then KPI. */
export function linkClaim(claim: ExtractedClaim, card: Pick<Card, "evidence" | "checkpoints" | "decisionPath" | "kpis">): ClaimLink | undefined {
  const evidence = verifyEvidence(card).evidence.filter((e) => (e.level === "strong" || e.level === "some") && e.source);
  for (const skill of claim.skills) {
    const e = evidence.find((x) => x.skill === skill);
    if (e?.source?.type === "clip") return { type: "clip", skill, checkpointId: e.source.checkpointId, startS: e.source.startS, quote: e.source.quote };
    if (e?.source?.type === "choice") return { type: "choice", skill, nodeId: e.source.nodeId, optionLabel: e.source.optionLabel };
    const k = card.kpis?.find((x) => x.skills.includes(skill) && (x.score ?? 0) >= 60);
    if (k) return { type: "kpi", skill, kpiId: k.id, label: k.label };
  }
  return undefined;
}

export function analyzeResume(
  raw: string,
  card: Pick<Card, "evidence" | "checkpoints" | "decisionPath" | "kpis">,
  opts: { source: "upload" | "ats"; knownNames?: string[]; now?: string; analyzer?: (redacted: string) => ExtractedClaim[] },
): ResumeAnalysis {
  const red = redactResume(raw, { knownNames: opts.knownNames });
  const extracted = (opts.analyzer ?? extractClaims)(red.text);
  const claims = extracted.map((c, i) => {
    const link = linkClaim(c, card);
    return { ...c, id: `rc${i + 1}`, backed: !!link, ...(link ? { link } : {}) };
  });
  return { source: opts.source, consentAt: opts.now ?? new Date().toISOString(), redactions: red.total, claims };
}

/** What the resume says about skills, with no identity. Used by the counterfactual test (C.8). */
export function resumeSignals(a: Pick<ResumeAnalysis, "claims">) {
  return a.claims.map((c) => ({ text: c.text, role: c.roleLabel, action: c.action, result: c.result ?? null, hasNumber: c.hasNumber, skills: c.skills, backed: c.backed, link: c.link?.type ?? null }));
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** A private real-life story suggestion, shown only to the candidate (never on the employer card). */
export function realLifeSuggestion(claims: Pick<ResumeClaim, "action" | "backed">[]): string | undefined {
  const pick = claims.find((c) => !c.backed) ?? claims[0];
  if (!pick) return undefined;
  return `You might talk about the time you ${lowerFirst(pick.action)}. Your game evidence doesn't show that yet.`;
}
