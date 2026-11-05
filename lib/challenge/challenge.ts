import { z } from "zod";
import { hashSeed } from "@/lib/engine/seed";
import { parseScenario, type Scenario } from "@/lib/engine/schema";
import { SKILL_SLUGS, type SkillSlug } from "@/lib/engine/skills";
import type { Store } from "@/lib/store/store";

// Employer challenges (E1). A challenge is a tailored copy of a template plus the employer's 3 or 4 skills.

export const ChallengeSchema = z.object({
  id: z.string(),
  company: z.object({ name: z.string().min(1), logoUrl: z.string().optional(), colour: z.string().default("#c2410c") }),
  title: z.string().min(1),
  templateId: z.string(),
  industry: z.string(),
  targetSkills: z.array(z.enum(SKILL_SLUGS)).min(3).max(4),
  scenario: z.unknown(),
  status: z.enum(["draft", "published"]),
  publicSlug: z.string().optional(),
  jobCode: z.string().optional(),
  anonymousReview: z.boolean().default(true),
  transcriptFirst: z.boolean().default(false),
  /** Employer competency names mapped onto the framework by the Value Mapper (B.5); the admin decided each. */
  customSkills: z
    .array(z.object({ term: z.string(), skill: z.enum(SKILL_SLUGS).nullable(), confidence: z.number().min(0).max(1), status: z.enum(["accepted", "changed", "rejected"]) }))
    .default([]),
  createdAt: z.string(),
  publishedAt: z.string().optional(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

const KEY = "challenges";
const list = (s: Store): Challenge[] => s.getJSON(KEY, z.array(ChallengeSchema)) ?? [];
const save = (s: Store, all: Challenge[]) => s.setJSON(KEY, all);

export const listChallenges = list;
export const getChallenge = (s: Store, id: string) => list(s).find((c) => c.id === id);
export const getChallengeBySlug = (s: Store, slug: string) => list(s).find((c) => c.publicSlug === slug && c.status === "published");
export const challengeScenario = (c: Challenge): Scenario => parseScenario(c.scenario);

export function slugify(text: string) {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (s.length <= 40) return s;
  // Cut at a word boundary so links read cleanly.
  const cut = s.slice(0, 41);
  return cut.slice(0, cut.lastIndexOf("-") > 0 ? cut.lastIndexOf("-") : 40);
}

const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function code(seed: string, n: number) {
  let h = hashSeed(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += CODE[h % CODE.length];
    h = hashSeed(out + seed + i);
  }
  return out;
}

export function saveDraft(
  s: Store,
  d: Pick<Challenge, "company" | "title" | "templateId" | "industry" | "targetSkills"> & { scenario: Scenario; id?: string; customSkills?: Challenge["customSkills"] },
  now = new Date(),
): Challenge {
  if (d.targetSkills.length < 3 || d.targetSkills.length > 4) throw new Error("Pick 3 or 4 skills");
  parseScenario(d.scenario);
  const id = d.id ?? `ch_${code(`${d.company.name}|${d.title}|${now.toISOString()}`, 8).toLowerCase()}`;
  const prev = getChallenge(s, id);
  const c = ChallengeSchema.parse({ ...prev, ...d, id, status: prev?.status ?? "draft", createdAt: prev?.createdAt ?? now.toISOString() });
  save(s, [...list(s).filter((x) => x.id !== id), c]);
  return c;
}

/** Publish (E1.6): validates the scenario, then gives the challenge a public link slug and a job code. */
export function publish(s: Store, id: string, now = new Date()): Challenge {
  const c = getChallenge(s, id);
  if (!c) throw new Error("No such challenge");
  parseScenario(c.scenario);
  const publicSlug = c.publicSlug ?? `${slugify(`${c.company.name} ${c.title}`)}-${code(id, 4).toLowerCase()}`;
  const jobCode = c.jobCode ?? `TP-${code(id + "job", 5)}`;
  const out = { ...c, status: "published" as const, publicSlug, jobCode, publishedAt: c.publishedAt ?? now.toISOString() };
  save(s, [...list(s).filter((x) => x.id !== id), out]);
  return out;
}

/** Fair-review settings (E6): anonymous first review is on by default; transcript-first is optional. */
export function updateSettings(s: Store, id: string, settings: Partial<Pick<Challenge, "anonymousReview" | "transcriptFirst">>) {
  const c = getChallenge(s, id);
  if (!c) throw new Error("No such challenge");
  const out = { ...c, ...settings };
  save(s, list(s).map((x) => (x.id === id ? out : x)));
  return out;
}

export const challengeUrl = (origin: string, c: Pick<Challenge, "publicSlug">) => `${origin.replace(/\/$/, "")}/c/${c.publicSlug}`;

/** QR code for the public link, as a data URL (E1.6). */
export async function qrDataUrl(url: string): Promise<string> {
  const QR = await import("qrcode");
  return QR.toDataURL(url, { margin: 1, width: 240 });
}

/** Other published challenges this card can be reused for: they share at least one target skill (C7.3). */
export function reusableFor(s: Store, card: { targetSkills: string[]; challenge: { id: string } }, alreadyShared: string[] = []) {
  return list(s)
    .filter((c) => c.status === "published" && c.id !== card.challenge.id && !alreadyShared.includes(c.id))
    .map((c) => ({ challenge: c, overlap: c.targetSkills.filter((k) => card.targetSkills.includes(k)) as SkillSlug[] }))
    .filter((x) => x.overlap.length > 0)
    .sort((a, b) => b.overlap.length - a.overlap.length);
}
