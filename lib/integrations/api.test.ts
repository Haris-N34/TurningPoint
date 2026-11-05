import { describe, expect, it } from "vitest";
import { sha256hex } from "./crypto";
import { createApiKey, handlePublicApi, openApiSpec, RATE, revokeApiKey } from "./api";
import { createCompany } from "./store";

const q = new URLSearchParams();
const get = (path: string, key: string | null, now?: number, query = q) => handlePublicApi("GET", path.split("/"), query, key ? `Bearer ${key}` : null, "https://tp.example", now);

describe("public API (C.4)", () => {
  it("stores only the SHA-256 hash of an API key and shows the key once", () => {
    const c = createCompany();
    const k = createApiKey(c);
    expect(k.key).toMatch(/^tp_live_/);
    expect(c.apiKeys[0].hash).toBe(sha256hex(k.key));
    expect(JSON.stringify(c.apiKeys)).not.toContain(k.key);
  });

  it("requires a valid, unrevoked key", () => {
    const c = createCompany();
    const k = createApiKey(c);
    expect(get("attempts", null).status).toBe(401);
    expect(get("attempts", "tp_live_nope").status).toBe(401);
    expect(get("attempts", k.key).status).toBe(200);
    revokeApiKey(c, k.id);
    expect(get("attempts", k.key).status).toBe(401);
  });

  it("scopes data to the key's company and returns evidence summaries without identity", () => {
    const a = createCompany();
    const b = createCompany();
    delete b.attempts.att_demo_maya;
    const ka = createApiKey(a);
    const kb = createApiKey(b);
    const ra = get("attempts", ka.key).json as { data: { attemptId: string; cardUrl: string }[] };
    expect(ra.data.map((x) => x.attemptId)).toEqual(["att_demo_maya"]);
    expect(ra.data[0].cardUrl).toBe("https://tp.example/recruiter/card/att_demo_maya?challenge=ch_demo_energy");
    expect(JSON.stringify(ra)).not.toMatch(/Maya Chen|Chen|example\.com|inviteToken|transcript/);
    expect((get("attempts", kb.key).json as { count: number }).count).toBe(0);
    expect(get("attempts/att_demo_maya", ka.key).status).toBe(200);
    expect(get("cards/att_demo_maya", ka.key).status).toBe(200);
    expect(get("attempts/att_demo_maya", kb.key).status).toBe(404);
    const ch = get("challenges", ka.key).json as { data: { id: string; candidateLink: string }[] };
    expect(ch.data[0].id).toBe("ch_demo_energy");
    expect(ch.data[0].candidateLink).toMatch(/^https:\/\/tp\.example\/c\//);
    expect((get("shares", ka.key).json as { count: number }).count).toBe(1);
  });

  it("rate limits with a token bucket and recovers", () => {
    const c = createCompany();
    const k = createApiKey(c);
    const t0 = 1_000_000;
    const codes = Array.from({ length: RATE.capacity + 3 }, () => get("attempts", k.key, t0).status);
    expect(codes.filter((s) => s === 200)).toHaveLength(RATE.capacity);
    const limited = get("attempts", k.key, t0);
    expect(limited.status).toBe(429);
    expect(limited.headers?.["retry-after"]).toBe("1");
    expect(get("attempts", k.key, t0 + 2000).status).toBe(200);
  });

  it("serves an OpenAPI document generated from the Zod schemas, without auth", () => {
    const r = get("openapi.json", null);
    expect(r.status).toBe(200);
    const spec = openApiSpec();
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths)).toEqual(["/challenges", "/attempts", "/attempts/{id}", "/cards/{id}", "/shares"]);
    const attempt = spec.components.schemas.Attempt as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(attempt.properties)).toEqual(expect.arrayContaining(["attemptId", "levels", "finalScore", "summary", "cardUrl"]));
    expect(JSON.stringify(spec.components.schemas.AttemptList)).toContain("#/components/schemas/Attempt");
  });
});
