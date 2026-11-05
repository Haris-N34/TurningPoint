import { describe, expect, it } from "vitest";
import { createListener, isFatal, speechErrorMessage, type SpeechEvent, type SpeechRec, type SpeechState } from "./speech";

// A fake recognizer we drive by hand. Each `new` is recorded so restarts are visible.
function harness(opts: { silent?: boolean } = {}) {
  const made: Fake[] = [];
  class Fake implements SpeechRec {
    continuous = false;
    interimResults = false;
    lang = "";
    onresult: ((e: SpeechEvent) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error?: string }) => void) | null = null;
    onstart: (() => void) | null = null;
    started = 0;
    stopped = 0;
    constructor() {
      made.push(this);
    }
    start() {
      this.started++;
      // A browser with a speech service confirms with onstart; one without (Chromium, Brave) never does.
      if (!opts.silent) this.onstart?.();
    }
    stop() {
      this.stopped++;
      queueMicrotask(() => this.onend?.());
    }
    say(text: string, isFinal: boolean) {
      this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal }) as unknown as SpeechEvent["results"][0]] });
    }
  }
  let clock = 0;
  const timers: (() => void)[] = [];
  const finals: string[] = [];
  const interims: string[] = [];
  const states: SpeechState[] = [];
  const l = createListener({
    Ctor: Fake,
    now: () => clock,
    onFinal: (t) => finals.push(t),
    onInterim: (t) => interims.push(t),
    onState: (s) => states.push(s),
    setTimer: (fn) => (timers.push(fn), timers.length),
    clearTimer: () => {},
  });
  return {
    l,
    made,
    finals,
    interims,
    states,
    tick: (s: number) => (clock += s),
    runTimers: () => timers.splice(0).forEach((f) => f()),
  };
}

describe("speech listener", () => {
  it("turns on interim results and continuous mode", () => {
    const h = harness();
    h.l.start();
    expect(h.made[0].interimResults).toBe(true);
    expect(h.made[0].continuous).toBe(true);
    expect(h.states.at(-1)).toEqual({ kind: "listening" });
  });

  it("shows interim words live and keeps finals", () => {
    const h = harness();
    h.l.start();
    h.made[0].say("I cut the", false);
    expect(h.interims.at(-1)).toBe("I cut the");
    h.made[0].say("I cut the second weekend", true);
    expect(h.finals).toEqual(["I cut the second weekend"]);
    expect(h.interims.at(-1)).toBe("");
  });

  it("restarts when the browser ends recognition by itself (silence, 60 s cap)", () => {
    const h = harness();
    h.l.start();
    h.tick(30);
    h.made[0].onend!();
    h.runTimers();
    expect(h.made.length).toBe(2);
    expect(h.made[1].started).toBe(1);
    expect(h.l.restarts).toBe(1);
  });

  it("keeps words that were still interim when recognition ended", () => {
    const h = harness();
    h.l.start();
    h.made[0].say("because the vendors", false);
    h.tick(10);
    h.made[0].onend!();
    expect(h.finals).toEqual(["because the vendors"]);
  });

  it("no-speech just restarts, not an error", () => {
    const h = harness();
    h.l.start();
    h.tick(8);
    h.made[0].onerror!({ error: "no-speech" });
    h.made[0].onend!();
    h.runTimers();
    expect(h.made.length).toBe(2);
    expect(h.states.some((s) => s.kind === "error")).toBe(false);
  });

  it("not-allowed stops for good with a plain message", () => {
    const h = harness();
    h.l.start();
    h.made[0].onerror!({ error: "not-allowed" });
    h.made[0].onend!();
    h.runTimers();
    expect(h.made.length).toBe(1);
    const last = h.states.at(-1)!;
    expect(last.kind).toBe("error");
    expect(last.kind === "error" && last.message).toMatch(/blocked live captions/);
  });

  it("network errors get a few retries, then a message", () => {
    const h = harness();
    h.l.start();
    for (let i = 0; i < 4; i++) {
      h.tick(5);
      h.made.at(-1)!.onerror!({ error: "network" });
      h.made.at(-1)!.onend!();
      h.runTimers();
    }
    expect(h.made.length).toBe(4);
    expect(h.states.at(-1)).toMatchObject({ kind: "error", code: "network" });
  });

  it("gives up instead of spinning when recognition keeps ending at once", () => {
    const h = harness();
    h.l.start();
    for (let i = 0; i < 10; i++) {
      h.made.at(-1)!.onend!();
      h.runTimers();
    }
    expect(h.made.length).toBeLessThan(8);
    expect(h.states.at(-1)?.kind).toBe("error");
  });

  it("stop waits for the last words and does not restart", async () => {
    const h = harness();
    h.l.start();
    h.made[0].say("last words", false);
    await h.l.stop(1000);
    expect(h.finals).toEqual(["last words"]);
    h.runTimers();
    expect(h.made.length).toBe(1);
    expect(h.states.at(-1)).toEqual({ kind: "off" });
  });

  it("maps error codes to plain words", () => {
    expect(isFatal("audio-capture")).toBe(true);
    expect(isFatal("no-speech")).toBe(false);
    expect(speechErrorMessage("audio-capture")).toMatch(/microphone/);
    expect(speechErrorMessage("weird")).toMatch(/turn it into text on this device/);
  });

  it("says 'starting' until the browser confirms, never 'listening' on its own", () => {
    const h = harness({ silent: true });
    h.l.start();
    expect(h.states.at(-1)).toEqual({ kind: "starting" });
  });

  it("no speech service and the browser never ends it either: gives up after the start timeout", () => {
    const h = harness({ silent: true });
    h.l.start();
    h.runTimers(); // the 4 s start timer fires with nothing confirmed
    expect(h.states.at(-1)).toMatchObject({ kind: "error", code: "no-service" });
  });

  it("no speech service behind the API (ends without starting): stops quickly with a plain message", () => {
    const h = harness({ silent: true });
    h.l.start();
    h.tick(0.1);
    h.made[0].onend!();
    h.runTimers();
    if (h.made[1]) {
      h.made[1].onend!();
      h.runTimers();
    }
    expect(h.made.length).toBeLessThanOrEqual(2);
    const last = h.states.at(-1)!;
    expect(last).toMatchObject({ kind: "error", code: "no-service" });
    expect(last.kind === "error" && last.message).toMatch(/Live captions aren't working in this browser/);
  });
});
