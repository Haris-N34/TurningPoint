// Signed playback links for recordings (PV3). The PRD serves recordings by signed URLs that expire in
// 1 hour. In the local demo the recordings sit in IndexedDB, so a playback link is
// `tp-media:<key>?exp=<ms>&sig=<HMAC-SHA256(key, exp)>`, checked before any recording is read.
// The HMAC secret is random per browser session (never in code).

export const MEDIA_LINK_TTL_MS = 60 * 60 * 1000;
const SCHEME = "tp-media:";
const LINK = /^tp-media:([^?&]+)\?exp=(\d+)&sig=([0-9a-f]{64})$/;

export type LinkCheck = { ok: true; key: string; expiresAt: number } | { ok: false; reason: "malformed" | "expired" | "bad-signature" };

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** 32 random bytes as hex. One per browser session, see sessionSecret. */
export function newLinkSecret(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return hex(b.buffer);
}

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

/** Constant-time comparison, so a wrong signature takes as long to reject as a nearly right one. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signMediaUrl(key: string, secret: string, now: Date, ttlMs = MEDIA_LINK_TTL_MS): Promise<string> {
  const exp = now.getTime() + ttlMs;
  return `${SCHEME}${encodeURIComponent(key)}?exp=${exp}&sig=${await hmac(secret, `${key}\n${exp}`)}`;
}

export async function verifyMediaUrl(url: string, secret: string, now: Date): Promise<LinkCheck> {
  const m = LINK.exec(url);
  if (!m) return { ok: false, reason: "malformed" };
  let key: string;
  try {
    key = decodeURIComponent(m[1]);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const exp = Number(m[2]);
  // Check the signature first: a forged expiry must never read as merely "expired".
  if (!same(await hmac(secret, `${key}\n${exp}`), m[3])) return { ok: false, reason: "bad-signature" };
  if (now.getTime() > exp) return { ok: false, reason: "expired" };
  return { ok: true, key, expiresAt: exp };
}

export class MediaLinkError extends Error {
  constructor(readonly reason: Exclude<LinkCheck, { ok: true }>["reason"]) {
    super(`media link rejected: ${reason}`);
  }
}

/** Sign and open links over any blob getter (IndexedDB in the app, a map in tests). */
export function makeMediaLinks<B>(deps: { get: (key: string) => Promise<B | undefined>; secret: () => Promise<string>; now?: () => Date; ttlMs?: number }) {
  const now = deps.now ?? (() => new Date());
  return {
    sign: async (key: string) => signMediaUrl(key, await deps.secret(), now(), deps.ttlMs),
    /** The recording behind a link. Throws MediaLinkError for an expired or tampered link. */
    async open(url: string): Promise<B | undefined> {
      const r = await verifyMediaUrl(url, await deps.secret(), now());
      if (!r.ok) throw new MediaLinkError(r.reason);
      return deps.get(r.key);
    },
  };
}
