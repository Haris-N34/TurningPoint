import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClipPlayer } from "@/components/card/ClipPlayer";
import type { CardCheckpoint } from "@/lib/card/types";

const cp: CardCheckpoint = {
  id: "cp1",
  nodeId: "n1",
  kind: "decision",
  question: "Why?",
  questionSource: "generated",
  mode: "voice",
  durationS: 10,
  transcript: { text: "we cut the second weekend", words: [], status: "ready" },
  retakeUsed: false,
  hidden: false,
};

describe("recruiter view of a corrected transcript", () => {
  it("offers the original speech to text when the candidate fixed words", () => {
    const html = renderToStaticMarkup(createElement(ClipPlayer, { checkpoint: { ...cp, recognizedText: "we cut the second week end" } }));
    expect(html).toContain('data-testid="recognized-text"');
    expect(html).toContain("we cut the second week end");
  });
  it("shows nothing extra when the transcript was not changed", () => {
    expect(renderToStaticMarkup(createElement(ClipPlayer, { checkpoint: cp }))).not.toContain("recognized-text");
  });
});
