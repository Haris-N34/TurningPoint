import type { Transcript } from "@/lib/card/types";

/** A finalised chunk of speech: its text and when it was heard, in seconds from the answer start. */
export type SpeechChunk = { text: string; startS: number; endS: number };

/**
 * Build a transcript with per-word timestamps from speech chunks. Browser speech recognition only
 * timestamps whole phrases, so word times are spread evenly across each phrase. Good enough to
 * jump a clip to the right second (E3.4).
 */
export function fromChunks(chunks: SpeechChunk[]): Transcript {
  const words: Transcript["words"] = [];
  const texts: string[] = [];
  for (const c of chunks) {
    const ws = c.text.trim().split(/\s+/).filter(Boolean);
    if (!ws.length) continue;
    texts.push(ws.join(" "));
    const span = Math.max(0.1, c.endS - c.startS);
    const step = span / ws.length;
    ws.forEach((w, i) => {
      const start = +(c.startS + i * step).toFixed(2);
      words.push({ w, start, end: +(start + step * 0.9).toFixed(2) });
    });
  }
  const text = texts.join(" ");
  return { text, words, status: text ? "ready" : "unavailable" };
}

/** Text answers: each word gets the time it was typed, so evidence can still point at a moment. */
export function fromTyping(text: string, wordTimes: number[]): Transcript {
  const ws = text.trim().split(/\s+/).filter(Boolean);
  const words = ws.map((w, i) => {
    const t = wordTimes[i] ?? wordTimes.at(-1) ?? 0;
    return { w, start: +t.toFixed(2), end: +(t + 0.3).toFixed(2) };
  });
  return { text: ws.join(" "), words, status: "ready" };
}

/** Second at which a verbatim quote starts and ends in a transcript, if it is there. */
export function locateQuote(t: Transcript, quote: string): { startS: number; endS: number } | undefined {
  const i = t.text.indexOf(quote);
  if (i < 0 || !t.words.length) return undefined;
  const before = t.text.slice(0, i).split(/\s+/).filter(Boolean).length;
  const n = quote.trim().split(/\s+/).length;
  const first = t.words[before];
  const last = t.words[Math.min(before + n - 1, t.words.length - 1)];
  if (!first || !last) return undefined;
  return { startS: first.start, endS: last.end };
}
