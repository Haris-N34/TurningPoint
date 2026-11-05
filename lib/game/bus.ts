import mitt from "mitt";

// Typed events between the Phaser renderer and the React UI (PRD v2, A2). Phaser never changes game
// state itself: it reports input (interact, zone entered) and React dispatches engine actions.

export type BusEvents = {
  /** Phaser -> React: player pressed E / tapped an NPC. */
  interact: { npc: string };
  /** Phaser -> React: player's tile position entered a zone. */
  zone: { zone: string };
  /** React -> Phaser: walk the player to an NPC (fast travel / tap), then emit interact. */
  walkTo: { npc: string; thenInteract: boolean };
  /** React -> Phaser: emote bubble over an NPC. */
  emote: { npc: string; emote: string };
  /** React -> Phaser: juice. */
  shake: { intensity: number };
  burst: { npc: string };
  /** React -> Phaser: turning point camera pan across these NPCs, then back to the player. */
  pan: { npcs: string[] };
  /** React -> Phaser: freeze input (dialogue, checkpoint, pause). */
  freeze: { frozen: boolean };
  /** Phaser -> React: assets loaded. */
  ready: undefined;
};

export const bus = mitt<BusEvents>();
