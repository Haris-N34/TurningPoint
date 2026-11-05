import { z } from "zod";
import { SKILL_SLUGS } from "@/lib/engine/skills";
import { SCORING_CONFIG } from "@/lib/scoring/config";
import { sha256hex, randomToken } from "./crypto";
import { listCompanies, nextId, nowIso, type Company } from "./store";
import { AttemptSummarySchema, type AttemptSummary } from "./summary";

// Public REST API /api/v1 (PRD v2 C2, C.4). Per-company API keys stored as SHA-256 hashes only,
// token-bucket rate limiting, OpenAPI generated from these Zod schemas and served at /developers.
// The API exposes evidence summaries, never names, emails, transcripts or media.

export const RATE = { capacity: 30, perSecond: 1 };

export const PublicAttempt = AttemptSummarySchema.omit({ inviteToken: true, cardPath: true })
  .extend({ cardUrl: z.string().describe("Link to the evidence-first Capability Card") })
  .describe("A finished attempt: per-skill levels, Final score with breakdown (sorts only), short summary, card link.");
export const PublicChallenge = z
  .object({
    id: z.string(),
    title: z.string(),
    targetSkills: z.array(z.enum(SKILL_SLUGS)),
    candidateLink: z.string(),
    jobs: z.array(z.object({ provider: z.string(), jobId: z.string() })),
  });
export const PublicShare = z.object({ attemptId: z.string(), challengeId: z.string(), sharedAt: z.string() });
export const ApiErrorSchema = z.object({ error: z.string() });
const list = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), count: z.number() });
export const AttemptList = list(PublicAttempt);
export const ChallengeList = list(PublicChallenge);
export const ShareList = list(PublicShare);

// One registry so list schemas reference their item schemas by $ref.
const registry = z.registry<{ id: string }>();
registry.add(PublicAttempt, { id: "Attempt" });
registry.add(AttemptList, { id: "AttemptList" });
registry.add(PublicChallenge, { id: "Challenge" });
registry.add(ChallengeList, { id: "ChallengeList" });
registry.add(PublicShare, { id: "Share" });
registry.add(ShareList, { id: "ShareList" });
registry.add(ApiErrorSchema, { id: "Error" });

export function createApiKey(c: Company, label?: string) {
  const key = randomToken("tp_live", 24);
  const k = { id: nextId("key"), prefix: key.slice(0, 14), hash: sha256hex(key), createdAt: nowIso(), ...(label ? { label } : {}) };
  c.apiKeys.push(k);
  // The plaintext key is returned once and never stored.
  return { id: k.id, prefix: k.prefix, key, createdAt: k.createdAt };
}

export function revokeApiKey(c: Company, id: string) {
  const k = c.apiKeys.find((x) => x.id === id);
  if (k && !k.revokedAt) k.revokedAt = nowIso();
  return k ? { id: k.id, revokedAt: k.revokedAt } : null;
}

export function authenticate(header: string | null): { company: Company; keyId: string } | undefined {
  const key = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key) return undefined;
  const hash = sha256hex(key);
  for (const c of listCompanies()) {
    const k = c.apiKeys.find((x) => x.hash === hash && !x.revokedAt);
    if (k) return { company: c, keyId: k.id };
  }
  return undefined;
}

/** Token bucket per API key. */
export function takeToken(c: Company, keyId: string, now = Date.now(), rate = RATE) {
  const b = (c.rate[keyId] ??= { tokens: rate.capacity, at: now });
  b.tokens = Math.min(rate.capacity, b.tokens + ((now - b.at) / 1000) * rate.perSecond);
  b.at = now;
  if (b.tokens < 1) return { ok: false, remaining: 0, retryAfter: Math.ceil((1 - b.tokens) / rate.perSecond) };
  b.tokens -= 1;
  return { ok: true, remaining: Math.floor(b.tokens), retryAfter: 0 };
}

const toPublic = (a: AttemptSummary, origin: string) => {
  const { inviteToken: _i, cardPath, ...rest } = AttemptSummarySchema.parse(a);
  void _i;
  return PublicAttempt.parse({ ...rest, cardUrl: `${origin}${cardPath}` });
};

export type ApiOut = { status: number; json: unknown; headers?: Record<string, string> };

