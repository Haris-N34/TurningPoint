import type { ChoiceNodeT, Scenario } from "@/lib/engine/schema";
import type { CheckpointDue } from "@/lib/engine/engine";
import { rng } from "@/lib/engine/seed";

// Local, deterministic stand-ins for the AI question jobs (demo scope: no API keys).
// Inputs are choices, resources and transcripts only. Never a name, email, university or video (G2).

export const FOLLOW_UP_FALLBACK = "What was the hardest part to tell your team?";
export const MAX_QUESTION_WORDS = 30;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const strip = (s: string) => s.replace(/[.!?]+$/, "");

export type GeneratedQuestion = { question: string; source: "generated" | "fallback" };

/**
 * Checkpoint question (C4.2): quotes the choice the candidate just made, contrasts it with an option
 * they did not pick, and asks why. Falls back to the node's pre-written question.
 */
export function checkpointQuestion(s: Scenario, due: CheckpointDue, seed: string): GeneratedQuestion {
  const node = s.nodes.find((n) => n.id === due.nodeId) as ChoiceNodeT | undefined;
  const last = due.recentChoices.at(-1);
  if (!node || node.type !== "choice" || !last || last.nodeId !== due.nodeId) {
    return { question: node?.type === "choice" && node.fallbackQuestion ? node.fallbackQuestion : "Why did you make that last choice?", source: "fallback" };
  }
  const chosen = strip(last.optionLabel);
  const others = node.options.filter((o) => o.id !== last.optionId).map((o) => strip(o.label));
  const r = rng(`${seed}:${due.nodeId}`);
  const other = others[Math.floor(r() * others.length)];

  // A resource that is now low gives the question an edge, e.g. "with morale at 20".
  const low = Object.entries(s.resources).find(([k, def]) => {
    const v = due.resources[k];
    const top = def.max ?? def.start;
    return v !== undefined && top > 0 && v / top < 0.3;
  });
  const lowBit = low ? ` with ${lower(low[1].label)} at ${low[1].unit === "$" ? "$" + due.resources[low[0]].toLocaleString("en-CA") : due.resources[low[0]]}` : "";

  const templates = [
    `You chose "${chosen}" instead of "${other}"${lowBit}. Why?`,
    `You picked "${chosen}" over "${other}". What did you give up, and why was it worth it?`,
    `You went with "${chosen}"${lowBit}. Who does that affect most, and why did you accept that?`,
  ];
  let q = templates[Math.floor(r() * templates.length)];
  if (words(q) > MAX_QUESTION_WORDS) q = `You chose "${chosen}". Why?`;
  if (words(q) > MAX_QUESTION_WORDS) return { question: node.fallbackQuestion ?? "Why did you make that choice?", source: "fallback" };
  return { question: q, source: "generated" };
}

// Things that tend to "break" in a real story. A clause containing one is the detail worth asking about.
const BREAK_WORDS =
  /\b(pulled out|quit|quits|left|cancel+ed|lost|cut|failed|fell through|dropped|ran out|broke|stopped|backed out|rejected|missed|delayed|changed|moved|closed|shut down)\b/i;

/** Pick a short, verbatim detail from the real-life answer, preferring the moment something broke. */
export function pickDetail(transcript: string): string | undefined {
  const clauses = transcript
    .split(/(?<=[.!?])\s+|,\s+(?:and|but|so)\s+|;\s+/)
    .map((c) => c.trim().replace(/[.!?,;]+$/, ""))
    .filter((c) => words(c) >= 3);
  const hit = clauses.find((c) => BREAK_WORDS.test(c)) ?? clauses.find((c) => words(c) >= 5);
  if (!hit) return undefined;
  const w = hit.split(/\s+/);
  if (w.length <= 12) return hit;
  // Keep a 12-word window centred on the break word when the clause is long.
  const m = hit.match(BREAK_WORDS);
  const idx = m?.index !== undefined ? hit.slice(0, m.index).split(/\s+/).filter(Boolean).length : 0;
  const start = Math.max(0, Math.min(idx - 5, w.length - 12));
  return w.slice(start, start + 12).join(" ");
}

