import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { badgeRequestBody } from "@/lib/integrations/badgeRequest";
import { BadgeFromEvidence, evidenceDigest, issueBadgeFromEvidence, verifyBadge } from "@/lib/integrations/credential";
import { POST } from "@/app/api/credentials/route";

// QA night: /api/credentials used to sign whatever levels the browser sent. Now it takes the answers,
// re-scores them with the Evidence Scanner, signs only what it finds and binds a digest of the answers.
const maya = CardSchema.parse(fixture);
const post = (body: unknown) => POST(new Request("https://tp.example/api/credentials", { method: "POST", body: JSON.stringify(body) }));

describe("QA: badge levels come from the server, not the browser", () => {
  it("a request that sends levels (\"all Strong\") is refused", async () => {
    const res = await post({ attemptId: "x", challengeTitle: "t", company: "c", finishedAt: "2026-11-05T00:00:00Z", skills: [{ skill: "prioritization", level: "strong" }, { skill: "collaboration", level: "strong" }] });
    expect(res.status).toBe(422);
  });

  it("smuggling levels next to the evidence is refused too", async () => {
    const res = await post({ ...badgeRequestBody(maya), skills: [{ skill: "communication", level: "strong" }] });
    expect(res.status).toBe(422);
  });

  it("Maya's answers give exactly the levels on her card, and the badge verifies", async () => {
    const res = await post(badgeRequestBody(maya));
    expect(res.status).toBe(200);
    const vc = await res.json();
    const r = verifyBadge(vc);
    expect(r.valid).toBe(true);
    const onCard = maya.evidence.filter((e) => e.level === "strong" || e.level === "some").map((e) => `${e.skill}:${e.level}`).sort();
    const signed = (vc.credentialSubject.result as { resultDescription: string; value: string }[]).map((x) => `${x.resultDescription.replace("urn:tp:skill:", "")}:${x.value.toLowerCase()}`).sort();
    expect(signed).toEqual(onCard);
    expect(JSON.stringify(vc.evidence)).toContain(evidenceDigest(badgeRequestBody(maya).evidence));
  });

  it("generic answers cannot buy Strong", () => {
    const body = BadgeFromEvidence.parse({
      ...badgeRequestBody(maya),
      evidence: { ...badgeRequestBody(maya).evidence, checkpoints: maya.checkpoints.map((c) => ({ id: c.id, nodeId: c.nodeId, kind: c.kind, text: "I am a strong team player and great at prioritization and communication." })) },
    });
    const vc = issueBadgeFromEvidence(body, "https://tp.example") as unknown as { credentialSubject: { result: { value: string }[] } };
    expect(vc.credentialSubject.result.map((x) => x.value)).not.toContain("Strong");
  });

  it("the digest changes when any answer changes", () => {
    const ev = badgeRequestBody(maya).evidence;
    const edited = { ...ev, checkpoints: ev.checkpoints.map((c, i) => (i === 0 ? { ...c, text: c.text + " Also I am brilliant." } : c)) };
    expect(evidenceDigest(edited)).not.toBe(evidenceDigest(ev));
  });
});
