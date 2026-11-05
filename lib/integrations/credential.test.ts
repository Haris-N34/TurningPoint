import { describe, expect, it } from "vitest";
import { base58btc, issueBadge, jcs, unbase58btc, verifyBadge } from "./credential";

const req = {
  attemptId: "att_demo_maya",
  challengeTitle: "Field Operations Analyst, Summer 2027",
  company: "Prairie Grid Energy (fictional)",
  finishedAt: "2026-11-04T17:00:00Z",
  skills: [
    { skill: "collaboration" as const, level: "strong" as const },
    { skill: "adaptability" as const, level: "some" as const },
  ],
};

describe("Open Badges 3.0 credential (C.9)", () => {
  it("is a W3C VC / OpenBadgeCredential in JSON-LD with an Ed25519 Data Integrity proof", () => {
    const vc = issueBadge(req, "https://tp.example") as Record<string, unknown> & { proof: Record<string, string> };
    expect(vc["@context"]).toEqual(["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"]);
    expect(vc.type).toEqual(["VerifiableCredential", "OpenBadgeCredential"]);
    expect(vc.proof).toMatchObject({ type: "DataIntegrityProof", cryptosuite: "eddsa-jcs-2022", proofPurpose: "assertionMethod" });
    expect(vc.proof.verificationMethod).toMatch(/^did:key:z6Mk/);
    expect(JSON.stringify(vc)).not.toContain("Maya");
  });

  it("verifies an untouched credential", () => {
    const vc = issueBadge({ ...req, name: "Maya Chen" }, "https://tp.example");
    const r = verifyBadge(JSON.parse(JSON.stringify(vc)));
    expect(r).toMatchObject({ valid: true, issuerKnown: true });
    if (r.valid) expect(r.skills).toEqual([{ skill: "Collaboration", level: "Strong" }, { skill: "Adaptability", level: "Some" }]);
  });

  it("a tampered file fails verification", () => {
    const vc = JSON.parse(JSON.stringify(issueBadge(req, "https://tp.example")));
    vc.credentialSubject.result[1].value = "Strong";
    const r = verifyBadge(vc);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/changed after it was issued/);
  });

  it("rejects a swapped issuer, a missing proof and junk", () => {
    const vc = JSON.parse(JSON.stringify(issueBadge(req, "https://tp.example")));
    expect(verifyBadge({ ...vc, issuer: { ...vc.issuer, id: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK" } }).valid).toBe(false);
    const { proof: _p, ...noProof } = vc;
    void _p;
    expect(verifyBadge(noProof).valid).toBe(false);
    expect(verifyBadge("hello").valid).toBe(false);
  });

  it("JCS sorts keys and base58btc round-trips", () => {
    expect(jcs({ b: 1, a: [true, null, "x"], c: { z: 1, y: 2 } })).toBe('{"a":[true,null,"x"],"b":1,"c":{"y":2,"z":1}}');
    const bytes = Uint8Array.from([0, 0, 1, 2, 255]);
    expect(Array.from(unbase58btc(base58btc(bytes)))).toEqual(Array.from(bytes));
  });
});
