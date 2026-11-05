import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign, verify, type KeyObject } from "node:crypto";
import { z } from "zod";
import { SKILL_SLUGS, SKILLS } from "@/lib/engine/skills";

// Portable credential (PRD v2 C2, C.9): Open Badges 3.0 as a W3C Verifiable Credential (JSON-LD),
// secured with a Data Integrity proof, cryptosuite eddsa-jcs-2022 (Ed25519 over JCS-canonical JSON).
// The issuer key is generated at runtime, or read from TP_ISSUER_ED25519_KEY (PKCS8, base64). Never committed.

// ---- base58btc and JCS ----------------------------------------------------------------------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58btc(bytes: Uint8Array): string {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > BigInt(0)) {
    out = B58[Number(n % BigInt(58))] + out;
    n /= BigInt(58);
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}
export function unbase58btc(s: string): Uint8Array {
  let n = BigInt(0);
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("bad base58");
    n = n * BigInt(58) + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const lead = s.match(/^1*/)![0].length;
  return Uint8Array.from([...new Array(lead).fill(0), ...(n > BigInt(0) ? Buffer.from(hex, "hex") : [])]);
}
/** RFC 8785 JSON Canonicalization (enough for our documents: strings, integers, booleans, arrays, objects). */
export function jcs(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(jcs).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${jcs(o[k])}`)
    .join(",")}}`;
}
const sha256 = (s: string) => createHash("sha256").update(s).digest();

// ---- issuer key ------------------------------------------------------------------------------
type Issuer = { privateKey: KeyObject; publicRaw: Buffer; did: string; vm: string };
const g = globalThis as unknown as { __tpIssuer?: Issuer };

const didKeyFromRaw = (raw: Uint8Array) => `did:key:z${base58btc(Uint8Array.from([0xed, 0x01, ...raw]))}`;
function rawFromDidKey(did: string): Buffer {
  const m = did.match(/^did:key:z([1-9A-HJ-NP-Za-km-z]+)/);
  if (!m) throw new Error("Unsupported verification method");
  const bytes = unbase58btc(m[1]);
  if (bytes[0] !== 0xed || bytes[1] !== 0x01 || bytes.length !== 34) throw new Error("Not an Ed25519 did:key");
  return Buffer.from(bytes.slice(2));
}

export function issuer(): Issuer {
  if (g.__tpIssuer) return g.__tpIssuer;
  const env = process.env.TP_ISSUER_ED25519_KEY;
  const privateKey = env ? createPrivateKey({ key: Buffer.from(env, "base64"), format: "der", type: "pkcs8" }) : generateKeyPairSync("ed25519").privateKey;
  const x = createPublicKey(privateKey).export({ format: "jwk" }).x!;
  const publicRaw = Buffer.from(x, "base64url");
  const did = didKeyFromRaw(publicRaw);
  return (g.__tpIssuer = { privateKey, publicRaw, did, vm: `${did}#${did.slice("did:key:".length)}` });
}

// ---- issue and verify ------------------------------------------------------------------------
export const BadgeRequest = z.object({
  attemptId: z.string().min(1).max(80),
  challengeTitle: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  finishedAt: z.string(),
  skills: z.array(z.object({ skill: z.enum(SKILL_SLUGS), level: z.enum(["strong", "some"]) })).max(12),
  /** Only if the candidate chooses to put their name on it. */
  name: z.string().max(120).optional(),
});
export type BadgeRequest = z.infer<typeof BadgeRequest>;

const CONTEXT = ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"];
const skillName = (s: string) => SKILLS.find((x) => x.slug === s)?.name ?? s;
const LEVEL = { strong: "Strong", some: "Some" } as const;

function proofHash(doc: Record<string, unknown>, proofConfig: Record<string, unknown>) {
  return Buffer.concat([sha256(jcs(proofConfig)), sha256(jcs(doc))]);
}

