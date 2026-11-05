import { describe, expect, it } from "vitest";
import { pickMime } from "./recording";

describe("pickMime", () => {
  it("prefers webm where supported (Chrome, Edge, Firefox)", () => {
    expect(pickMime(true, (t) => t.startsWith("video/webm"))).toEqual({ mimeType: "video/webm;codecs=vp9,opus" });
    expect(pickMime(false, (t) => t.startsWith("audio/webm"))).toEqual({ mimeType: "audio/webm;codecs=opus" });
  });
  it("falls back to mp4 for Safari", () => {
    expect(pickMime(true, (t) => t === "video/mp4")).toEqual({ mimeType: "video/mp4" });
    expect(pickMime(false, (t) => t === "audio/mp4")).toEqual({ mimeType: "audio/mp4" });
  });
  it("lets the browser choose when nothing matches or the check throws", () => {
    expect(pickMime(true, () => false)).toBeUndefined();
    expect(
      pickMime(true, () => {
        throw new Error("no");
      }),
    ).toBeUndefined();
  });
});
