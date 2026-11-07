// Browser speech recognition, wrapped so it keeps listening for the whole answer.
// Pure logic (no React) so restart and error handling are unit tested.
// Only the words are kept. Nothing about the voice itself (tone, accent, fluency) is measured.

export type SpeechAlt = { transcript: string };
export type SpeechResult = { isFinal: boolean; 0: SpeechAlt; length?: number };
export type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };

export type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  onerror: ((e: { error?: string; message?: string }) => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
};
export type SpeechCtor = new () => SpeechRec;

export function speechCtor(w: unknown = typeof window === "undefined" ? undefined : window): SpeechCtor | undefined {
  if (!w) return undefined;
  const x = w as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return x.SpeechRecognition ?? x.webkitSpeechRecognition;
}

/** What the candidate sees about live transcription. */
export type SpeechState =
  | { kind: "off" }
  /** Asked the browser to listen; it has not confirmed yet. */
  | { kind: "starting" }
  | { kind: "listening" }
  | { kind: "unsupported" }
  /** Stopped for good this answer. The recording continues; the candidate types or fixes the words after. */
  | { kind: "error"; code: string; message: string };

const AFTER = "Keep talking: captions now come from this device as you speak.";
const MESSAGES: Record<string, string> = {
  "not-allowed": `This browser blocked live captions. ${AFTER}`,
  "service-not-allowed": `Live captions are turned off in this browser. ${AFTER}`,
  "audio-capture": `Live captions can't reach the microphone. ${AFTER}`,
  network: `Live captions need an internet connection in this browser and it dropped. ${AFTER}`,
  "language-not-supported": `Live captions don't support your language setting here. ${AFTER}`,
  // The browser has the speech API but no speech service behind it (Chromium, Brave, some Edge builds).
  "no-service": `Live captions aren't working in this browser. ${AFTER}`,
};

export const UNSUPPORTED_MESSAGE =
  "This browser has no built-in live captions, so captions come from this device as you speak. You can fix any words before you submit.";

/** Plain-words message for a recognition error code. */
export function speechErrorMessage(code: string) {
  return MESSAGES[code] ?? `Live captions stopped. ${AFTER}`;
}

/** Errors that end live transcription for this answer. "no-speech" and "aborted" just restart. */
export function isFatal(code: string) {
  return code in MESSAGES;
}

export type ListenerOpts = {
  Ctor: SpeechCtor;
  lang?: string;
  /** Seconds since the answer started. */
  now: () => number;
  onFinal: (text: string, atS: number) => void;
  onInterim: (text: string) => void;
  onState: (s: SpeechState) => void;
  /** How long the browser may take to confirm it started listening before we call it unavailable. */
  startTimeoutMs?: number;
  /** Wait before restarting after the browser ends recognition by itself. */
  restartDelayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
};

/**
 * Keeps recognition running until stop(): browsers end it after silence or about a minute,
 * so we start it again. Network errors get a few retries before giving up.
 */
export function createListener(o: ListenerOpts) {
  const setT = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = o.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  const delay = o.restartDelayMs ?? 250;
  let rec: SpeechRec | null = null;
  let active = false;
  let fatal = false;
  let interim = "";
  let restarts = 0;
  let quickEnds = 0;
  let networkErrors = 0;
  let startedAt = 0;
  let confirmed = false; // the browser said it started (onstart) for the current recognizer
  let silentEnds = 0; // recognizers that ended without ever starting
  let everConfirmed = false;
  let startTimer: unknown;
  let timer: unknown;
  let endWaiters: (() => void)[] = [];

  const flushInterim = () => {
    const t = interim.trim();
    interim = "";
    o.onInterim("");
    if (t) o.onFinal(t, o.now());
  };

  const fail = (code: string) => {
    fatal = true;
    o.onState({ kind: "error", code, message: speechErrorMessage(code) });
  };

  const spawn = () => {
    const r = new o.Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = o.lang ?? "en-US";
    r.onstart = () => {
      confirmed = everConfirmed = true;
      silentEnds = 0;
      o.onState({ kind: "listening" });
    };
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = (res?.[0]?.transcript ?? "").trim();
        if (!text) continue;
        if (!confirmed) {
          // Some browsers deliver results without onstart.
          confirmed = everConfirmed = true;
          o.onState({ kind: "listening" });
        }
        if (res.isFinal) {
          o.onFinal(text, o.now());
          quickEnds = 0;
          networkErrors = 0;
        } else live += (live ? " " : "") + text;
      }
      interim = live;
      o.onInterim(live);
    };
    r.onerror = (e) => {
      const code = e?.error ?? "unknown";
      if (code === "no-speech" || code === "aborted") return;
      if (code === "network" && ++networkErrors <= 3) return; // onend restarts it
      if (isFatal(code) || code === "network") fail(code);
    };
    r.onend = () => {
      // Words still in flight when the browser stopped count as said.
      flushInterim();
      if (rec !== r) return;
      if (!active || fatal) {
        rec = null;
        const w = endWaiters;
        endWaiters = [];
        w.forEach((f) => f());
        return;
      }
      // Ended without ever starting, twice: there is no speech service behind the API here.
      if (!confirmed && ++silentEnds >= 2) return fail("no-service");
      // Ended within a second of starting, again and again: give up rather than spin.
      if (o.now() - startedAt < 1) quickEnds++;
      if (quickEnds > 5) return fail("unknown");
      restarts++;
      timer = setT(() => {
        if (active && !fatal && rec === r) begin();
      }, delay);
    };
    return r;
  };

  const begin = () => {
    startedAt = o.now();
    confirmed = false;
    try {
      rec = spawn();
      // "Listening" waits for the browser's onstart; until then the candidate sees that it is starting.
      if (!everConfirmed) o.onState({ kind: "starting" }); // restarts stay "listening": no flicker
      const mine = rec;
      rec.start();
      // Never confirmed within a few seconds: there is no working speech service here. Say so, stop trying.
      if (!everConfirmed)
        startTimer = setT(() => {
          if (rec !== mine || confirmed || !active || fatal) return;
          fail("no-service");
          try {
            if (mine.abort) mine.abort();
            else mine.stop();
          } catch {
            // already stopped
          }
        }, o.startTimeoutMs ?? 4000);
    } catch {
      rec = null;
      fail("unknown");
    }
  };

  return {
    start() {
      active = true;
      fatal = false;
      everConfirmed = false;
      restarts = 0;
      quickEnds = 0;
      networkErrors = 0;
      begin();
    },
    /** Stop listening and wait (up to waitMs) for the last words to arrive. */
    stop(waitMs = 1500): Promise<void> {
      active = false;
      clearT(timer);
      clearT(startTimer);
      const r = rec;
      if (!r) {
        flushInterim();
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          flushInterim();
          rec = null;
          o.onState({ kind: "off" });
          resolve();
        };
        endWaiters.push(finish);
        setT(finish, waitMs);
        try {
          r.stop();
        } catch {
          finish();
        }
      });
    },
    get restarts() {
      return restarts;
    },
  };
}