export function issueBadge(req: BadgeRequest, origin: string, now = new Date()) {
  const r = BadgeRequest.parse(req);
  const iss = issuer();
  const base = origin.replace(/\/$/, "");
  const doc: Record<string, unknown> = {
    "@context": CONTEXT,
    id: `urn:uuid:${randomUUID()}`,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    issuer: { id: iss.did, type: ["Profile"], name: "Turning Point", url: base },
    validFrom: now.toISOString(),
    name: `Capability Card: ${r.challengeTitle}`,
    credentialSubject: {
      type: ["AchievementSubject"],
      ...(r.name ? { name: r.name } : {}),
      achievement: {
        id: `${base}/how-scores-work#capability-card`,
        type: ["Achievement"],
        achievementType: "Assessment",
        name: `Turning Point challenge: ${r.challengeTitle}`,
        description: `Evidence-based skill levels from a story challenge for ${r.company}, taken ${r.finishedAt.slice(0, 10)}. Levels come from the candidate's own words and choices.`,
        criteria: { narrative: "Strong or Some evidence in the candidate's own words and choices, each linked to a moment in the challenge. Not observed skills are not listed." },
        resultDescription: r.skills.map((s) => ({ id: `urn:tp:skill:${s.skill}`, type: ["ResultDescription"], name: skillName(s.skill), resultType: "RubricCriterionLevel", allowedValue: ["Some", "Strong"] })),
      },
      result: r.skills.map((s) => ({ type: ["Result"], resultDescription: `urn:tp:skill:${s.skill}`, value: LEVEL[s.level] })),
    },
    evidence: [{ id: `${base}/results/${r.attemptId}`, type: ["Evidence"], name: "Capability Card (shared by the candidate)" }],
  };
  const proofConfig = { "@context": CONTEXT, type: "DataIntegrityProof", cryptosuite: "eddsa-jcs-2022", created: now.toISOString(), verificationMethod: iss.vm, proofPurpose: "assertionMethod" };
  const sig = sign(null, proofHash(doc, proofConfig), iss.privateKey);
  const { "@context": _c, ...proof } = proofConfig;
  void _c;
  return { ...doc, proof: { ...proof, proofValue: `z${base58btc(sig)}` } };
}

export type VerifyResult =
  | { valid: true; issuerKnown: boolean; issuer: string; name: string; skills: { skill: string; level: string }[]; validFrom: string }
  | { valid: false; reason: string };

export function verifyBadge(input: unknown): VerifyResult {
  try {
    if (!input || typeof input !== "object") return { valid: false, reason: "Not a credential" };
    const { proof, ...doc } = input as Record<string, unknown> & { proof?: Record<string, unknown> };
    if (!proof || proof.type !== "DataIntegrityProof" || proof.cryptosuite !== "eddsa-jcs-2022") return { valid: false, reason: "Missing or unsupported proof" };
    const types = doc.type as string[] | undefined;
    if (!types?.includes("OpenBadgeCredential")) return { valid: false, reason: "Not an Open Badges 3.0 credential" };
    const vm = String(proof.verificationMethod ?? "");
    const did = vm.split("#")[0];
    if ((doc.issuer as { id?: string })?.id !== did) return { valid: false, reason: "Proof key does not belong to the issuer" };
    const { proofValue, ...rest } = proof;
    if (typeof proofValue !== "string" || !proofValue.startsWith("z")) return { valid: false, reason: "Malformed proof value" };
    const proofConfig = { "@context": doc["@context"], ...rest };
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: rawFromDidKey(did).toString("base64url") }, format: "jwk" });
    const ok = verify(null, proofHash(doc, proofConfig), key, Buffer.from(unbase58btc(proofValue.slice(1))));
    if (!ok) return { valid: false, reason: "Signature does not match: the credential was changed after it was issued" };
    // A consistent signature only proves the signer holds that key. Anyone can make a key and sign their own
    // levels, so the key must be Turning Point's. Set TP_ISSUER_ED25519_KEY in production so it survives restarts.
    if (did !== issuer().did) return { valid: false, reason: "Signed by a key that is not Turning Point's issuer key" };
    const subject = doc.credentialSubject as { result?: { resultDescription: string; value: string }[] };
    return {
      valid: true,
      issuerKnown: true,
      issuer: did,
      name: String(doc.name ?? ""),
      skills: (subject.result ?? []).map((x) => ({ skill: skillName(x.resultDescription.replace("urn:tp:skill:", "")), level: x.value })),
      validFrom: String(doc.validFrom ?? ""),
    };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : "Could not verify" };
  }
}
