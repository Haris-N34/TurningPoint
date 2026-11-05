import { describe, expect, it } from "vitest";
import { makeMediaLinks, MEDIA_LINK_TTL_MS, signMediaUrl, verifyMediaUrl, newLinkSecret } from "./signed";

// PV3: recordings are served only through links that carry an HMAC token and expire after 1 hour.

const T0 = Date.parse("2026-11-05T10:00:00Z");
const SECRET = "test-only-secret-0123456789abcdef";

describe("signed media links (PV3)", () => {
  it("a fresh link verifies and gives back the key", async () => {
    const url = await signMediaUrl("att_1/cp1", SECRET, new Date(T0));
    expect(url).toMatch(/^tp-media:att_1%2Fcp1\?exp=\d+&sig=[0-9a-f]{64}$/);
    expect(await verifyMediaUrl(url, SECRET, new Date(T0 + 1000))).toEqual({ ok: true, key: "att_1/cp1", expiresAt: T0 + MEDIA_LINK_TTL_MS });
  });

  it("expires after 1 hour", async () => {
    const url = await signMediaUrl("att_1/cp1", SECRET, new Date(T0));
    expect((await verifyMediaUrl(url, SECRET, new Date(T0 + MEDIA_LINK_TTL_MS - 1))).ok).toBe(true);
    expect(await verifyMediaUrl(url, SECRET, new Date(T0 + MEDIA_LINK_TTL_MS + 1))).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects tampered links: another key, a later expiry, a changed signature, another secret", async () => {
    const url = await signMediaUrl("att_1/cp1", SECRET, new Date(T0));
    const now = new Date(T0 + 1000);
    const otherKey = url.replace("att_1%2Fcp1", "att_2%2Fcp1");
    const exp = Number(new URL(url).searchParams.get("exp"));
    const laterExp = url.replace(`exp=${exp}`, `exp=${exp + 86_400_000}`);
    const sig = new URL(url).searchParams.get("sig")!;
    const flipped = url.replace(sig, (sig[0] === "a" ? "b" : "a") + sig.slice(1));
    for (const bad of [otherKey, laterExp, flipped]) expect(await verifyMediaUrl(bad, SECRET, now)).toEqual({ ok: false, reason: "bad-signature" });
    expect(await verifyMediaUrl(url, "another-device-secret-000000000000", now)).toEqual({ ok: false, reason: "bad-signature" });
    for (const junk of ["", "att_1/cp1", "blob:http://x/1", "tp-media:att_1?exp=abc&sig=00", "tp-media:?exp=1&sig="]) {
      expect(await verifyMediaUrl(junk, SECRET, now)).toEqual({ ok: false, reason: "malformed" });
    }
  });

  it("media is only returned through a valid link", async () => {
    let t = T0;
    const blobs = new Map([["att_1/cp1", "VIDEO"]]);
    const reads: string[] = [];
    const links = makeMediaLinks({
      get: async (k: string) => (reads.push(k), blobs.get(k)),
      secret: async () => SECRET,
      now: () => new Date(t),
    });
    const url = await links.sign("att_1/cp1");
    expect(await links.open(url)).toBe("VIDEO");
    await expect(links.open(url.replace("cp1", "cp2"))).rejects.toThrow(/bad-signature/);
    t += MEDIA_LINK_TTL_MS + 1;
    await expect(links.open(url)).rejects.toThrow(/expired/);
    // IndexedDB is read only for the one valid link.
    expect(reads).toEqual(["att_1/cp1"]);
  });

  it("makes a random per-device secret, never a constant", () => {
    const a = newLinkSecret();
    const b = newLinkSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});