export function handlePublicApi(method: string, path: string[], query: URLSearchParams, authz: string | null, origin: string, now = Date.now()): ApiOut {
  const p = path.join("/");
  if (method === "GET" && p === "openapi.json") return { status: 200, json: openApiSpec() };
  const auth = authenticate(authz);
  if (!auth) return { status: 401, json: { error: "Missing or invalid API key" }, headers: { "www-authenticate": "Bearer" } };
  const c = auth.company;
  const t = takeToken(c, auth.keyId, now);
  const headers: Record<string, string> = { "x-ratelimit-limit": String(RATE.capacity), "x-ratelimit-remaining": String(t.remaining) };
  if (!t.ok) return { status: 429, json: { error: "Rate limit exceeded" }, headers: { ...headers, "retry-after": String(t.retryAfter) } };
  if (method !== "GET") return { status: 405, json: { error: "Read-only API" }, headers };

  const attempts = Object.values(c.attempts).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  if (p === "challenges") {
    const map = new Map<string, z.infer<typeof PublicChallenge>>();
    for (const conn of Object.values(c.connections))
      for (const m of conn?.mappings ?? []) {
        const prev = map.get(m.challengeId) ?? { id: m.challengeId, title: m.title, targetSkills: m.targetSkills, candidateLink: `${origin}/c/${m.slug}`, jobs: [] };
        prev.jobs.push({ provider: conn!.provider, jobId: m.jobId });
        map.set(m.challengeId, prev);
      }
    const data = [...map.values()];
    return { status: 200, json: { data, count: data.length }, headers };
  }
  if (p === "attempts") {
    const ch = query.get("challenge");
    // Sorting by Final score is allowed; filtering by it is not (D.2). Nobody is dropped.
    const sorted = query.get("sort") === "final" ? [...attempts].sort((a, b) => b.finalScore.value - a.finalScore.value) : attempts;
    const data = sorted.filter((a) => !ch || a.challengeId === ch).map((a) => toPublic(a, origin));
    return { status: 200, json: { data, count: data.length }, headers };
  }
  if ((path[0] === "attempts" || path[0] === "cards") && path[1] && path.length === 2) {
    const a = c.attempts[path[1]];
    return a ? { status: 200, json: toPublic(a, origin), headers } : { status: 404, json: { error: "Not found" }, headers };
  }
  if (p === "shares") {
    const data = attempts.map((a) => ({ attemptId: a.attemptId, challengeId: a.challengeId, sharedAt: a.reportedAt }));
    return { status: 200, json: { data, count: data.length }, headers };
  }
  return { status: 404, json: { error: `No route ${p}` }, headers };
}

function componentSchemas() {
  const out = z.toJSONSchema(registry, { uri: (id) => `#/components/schemas/${id}`, unrepresentable: "any" }).schemas;
  for (const s of Object.values(out)) {
    delete (s as Record<string, unknown>).$schema;
    delete (s as Record<string, unknown>).$id;
  }
  return out;
}

/** OpenAPI 3.1 document generated from the Zod schemas above. */
export function openApiSpec() {
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const json = (name: string, description: string) => ({ description, content: { "application/json": { schema: ref(name) } } });
  const errors = { "401": json("Error", "Missing or invalid API key"), "429": json("Error", "Rate limit exceeded; see Retry-After") };
  return {
    openapi: "3.1.0",
    info: {
      title: "Turning Point API",
      version: "1.0.0",
      description: `Read-only access to challenges and evidence summaries for your company. The Final score (formula ${SCORING_CONFIG.version}) sorts only; there is no filter or threshold by score. Rate limit: ${RATE.capacity} requests burst, ${RATE.perSecond} per second.`,
    },
    servers: [{ url: "/api/v1" }],
    security: [{ bearer: [] }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Per-company API key from /admin/integrations. Stored hashed; shown once." } },
      schemas: componentSchemas(),
    },
    paths: {
      "/challenges": { get: { operationId: "listChallenges", summary: "Challenges linked to your requisitions", responses: { "200": json("ChallengeList", "Challenges"), ...errors } } },
      "/attempts": {
        get: {
          operationId: "listAttempts",
          summary: "Finished attempts (evidence summaries)",
          parameters: [
            { name: "challenge", in: "query", required: false, schema: { type: "string" }, description: "Only attempts for this challenge" },
            { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["date", "final"] }, description: "Sort order. Never filters." },
          ],
          responses: { "200": json("AttemptList", "Attempts"), ...errors },
        },
      },
      "/attempts/{id}": {
        get: {
          operationId: "getAttempt",
          summary: "One attempt's summary",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": json("Attempt", "Attempt"), "404": json("Error", "Not found"), ...errors },
        },
      },
      "/cards/{id}": {
        get: {
          operationId: "getCardSummary",
          summary: "Capability Card summary with a link to the full card",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": json("Attempt", "Card summary"), "404": json("Error", "Not found"), ...errors },
        },
      },
      "/shares": { get: { operationId: "listShares", summary: "Cards shared with your company", responses: { "200": json("ShareList", "Shares"), ...errors } } },
    },
  };
}