/** Follow-up question about a specific detail they mentioned (C5.2). */
export function followUpQuestion(transcript: string): GeneratedQuestion {
  const detail = pickDetail(transcript);
  if (!detail) return { question: FOLLOW_UP_FALLBACK, source: "fallback" };
  const d = lower(detail.replace(/^(and|but|so|then)\s+/i, ""));
  const q = BREAK_WORDS.test(d)
    ? `You said "${d}". How did you tell the people it affected?`
    : `You said "${d}". What was the hardest decision in that moment?`;
  return words(q) <= MAX_QUESTION_WORDS + 6 ? { question: q, source: "generated" } : { question: FOLLOW_UP_FALLBACK, source: "fallback" };
}

/** Remove the candidate's own name from text before any extractor sees it (G2, PV4). */
export function redactName(text: string, displayName: string): string {
  const parts = displayName.split(/\s+/).filter((p) => p.length >= 2);
  let out = text;
  // Unicode-aware word edges: `\b` treats accented letters as non-word, so José or Zoë would slip through.
  for (const p of parts) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_])`, "giu"), "[name]");
  return out;
}

// ---- v2 map checkpoints (PRD v2, A9): questions quote the action just taken. ----
import type { CheckpointDue as MapDue, GameState as MapState } from "@/lib/game/engine";
import type { MapScenario } from "@/lib/game/schema";

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function mapCheckpointQuestion(s: MapScenario, st: MapState, due: MapDue): GeneratedQuestion {
  const issue = due.issue ? s.issues.find((i) => i.id === due.issue) : undefined;
  const others = s.issues.filter((i) => st.issues[i.id].status === "open" && !i.hidden && i.id !== due.issue);
  const fit = (q: string, fallback: string): GeneratedQuestion => (words(q) <= MAX_QUESTION_WORDS ? { question: q, source: "generated" } : { question: fallback, source: "fallback" });
  // Issue titles are headlines ("Nobody wants logistics"), so they are quoted as titles, never lower-cased into
  // the sentence ("For nobody wants logistics, ..." read wrong). The explain-on-pick wording is unchanged.
  const q = (t: string) => `"${t}"`;
  if (due.kind === "order") {
    const names = others.slice(0, 3).map((i) => q(i.title));
    const list = names.length >= 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "several problems";
    return fit(`You've got ${others.length} open problems: ${list}. Which are you going to first, and why?`, "You've got several open problems. Which are you going to first, and why?");
  }
  if (!issue) return { question: "Why did you make that last call?", source: "fallback" };
  const title = q(issue.title);
  if (due.kind === "explain" && due.optionLabel) {
    return fit(`You chose ${due.optionId?.toUpperCase()}, to ${lc(strip(due.optionLabel))}. Walk us through why.`, `You chose ${due.optionId?.toUpperCase()}. Walk us through why.`);
  }
  switch (due.action) {
    case "defer": {
      const other = others[0] ? `, with ${q(others[0].title)} still open` : "";
      return fit(`You deferred ${title} ("${due.reason}")${other}. Why that order?`, `You deferred ${title}. Why that order?`);
    }
    case "delegate":
      return fit(`You handed ${title} to ${due.to} instead of handling it yourself. Why them, and why then?`, `You handed ${title} to ${due.to}. Why?`);
    default: {
      const pick = `${due.optionId ? `${due.optionId.toUpperCase()}: ` : ""}"${strip(due.optionLabel ?? "")}"`;
      return fit(
        `On ${title}, you chose ${pick}${others.length ? ` while ${others.length} other problem${others.length === 1 ? " was" : "s were"} waiting` : ""}. Why that?`,
        `On ${title}, you chose ${pick}. Why that?`,
      );
    }
  }
}
