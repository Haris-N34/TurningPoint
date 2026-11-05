import { z } from "zod";
import type { Card, CardCheckpoint } from "@/lib/card/types";
import type { GameState } from "@/lib/game/engine";
import type { MapScenario } from "@/lib/game/schema";
import { stripPii, type Known } from "../guards/pii";
import { protectedCheck } from "../guards/protected";
import { quoteIn } from "../guards/quotes";
import type { PromptDef } from "../prompts/types";
import { runSync, type RunOptions } from "../run";

// Consistency Checker (PRD v2 B2): said vs did, at run end. Three checks: the order the candidate said they
// would tackle problems vs what they did next; each explanation vs the option actually picked; the real story
// vs the follow-up answer. Context for the recruiter, never a penalty and never part of any level.

export const ConsistencyItem = z.object({ kind: z.enum(["order", "explanation", "story"]), said: z.string(), did: z.string(), consistent: z.boolean() });
export const ConsistencyOutput = z.object({ items: z.array(ConsistencyItem) });
export type ConsistencyOutput = z.infer<typeof ConsistencyOutput>;

type Opt = { id: string; label: string };
export type ConsistencyInput = {
  order?: { saidFirst: string; didFirst: string };
  explanations: { checkpointId: string; transcript: string; picked: Opt; others: Opt[] }[];
  story?: { story: string; followUp: string; title: string };
};

const STOP = new Set("about after again because before being could doing going have just like made make more most much only other over really said some than that their them then there these they thing this those through very want were what when where which while with would your yours from into because since".split(" "));
const content = (s: string) => new Set((s.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, "")));
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;

/** First sentence, at most 20 words, copied verbatim so it is an exact substring of what was said. */
function excerpt(text: string): string {
  const first = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  const ws = first.split(/\s+/).filter(Boolean);
  return ws.slice(0, 20).join(" ");
}

function explanationItem(e: ConsistencyInput["explanations"][number]) {
  const said = excerpt(e.transcript);
  const t = content(e.transcript);
  const letter = e.transcript.match(/\b(?:option|picked|chose|choose|went with)\s+([abcd])\b/i)?.[1]?.toLowerCase();
  const mine = overlap(t, content(e.picked.label));
  const best = Math.max(0, ...e.others.map((o) => overlap(t, content(o.label))));
  const consistent = letter ? letter === e.picked.id : mine >= best;
  return { kind: "explanation" as const, said, did: `Picked ${e.picked.id.toUpperCase()}: ${e.picked.label}`, consistent };
}

export function localConsistency(i: ConsistencyInput): ConsistencyOutput {
  const items: ConsistencyOutput["items"] = [];
  if (i.order) {
    const same = i.order.saidFirst === i.order.didFirst;
    items.push({ kind: "order", said: `Said they'd go to ${i.order.saidFirst} first`, did: same ? `Went to ${i.order.didFirst} first` : `Went to ${i.order.didFirst} first instead`, consistent: same });
  }
  for (const e of i.explanations) if (e.transcript.trim()) items.push(explanationItem(e));
  if (i.story && i.story.story.trim() && i.story.followUp.trim()) {
    const shared = overlap(content(i.story.story), content(i.story.followUp));
    items.push({ kind: "story", said: excerpt(i.story.followUp), did: `Real story: “${i.story.title}”`, consistent: shared >= 2 });
  }
  return { items };
}

