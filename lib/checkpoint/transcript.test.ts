import { describe, expect, it } from "vitest";
import { applyCorrection, fromChunks, wordsChanged } from "./transcript";

describe("applyCorrection", () => {
  const t = fromChunks([{ text: "I let the team vote", startS: 1, endS: 3 }, { text: "we cut the second weekend", startS: 5, endS: 8 }]);

  it("returns the same transcript when nothing changed", () => {
    expect(applyCorrection(t, "I let the team vote we cut the second weekend", 10)).toBe(t);
  });

  it("keeps timings of matched words and fits new words between neighbours", () => {
    const c = applyCorrection(t, "I let the team vote, so we cut the second weekend", 10);
    expect(c.text).toBe("I let the team vote, so we cut the second weekend");
    const we = c.words.find((w) => w.w === "we")!;
    expect(we.start).toBe(t.words.find((w) => w.w === "we")!.start);
    const so = c.words.find((w) => w.w === "so")!;
    expect(so.start).toBeGreaterThanOrEqual(t.words[4].end - 0.01);
    expect(so.start).toBeLessThanOrEqual(we.start);
    expect(c.words.map((w) => w.w).join(" ")).toBe(c.text);
  });

  it("fixes a misheard word in place", () => {
    const c = applyCorrection(t, "I let the team vote we cut the second weekend", 10);
    expect(c).toBe(t);
    const d = applyCorrection(t, "I let the team vote we cut the second week", 10);
    expect(d.words.at(-1)!.w).toBe("week");
    expect(d.words.at(-1)!.start).toBeGreaterThan(5);
  });

  it("spreads typed words across the recording when nothing was heard", () => {
    const empty = fromChunks([]);
    const c = applyCorrection(empty, "I cut the second weekend", 10);
    expect(c.status).toBe("ready");
    expect(c.words).toHaveLength(5);
    expect(c.words[0].start).toBe(0);
    expect(c.words.at(-1)!.start).toBe(8);
  });

  it("an emptied transcript is unavailable", () => {
    expect(applyCorrection(t, "  ", 10).status).toBe("unavailable");
  });
});

describe("wordsChanged", () => {
  it("counts word edits", () => {
    expect(wordsChanged("I cut the second weekend", "I cut the second weekend")).toBe(0);
    expect(wordsChanged("I cut the second week", "I cut the second weekend")).toBe(1);
    expect(wordsChanged("", "two words")).toBe(2);
    expect(wordsChanged("we kept both days", "we kept both of the days")).toBe(2);
  });
});
