import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { POST } from "@/app/api/mock-greenhouse/route";
import { buildExport, sendToAts } from "./ats";

function setup() {
  const s = makeStore(new MemoryKV());
  const card = CardSchema.parse(fixture);
  s.saveCard(card);
  s.saveCard({ ...card, attemptId: "att_held", anonId: "Candidate HHHH" });
  s.share(card.attemptId, "ch1", false);
  s.share("att_held", "ch1", false);
  s.review({ attemptId: card.attemptId, challengeId: "ch1", decision: "shortlist" });
  s.review({ attemptId: "att_held", challengeId: "ch1", decision: "hold" });
  return { s, card };
}

describe("mock ATS export (E5)", () => {
  it("exports only shortlisted candidates, each linking back to their card", () => {
    const { s } = setup();
    const p = buildExport(s, { id: "ch1", jobCode: "TP-ABCDE" }, "https://tp.example", new Date("2026-11-04T12:00:00Z"));
    expect(p.candidates).toHaveLength(1);
    expect(p.candidates[0].name).toBe("Maya Chen");
    expect(p.candidates[0].attachments[0].url).toBe("https://tp.example/recruiter/card/att_demo_maya?challenge=ch1");
  });

  it("posts to the in-app endpoint and logs the export", async () => {
    const { s } = setup();
    const p = buildExport(s, { id: "ch1" }, "https://tp.example");
    const fetcher = (async (_url: string, init: RequestInit) => POST(new Request("http://x/api/mock-greenhouse", init))) as unknown as typeof fetch;
    expect(await sendToAts(s, p, fetcher)).toMatchObject({ ok: true, received: 1 });
    const bad = (async () => POST(new Request("http://x", { method: "POST", body: "{}" }))) as unknown as typeof fetch;
    await expect(sendToAts(s, p, bad)).rejects.toThrow();
  });
});
