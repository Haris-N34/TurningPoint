// Resume redaction (PRD v2 C4, C.5). Runs BEFORE any analysis or model call.
// Strips identity and prestige: names, contact, photo references, addresses, graduation years.
// Schools become "University"; companies become "Company A", "Company B" in order of first appearance.

export type Redaction = { kind: "name" | "email" | "link" | "phone" | "photo" | "address" | "postal" | "year" | "school" | "company"; count: number };
export type Redacted = { text: string; redactions: Redaction[]; total: number };

const HEADINGS = /^(education|experience|work experience|volunteer( experience)?|leadership|projects|skills|activities|awards)$/i;
const BULLET = /^\s*[-•*–]\s+/;
const L = "\\p{L}";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function isHeading(line: string) {
  return HEADINGS.test(line.trim());
}
export function isBullet(line: string) {
  return BULLET.test(line);
}

/** Split a role line into role and organization: "Role at Org (dates)", "Role, Org (dates)", "Role | Org | dates". */
export function splitRoleLine(line: string): { role: string; org?: string } {
  const t = line.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const m = t.match(/^(.+?)\s+at\s+(.+)$/) ?? t.match(/^(.+?)\s*[|–—]\s*([^|–—]+)/) ?? t.match(/^(.+?),\s*(.+)$/);
  return m ? { role: m[1].trim(), org: m[2].replace(/\s*[|,]\s*[^|,]*\[year\].*$/, "").trim() } : { role: t };
}

export function redactResume(raw: string, opts: { knownNames?: string[]; knownSchools?: string[] } = {}): Redacted {
  const counts = new Map<Redaction["kind"], number>();
  const sub = (text: string, re: RegExp, kind: Redaction["kind"], to: string | ((m: string) => string)) =>
    text.replace(re, (m) => {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      return typeof to === "string" ? to : to(m);
    });

  let text = raw.replace(/\r\n/g, "\n");

  // Contact first, so names inside emails and links go with them.
  text = sub(text, /[^\s|,;()<>]+@[^\s|,;()<>]+\.[a-z]{2,}/giu, "email", "[email]");
  text = sub(text, /\b(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:com|ca|org|net|io|dev|me)(?:\/[^\s|,;]*)?/gi, "link", "[link]");
  text = sub(text, /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "phone", "[phone]");

  // Photo references: the whole line goes.
  text = sub(text, /^.*\b(?:photo|headshot|picture|portrait)\b.*$|^.*\.(?:jpe?g|png|gif|webp|heic)\b.*$/gim, "photo", "[photo removed]");

  // Street addresses (whole rest of the line, city and postal code included) and stray postal codes.
  text = sub(
    text,
    /\b\d{1,6}\s+(?:[A-Z0-9][\p{L}0-9.'-]*\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Way|Lane|Ln|Crescent|Cres|Court|Ct|Place|Pl|Trail|Terrace|Close|Gate)\b\.?[^\n|]*/gu,
    "address",
    "[address]",
  );
  text = sub(text, /\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b|\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g, "postal", "[postal code]");

  // Names: the first non-empty line, plus any names supplied by the ATS. Every token, anywhere.
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.trim().length > 0);
  const names = new Set<string>();
  for (const n of opts.knownNames ?? []) n.split(/\s+/).forEach((t) => t.length > 1 && names.add(t));
  if (first >= 0 && !isHeading(lines[first]) && /^[\p{L}][\p{L}'’. -]{1,60}$/u.test(lines[first].trim())) {
    lines[first].trim().split(/\s+/).forEach((t) => t.replace(/\.$/, "").length > 1 && names.add(t.replace(/\.$/, "")));
    lines[first] = "[Name]";
    counts.set("name", (counts.get("name") ?? 0) + 1);
  }
  text = lines.join("\n");
  for (const n of names) text = sub(text, new RegExp(`(?<![${L}])${escape(n)}(?![${L}])`, "giu"), "name", "[Name]");
  text = text.replace(/(\[Name\][\s.]*){2,}/g, "[Name] ");

  // Graduation and other years.
  text = sub(text, /\b(?:19|20)\d{2}\b/g, "year", "[year]");

  // Schools become "University": any the profile or ATS named, then anything shaped like a school.
  for (const s of opts.knownSchools ?? []) if (s.trim().length > 2) text = sub(text, new RegExp(escape(s.trim()), "gi"), "school", "University");
  const W = `[A-Z][\\p{L}.'&-]*`;
  text = sub(
    text,
    new RegExp(`(?:${W}\\s+){0,4}(?:University|College|Polytechnic|Institute of Technology|Institute|School of ${W})(?:\\s+of\\s+${W}(?:\\s+${W}){0,3})?`, "gu"),
    "school",
    "University",
  );

  // Companies: organizations on role lines, then every other mention of them.
  const orgs: string[] = [];
  let section = "";
  const out = text.split("\n").map((line) => {
    if (isHeading(line)) {
      section = line.trim().toLowerCase();
      return line;
    }
    if (!line.trim() || isBullet(line) || section === "education" || section === "skills" || line.startsWith("[")) return line;
    const { org } = splitRoleLine(line);
    if (!org || /^University$|^Company [A-Z]$/.test(org)) return line;
    if (!orgs.includes(org)) orgs.push(org);
    return line;
  });
  text = out.join("\n");
  orgs
    .map((o, i) => [o, `Company ${String.fromCharCode(65 + i)}`] as const)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([o, label]) => {
      text = sub(text, new RegExp(escape(o), "g"), "company", label);
    });

  const redactions = [...counts].map(([kind, count]) => ({ kind, count }));
  return { text, redactions, total: redactions.reduce((a, r) => a + r.count, 0) };
}
