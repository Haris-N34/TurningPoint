import { verifyEvidence } from "@/lib/card/verify";

// Grounding (PRD v2 B3, G1): every quote must be an exact substring of its source. The card check lives in
// lib/card/verify.ts and is reused here so there is exactly one definition of "verified".
export { verifyEvidence };

/** Exact, case-sensitive substring match. Empty quotes never pass. */
export const quoteIn = (source: string, quote: string) => quote.length > 0 && source.includes(quote);
