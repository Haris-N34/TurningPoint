import { describe, expect, it } from "vitest";
import { issueBadge, issuer, verifyBadge } from "@/lib/integrations/credential";

// QA night: /verify with a forged badge. Anyone can make an Ed25519 key, name themselves as issuer and
// sign their own "Strong" levels. The signature is internally consistent, so only the issuer check stops it.
const req = {
  attemptId: "att_forged",
  challengeTitle: "Field Operations Analyst",
  company: "Prairie Grid Energy (fictional)",
  finishedAt: "2026-11-04T17:00:00Z",
  skills: [{ skill: "collaboration" as const, level: "strong" as const }],
};

describe("QA: credential forgery", () => {
  it("a badge self-signed by a stranger's key is not valid", () => {
    const real = issuer();
    const g = globalThis as unknown as { __tpIssuer?: unknown };
    g.__tpIssuer = undefined;
    const forged = JSON.parse(JSON.stringify(issueBadge(req, "https://evil.example"))); // fresh random key = attacker
    g.__tpIssuer = real;
    const r = verifyBadge(forged);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/not Turning Point/i);
  });
});