export const consistencyPrompt: PromptDef<ConsistencyInput, ConsistencyOutput> = {
  id: "consistency-checker",
  version: "1.0.0",
  service: "Consistency Checker",
  tier: "fast",
  system: [
    "Compare what a candidate said with what they did. Return one item per comparison given.",
    "'said' must be copied exactly from their words. Mark consistent true unless they clearly contradict the action.",
    "This is context for a human, never a score. Never mention personal traits.",
  ].join("\n"),
  render: (i) => JSON.stringify(i),
  schema: ConsistencyOutput,
  local: localConsistency,
  // The order comparison needs no model, so it survives a failure.
  fallback: (i) => localConsistency({ order: i.order, explanations: [] }),
  check: (o, i) => {
    for (const it of o.items) {
      if (it.kind === "explanation" && !i.explanations.some((e) => quoteIn(e.transcript, it.said))) return "explanation quote not in transcript";
      if (it.kind === "story" && !(i.story && quoteIn(i.story.followUp, it.said))) return "story quote not in follow-up";
    }
    return protectedCheck(...o.items.map((x) => `${x.said} ${x.did}`));
  },
  fixtures: [
    {
      name: "order kept, explanation matches",
      input: {
        order: { saidFirst: "the vendor deposit", didFirst: "the vendor deposit" },
        explanations: [{ checkpointId: "cp1", transcript: "I went with the cheaper venue because the deposit was due Friday.", picked: { id: "b", label: "Book the cheaper venue" }, others: [{ id: "a", label: "Keep the original hall" }] }],
      },
    },
    {
      name: "order changed",
      input: { order: { saidFirst: "the sponsor call", didFirst: "the broken stall" }, explanations: [] },
    },
  ],
};

/** Build the checker's input from a finished map run (blind: names and schools stripped from answers). */
export function consistencyInput(s: MapScenario, st: GameState, answers: CardCheckpoint[], realStory: Card["realStory"] | undefined, known: Known = {}): ConsistencyInput {
  const title = (id: string) => s.issues.find((i) => i.id === id)?.title.toLowerCase() ?? id;
  const order = st.order.ranking?.length && st.order.did.length ? { saidFirst: title(st.order.ranking[0]), didFirst: title(st.order.did[0]) } : undefined;
  const explanations = answers
    .filter((a) => a.kind === "decision")
    .flatMap((a) => {
      const choice = st.choices.find((c) => c.issue === a.nodeId);
      const node = s.nodes.find((n) => n.id === choice?.node);
      if (!choice || !node) return [];
      return [{
        checkpointId: a.id,
        transcript: stripPii(a.transcript.text, known),
        picked: { id: choice.option, label: choice.label },
        others: node.options.filter((o) => o.id !== choice.option).map((o) => ({ id: o.id, label: o.label })),
      }];
    });
  const rl = answers.find((a) => a.id === realStory?.checkpointId);
  const fu = answers.find((a) => a.id === realStory?.followUpCheckpointId);
  const story = rl && fu && realStory ? { story: stripPii(rl.transcript.text, known), followUp: stripPii(fu.transcript.text, known), title: realStory.title } : undefined;
  return { order, explanations, story };
}

/** Same checks for a classic (non-map) card: explanations vs the logged choice, and the real story vs follow-up. */
export function cardConsistencyInput(
  card: Pick<Card, "checkpoints" | "decisionPath" | "realStory">,
  optionsFor: (nodeId: string) => Opt[],
  known: Known = {},
): ConsistencyInput {
  const explanations = card.checkpoints
    .filter((a) => a.kind === "decision")
    .flatMap((a) => {
      const step = card.decisionPath.find((d) => d.checkpointId === a.id) ?? card.decisionPath.find((d) => d.nodeId === a.nodeId);
      if (!step) return [];
      return [{
        checkpointId: a.id,
        transcript: stripPii(a.transcript.text, known),
        picked: { id: step.optionId, label: step.optionLabel },
        others: optionsFor(step.nodeId).filter((o) => o.id !== step.optionId),
      }];
    });
  const rs = card.realStory;
  const rl = card.checkpoints.find((a) => a.id === rs?.checkpointId);
  const fu = card.checkpoints.find((a) => a.id === rs?.followUpCheckpointId);
  const story = rl && fu && rs ? { story: stripPii(rl.transcript.text, known), followUp: stripPii(fu.transcript.text, known), title: rs.title } : undefined;
  return { explanations, story };
}

export function checkConsistency(input: ConsistencyInput, opts: RunOptions = {}): NonNullable<Card["consistency"]> {
  return runSync(consistencyPrompt, input, opts).output.items;
}
