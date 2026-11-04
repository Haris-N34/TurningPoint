"use client";

import { useState } from "react";
import { followUpQuestion } from "@/lib/ai/questions";
import type { Profile } from "@/lib/store/store";
import { Checkpoint, type CheckpointResult } from "./Checkpoint";
import type { Mode } from "./useRecorder";

export type RealStory = { title: string; checkpointId: string; followUpCheckpointId?: string };

export const REAL_LIFE_QUESTION = "When have you faced something like this in real life? What broke, what did you decide, what changed?";

/**
 * Final checkpoint (C5): the real-life answer, one follow-up about a detail they said,
 * then a one-sentence title in their own words.
 */
export function RealLife(p: {
  attemptId: string;
  nodeId: string;
  prompt: string;
  profile: Profile;
  persistMedia?: boolean;
  onModeChange: (m: Mode) => void;
  onDone: (r: { results: CheckpointResult[]; story: RealStory }) => void;
}) {
  const [step, setStep] = useState<"intro" | "answer" | "follow" | "title">("intro");
  const [results, setResults] = useState<CheckpointResult[]>([]);
  const [follow, setFollow] = useState<{ question: string; source: "generated" | "fallback" } | null>(null);
  const [title, setTitle] = useState("");
  const common = {
    attemptId: p.attemptId,
    nodeId: p.nodeId,
    multiplier: p.profile.accommodations.timeMultiplier,
    defaultMode: p.profile.defaultMode,
    textOnly: p.profile.accommodations.textOnly,
    onModeChange: p.onModeChange,
    persistMedia: p.persistMedia,
  };

  if (step === "intro") {
    return (
      <div className="rounded-2xl border p-5" data-testid="real-life-intro">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">Last checkpoint</p>
        <p className="mt-2 text-lg font-medium">Now link it to something real.</p>
        <p className="mt-1 text-sm opacity-80">
          You&apos;ll get 30 seconds to think and up to 2 minutes to answer, then one short follow-up. Any format works.
        </p>
        <button onClick={() => setStep("answer")} className="mt-4 rounded-full bg-foreground px-5 py-2.5 font-medium text-background" autoFocus>
          Start
        </button>
      </div>
    );
  }

  if (step === "answer") {
    return (
      <Checkpoint
        {...common}
        key="rl"
        id="rl"
        kind="real_life"
        question={REAL_LIFE_QUESTION}
        questionSource="generated"
        onDone={(r) => {
          setResults([r]);
          setFollow(followUpQuestion(r.checkpoint.transcript.text));
          setStep("follow");
        }}
      />
    );
  }

  if (step === "follow" && follow) {
    return (
      <Checkpoint
        {...common}
        key="fu"
        id="fu"
        kind="follow_up"
        question={follow.question}
        questionSource={follow.source}
        onDone={(r) => {
          setResults((x) => [...x, r]);
          setStep("title");
        }}
      />
    );
  }

  const words = title.trim().split(/\s+/).filter(Boolean).length;
  return (
    <form
      className="rounded-2xl border p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        p.onDone({ results, story: { title: title.trim(), checkpointId: "rl", followUpCheckpointId: "fu" } });
      }}
    >
      <label htmlFor="story-title" className="text-lg font-medium">
        Give your story a one-sentence title
      </label>
      <p className="mt-1 text-sm opacity-80">Your words, not ours. It appears at the top of your real turning point.</p>
      <input
        id="story-title"
        data-testid="story-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="The summer our garden lost its funding"
        className="mt-3 w-full rounded-xl border px-3 py-2"
        autoFocus
      />
      <p className="mt-1 text-xs opacity-60">{words} words</p>
      <button type="submit" disabled={!title.trim()} className="mt-3 rounded-full bg-foreground px-5 py-2.5 font-medium text-background disabled:opacity-50">
        Finish
      </button>
    </form>
  );
}
