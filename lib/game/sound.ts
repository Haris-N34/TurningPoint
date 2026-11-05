"use client";

// Game sound (PRD v2, A0): generated with WebAudio, so there are no audio files to license.
// Everything is optional and respects the mute settings; failures never block the game.

let ctx: AudioContext | undefined;
let musicTimer: ReturnType<typeof setInterval> | undefined;
let musicGain: GainNode | undefined;
let sfxOn = true;

function ac(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.05, when = 0, dest?: AudioNode) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + when;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  setEnabled(on: boolean) {
    sfxOn = on;
  },
  /** Dialogue voice blip, pitched per speaker. */
  blip(pitch = 520) {
    if (sfxOn) tone(pitch + Math.random() * 40, 0.04, "square", 0.025);
  },
  step() {
    if (sfxOn) tone(110 + Math.random() * 30, 0.03, "triangle", 0.02);
  },
  click() {
    if (sfxOn) tone(880, 0.05, "square", 0.03);
  },
  notify() {
    if (!sfxOn) return;
    tone(660, 0.08, "square", 0.04);
    tone(990, 0.12, "square", 0.04, 0.08);
  },
  success() {
    if (!sfxOn) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "square", 0.04, i * 0.07));
  },
  fail() {
    if (!sfxOn) return;
    [392, 311, 233].forEach((f, i) => tone(f, 0.16, "sawtooth", 0.03, i * 0.1));
  },
  ring() {
    if (!sfxOn) return;
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) tone(i % 2 ? 1320 : 1180, 0.05, "square", 0.035, r * 0.9 + i * 0.06);
  },
  checkpoint() {
    if (!sfxOn) return;
    tone(660, 0.15, "sine", 0.06);
    tone(880, 0.25, "sine", 0.06, 0.15);
  },
};

// Two moods: a warm major loop before the turning point, a tense minor loop after (A0).
const SONGS = {
  calm: { bpm: 96, bass: [130.8, 130.8, 174.6, 196], lead: [523, 587, 659, 784, 659, 587, 523, 440] },
  tense: { bpm: 108, bass: [110, 110, 98, 82.4], lead: [440, 523, 494, 440, 392, 440, 349, 330] },
};

export const music = {
  play(mood: keyof typeof SONGS) {
    music.stop();
    const c = ac();
    if (!c) return;
    musicGain = c.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(c.destination);
    const song = SONGS[mood];
    const beat = 60 / song.bpm;
    let bar = 0;
    const playBar = () => {
      if (!musicGain) return;
      const b = song.bass[bar % song.bass.length];
      for (let i = 0; i < 4; i++) tone(b, beat * 0.9, "triangle", 0.035, i * beat, musicGain);
      for (let i = 0; i < 8; i++) if ((i + bar) % 3 !== 2) tone(song.lead[(i + bar * 2) % song.lead.length], beat * 0.4, "square", 0.012, i * beat * 0.5, musicGain);
      bar++;
    };
    playBar();
    musicTimer = setInterval(playBar, beat * 4 * 1000);
  },
  stop() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = undefined;
    musicGain?.disconnect();
    musicGain = undefined;
  },
};
