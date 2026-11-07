import { describe, expect, it } from "vitest";
import { downsample, hasSpeech, quietestCut } from "./liveAsr";

describe("live on-device captions: audio helpers", () => {
  it("downsamples 48 kHz to 16 kHz by averaging", () => {
    const x = new Float32Array(48000).map((_, i) => (i % 3 === 0 ? 0.3 : 0));
    const y = downsample(x, 48000);
    expect(y.length).toBe(16000);
    expect(y[0]).toBeCloseTo(0.1, 5);
  });

  it("leaves 16 kHz audio as it is", () => {
    const x = new Float32Array(100).fill(0.5);
    expect(downsample(x, 16000)).toBe(x);
  });

  it("cuts at the quietest moment, so a word is never split between two passes", () => {
    const a = new Float32Array(16000 * 4).fill(0.4);
    a.fill(0, 16000 * 2, 16000 * 2 + 3200); // 200 ms of silence at 2.0 s
    const cut = quietestCut(a, 16000, 16000 * 3);
    expect(cut).toBeGreaterThanOrEqual(16000 * 2);
    expect(cut).toBeLessThanOrEqual(16000 * 2 + 3200);
  });

  it("never sends pure silence to the model (it can invent words on silence)", () => {
    expect(hasSpeech(new Float32Array(16000))).toBe(false);
    expect(hasSpeech(new Float32Array(16000).fill(0.2))).toBe(true);
  });
});
