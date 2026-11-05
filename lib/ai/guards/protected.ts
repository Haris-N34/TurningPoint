// Protected-attribute filter (PRD v2 B3). AI output that talks about a protected trait is rejected, and the
// Copilot refuses questions about one. Pronouns are not traits, so "Where did she show prioritization?" is fine.

export const PROTECTED = {
  age: /\b(?:age|aged|ages|how old|years old|too young|too old|elderly|boomer|millennial|gen ?z|date of birth|birth ?year|retire\w*)\b/i,
  gender: /\b(?:gender|sex|male|female|man|woman|men|women|non-?binary|transgender|maternity|paternity|sexual orientation|gay|lesbian)\b/i,
  race: /\b(?:race|racial|skin colou?r|white|black|asian|hispanic|latin[oax]|caucasian|arab)\b/i,
  ethnicity: /\b(?:ethnic\w*|indigenous|heritage|tribe|tribal)\b/i,
  disability: /\b(?:disab\w*|handicap\w*|impair\w*|wheelchair|autis\w*|adhd|dyslexi\w*|mental (?:health|illness)|illness|diagnos\w*|neurodiverg\w*)\b/i,
  accent: /\b(?:accent\w*|native speaker|non-?native|mother tongue|first language|pronunciation|dialect)\b/i,
  religion: /\b(?:religio\w*|church|mosque|temple|synagogue|muslim|christian|jewish|hindu|sikh|buddhist|atheist|hijab|turban|pray\w*)\b/i,
  pregnancy: /\b(?:pregnan\w*|expecting a baby|baby on the way|family plans|have kids|has kids|childcare)\b/i,
  // Family and marital status are protected grounds in Canadian human-rights law (QA night).
  familyStatus: /\b(?:married|marriage|marital|spouse|husband|wife|divorced|widowed|single (?:mom|mother|dad|father|parent)|family status)\b/i,
  nationality: /\b(?:nationality|citizenship|citizen|immigra\w*|visa|where (?:is|are) (?:he|she|they) from|foreign\w*|country of origin)\b/i,
} as const;

export type ProtectedTrait = keyof typeof PROTECTED;

/** Traits mentioned in the text, ignoring anything inside quotation marks (quotes are the candidate's own words). */
export function protectedMentions(text: string): ProtectedTrait[] {
  const unquoted = text.replace(/“[^”]*”|"[^"]*"/g, " ");
  return (Object.keys(PROTECTED) as ProtectedTrait[]).filter((k) => PROTECTED[k].test(unquoted));
}

/** Reject reason for an output that mentions a protected trait, or undefined when clean. */
export function protectedCheck(...texts: string[]): string | undefined {
  const hits = [...new Set(texts.flatMap(protectedMentions))];
  return hits.length ? `mentions protected trait: ${hits.join(", ")}` : undefined;
}
