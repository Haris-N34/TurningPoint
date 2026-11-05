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

/**
 * The candidate fixed what speech to text heard, before submitting. Words that still match keep
 * their times (so clips still jump to the right second); new words take times between their
 * neighbours. With no timed words to anchor on, words spread evenly across the recording.
 */
export function applyCorrection(t: Transcript, edited: string, durationS: number): Transcript {
  const ws = edited.trim().split(/\s+/).filter(Boolean);
  const text = ws.join(" ");
  if (text === t.text) return t;
  if (!ws.length) return { text: "", words: [], status: "unavailable" };
  const old = t.words;
  if (!old.length) {
    const span = Math.max(0.1, durationS);
    const step = span / ws.length;
    return { text, words: ws.map((w, i) => ({ w, start: +(i * step).toFixed(2), end: +((i + 0.9) * step).toFixed(2) })), status: "ready" };
  }
  // Longest common subsequence of words (case-insensitive) to keep matched timings.
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
  const a = old.map((x) => norm(x.w));
  const b = ws.map(norm);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] && a[i] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const match: (number | undefined)[] = new Array(b.length);
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j] && a[i]) {
      match[j] = i;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const end = Math.max(durationS, old.at(-1)!.end);
  const words: Transcript["words"] = [];
  for (let j = 0; j < ws.length; ) {
    const m = match[j];
    if (m !== undefined) {
      words.push({ w: ws[j], start: old[m].start, end: old[m].end });
      j++;
      continue;
    }
    // A run of new words: spread them between the previous and next matched word.
    let k = j;
    while (k < ws.length && match[k] === undefined) k++;
    const from = words.at(-1)?.end ?? 0;
    const to = k < ws.length ? old[match[k]!].start : end;
    const step = Math.max(0.05, (to - from) / (k - j));
    for (let x = j; x < k; x++) {
      const s = from + (x - j) * step;
      words.push({ w: ws[x], start: +s.toFixed(2), end: +(s + step * 0.9).toFixed(2) });
    }
    j = k;
  }
  return { text, words, status: "ready" };
}

/** How many words differ between two texts (word-level edit distance, case-insensitive). */
export function wordsChanged(a: string, b: string): number {
  const x = a.toLowerCase().split(/\s+/).filter(Boolean);
  const y = b.toLowerCase().split(/\s+/).filter(Boolean);
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length];
}
