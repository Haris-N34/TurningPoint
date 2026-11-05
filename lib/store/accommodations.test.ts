import { describe, expect, it } from "vitest";
import { ProfileSchema } from "./store";
import { withAccommodation } from "./accommodations";

const base = ProfileSchema.parse({});

describe("A4 low bandwidth", () => {
  it("switches a video default to voice", () => {
    const p = withAccommodation({ ...base, defaultMode: "video" }, "lowBandwidth", true);
    expect(p.accommodations.lowBandwidth).toBe(true);
    expect(p.defaultMode).toBe("voice");
  });
  it("keeps voice and text defaults", () => {
    expect(withAccommodation({ ...base, defaultMode: "text" }, "lowBandwidth", true).defaultMode).toBe("text");
    expect(withAccommodation({ ...base, defaultMode: "voice" }, "lowBandwidth", true).defaultMode).toBe("voice");
  });
  it("other accommodations only flip their own flag", () => {
    const p = withAccommodation({ ...base, defaultMode: "video" }, "reducedMotion", true);
    expect(p.defaultMode).toBe("video");
    expect(p.accommodations.reducedMotion).toBe(true);
  });
});
