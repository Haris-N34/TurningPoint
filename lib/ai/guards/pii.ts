import { redactName } from "../questions";

// Blind inputs (PRD v2 B3, G2): strip identity before any AI job sees text. Names, emails, phone numbers,
// street addresses, postcodes and schools become placeholders. Prestige (which school) never reaches a model.

export type Known = { name?: string; email?: string; university?: string };

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const STREET = /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Crescent|Cres|Trail|Tr|Place|Pl)\b\.?(?:\s+(?:NW|NE|SW|SE))?/g;
const POSTCODE = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/g;
const ZIP = /\b\d{5}(?:-\d{4})\b/g;
const SCHOOL_NAMED = /\b(?:University of (?:the )?[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)*|(?:[A-Z][\w'-]*\s+){1,3}(?:University|College|Polytechnic|Institute of Technology))\b/g;
export const SCHOOL_SHORT = /\b(?:U\s?of\s?[A-Z]|UCalgary|UBC|UofT|UAlberta|McGill|Queen'?s|Waterloo|Western|SAIT|NAIT|MRU|MIT|Stanford|Harvard|Yale|Princeton|Oxford|Cambridge|Haskayne|Rotman|Ivey|Sauder)\b/g;

export function stripPii(text: string, known: Known = {}): string {
  let out = text;
  if (known.email) out = out.split(known.email).join("[email]");
  out = out.replace(EMAIL, "[email]");
  out = out.replace(STREET, "[address]").replace(POSTCODE, "[postcode]").replace(ZIP, "[postcode]");
  out = out.replace(PHONE, "[phone]");
  if (known.university?.trim()) out = out.split(known.university.trim()).join("[university]");
  out = out.replace(SCHOOL_NAMED, "[university]").replace(SCHOOL_SHORT, "[university]");
  if (known.name?.trim()) out = redactName(out, known.name);
  return out;
}

/** True if text still holds something stripPii would remove. */
export const hasPii = (text: string, known: Known = {}) => stripPii(text, known) !== text;
