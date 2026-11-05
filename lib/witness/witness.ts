import { z } from "zod";
import { hashSeed } from "@/lib/engine/seed";
import { SKILL_SLUGS } from "@/lib/engine/skills";
import type { Store } from "@/lib/store/store";

// Witness confirmations (C6). Demo scope: the one-time link is shown to the candidate to send,
// not emailed. Only a hash of the witness email is kept, and the card never shows it (C6.4).

export const RELATIONSHIPS = ["supervisor", "peer", "community_partner", "instructor", "other"] as const;
export const WITNESS_TTL_DAYS = 14;
export const MAX_WITNESSES = 2;

export const WitnessRecordSchema = z.object({
  id: z.string(),
  attemptId: z.string(),
  storyTitle: z.string(),
  relationship: z.enum(RELATIONSHIPS),
  emailHash: z.string(),
  token: z.string(),
  status: z.enum(["pending", "confirmed", "declined", "expired"]),
  skillsSeen: z.array(z.enum(SKILL_SLUGS)).max(3).default([]),
  sentence: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
  confirmedAt: z.string().optional(),
});
export type WitnessRecord = z.infer<typeof WitnessRecordSchema>;

const PUBLIC_DOMAINS = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "live.com", "proton.me", "protonmail.com", "shaw.ca", "telus.net"]);
const DOMAIN_ALIASES: Record<string, string> = { "googlemail.com": "gmail.com", "hotmail.ca": "hotmail.com", "outlook.ca": "outlook.com", "live.ca": "live.com", "pm.me": "proton.me", "protonmail.com": "proton.me" };

/** Normalise an email to the mailbox it really reaches: lowercase, no +tags, gmail dots, domain aliases, school subdomains. */
export function mailbox(email: string): { local: string; domain: string } | undefined {
  const m = email.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+\.[a-z]{2,})$/);
  if (!m) return undefined;
  let [, local, domain] = m;
  domain = DOMAIN_ALIASES[domain] ?? domain;
  local = local.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  // cpsc.ucalgary.ca and ucalgary.ca are the same organisation.
  if (!PUBLIC_DOMAINS.has(domain)) domain = domain.split(".").slice(-2).join(".");
  return { local, domain };
}

/** C6.5: a witness can't be the candidate under another spelling of the same address. */
export function isSelfWitness(candidateEmail: string, witnessEmail: string): boolean {
  const a = mailbox(candidateEmail);
  const b = mailbox(witnessEmail);
  if (!a || !b) return false;
  if (a.local === b.local && a.domain === b.domain) return true;
  // Same local part at the same school or employer is the same person with a different alias.
  return a.domain === b.domain && !PUBLIC_DOMAINS.has(a.domain) && (a.local.startsWith(b.local) || b.local.startsWith(a.local));
}

const KEY = "witnesses";
const all = (s: Store) => s.getJSON(KEY, z.array(WitnessRecordSchema)) ?? [];
const put = (s: Store, list: WitnessRecord[]) => s.setJSON(KEY, list);

function token(seed: string) {
  let h = hashSeed(seed);
  let out = "";
  for (let i = 0; i < 24; i++) {
    out += "abcdefghijkmnpqrstuvwxyz23456789"[h % 32];
    h = hashSeed(out + seed);
  }
  return out;
}

const randomSeed = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()) + Date.now();

export function addWitness(
  s: Store,
  w: { attemptId: string; storyTitle: string; email: string; relationship: WitnessRecord["relationship"]; candidateEmail: string },
  now = new Date(),
  seed = randomSeed(),
): { record: WitnessRecord; link: string } {
  if (!mailbox(w.email)) throw new Error("Enter a valid email address");
  if (isSelfWitness(w.candidateEmail, w.email)) throw new Error("A witness has to be someone else, not your own email");
  const existing = all(s).filter((x) => x.attemptId === w.attemptId);
  if (existing.length >= MAX_WITNESSES) throw new Error(`Up to ${MAX_WITNESSES} witnesses`);
  const mb = mailbox(w.email)!;
  const emailHash = hashSeed(`${mb.local}@${mb.domain}`).toString(16);
  // One person, one slot: two confirmations from the same mailbox would read as two witnesses.
  if (existing.some((x) => x.emailHash === emailHash)) throw new Error("You already added this witness");
  const record: WitnessRecord = {
    id: `w_${token(seed + "id").slice(0, 8)}`,
    attemptId: w.attemptId,
    storyTitle: w.storyTitle,
    relationship: w.relationship,
    emailHash,
    token: token(seed),
    status: "pending",
    skillsSeen: [],
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + WITNESS_TTL_DAYS * 86_400_000).toISOString(),
  };
  put(s, [...all(s), record]);
  return { record, link: `/witness/${record.token}` };
}

export function witnessByToken(s: Store, t: string, now = new Date()): WitnessRecord | undefined {
  const w = all(s).find((x) => x.token === t);
  if (!w) return undefined;
  if (w.status === "pending" && Date.parse(w.expiresAt) < now.getTime()) return { ...w, status: "expired" };
  return w;
}

export const witnessesFor = (s: Store, attemptId: string) => all(s).filter((w) => w.attemptId === attemptId);

/** One tap from the witness (Flow C). The link works once; the card gets relationship, skills and sentence only. */
export function respond(
  s: Store,
  t: string,
  r: { confirmed: boolean; skillsSeen?: string[]; sentence?: string },
  now = new Date(),
): WitnessRecord {
  const w = witnessByToken(s, t, now);
  if (!w) throw new Error("This link is not valid");
  if (w.status === "expired") throw new Error("This link has expired");
  if (w.status !== "pending") throw new Error("This link has already been used");
  const skills = (r.skillsSeen ?? []).slice(0, 3);
  const updated = WitnessRecordSchema.parse({
    ...w,
    status: r.confirmed ? "confirmed" : "declined",
    skillsSeen: r.confirmed ? skills : [],
    sentence: r.confirmed ? r.sentence?.trim().slice(0, 200) || undefined : undefined,
    confirmedAt: now.toISOString(),
  });
  put(s, all(s).map((x) => (x.id === w.id ? updated : x)));

  const card = s.getCard(w.attemptId);
  if (card?.realStory) {
    const witnesses = [
      ...card.realStory.witnesses.filter((x) => x.id !== w.id),
      { id: w.id, relationship: w.relationship, status: updated.status, skillsSeen: updated.skillsSeen, sentence: updated.sentence, confirmedAt: updated.confirmedAt },
    ];
    s.saveCard({ ...card, realStory: { ...card.realStory, witnesses } });
  }
  return updated;
}

/** "Confirmed by 1 supervisor, 1 peer" (C6.4). */
export function confirmationLine(ws: { relationship: string; status: string }[]): string | undefined {
  const counts = new Map<string, number>();
  for (const w of ws) if (w.status === "confirmed") counts.set(w.relationship, (counts.get(w.relationship) ?? 0) + 1);
  if (!counts.size) return undefined;
  const label = (r: string) => r.replace("_", " ");
  return "Confirmed by " + [...counts].map(([r, n]) => `${n} ${label(r)}${n > 1 ? "s" : ""}`).join(", ");
}
