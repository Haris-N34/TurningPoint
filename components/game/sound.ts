// Tiny generated sound cues (no audio files). Muting is respected by the caller (C3.1).
let ctx: AudioContext | undefined;

export function chime(kind: "turning-point" | "checkpoint") {
  try {
    ctx ??= new AudioContext();
    const notes = kind === "turning-point" ? [392, 311, 233] : [660, 880];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const t = ctx!.currentTime + i * 0.14;
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch {
    // Audio is optional; never block the game.
  }
}
