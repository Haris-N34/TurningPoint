import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Small crypto helpers for the integration layer (PRD v2 C2). Server only. Secrets are generated at
// runtime and never committed.

export const randomToken = (prefix: string, bytes = 24) => `${prefix}_${randomBytes(bytes).toString("base64url")}`;
export const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");

/** Signature header: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. */
export function signWebhook(secret: string, rawBody: string, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export const WEBHOOK_TOLERANCE_S = 5 * 60;

export type SigCheck = { ok: true } | { ok: false; reason: "missing_signature" | "malformed_signature" | "stale_timestamp" | "bad_signature" };

export function verifyWebhook(secret: string, header: string | null, rawBody: string, nowS = Math.floor(Date.now() / 1000)): SigCheck {
  if (!header) return { ok: false, reason: "missing_signature" };
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || !/^[0-9a-f]{64}$/.test(parts.v1)) return { ok: false, reason: "malformed_signature" };
  if (Math.abs(nowS - t) > WEBHOOK_TOLERANCE_S) return { ok: false, reason: "stale_timestamp" };
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"), "hex");
  const got = Buffer.from(parts.v1, "hex");
  return expected.length === got.length && timingSafeEqual(expected, got) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** Mask an email for logs and the console: m***@example.com. */
export const maskEmail = (e: string) => e.replace(/^(.)[^@]*(@.*)$/, "$1***$2");
