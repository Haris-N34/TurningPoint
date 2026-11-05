import type PhaserNS from "phaser";
import EasyStar from "easystarjs";
import { bus } from "@/lib/game/bus";
import type { GameState } from "@/lib/game/engine";
import type { Look, MapScenario } from "@/lib/game/schema";
import { characterSheet, FRAME } from "@/lib/game/sprites";
import { dayProgress } from "@/lib/game/time";

// The map renderer (PRD v2, A2 to A4). It only renders and reports input; the engine owns state.

type Opts = {
  scenario: MapScenario;
  avatar: Look;
  getState: () => GameState | undefined;
  isFrozen: () => boolean;
  reducedMotion: () => boolean;
  attract?: boolean; // title screen: camera drifts, no player control
  /** True while a cutscene plays: signs step aside so only the cutscene reads. */
  hideSigns?: () => boolean;
  /** CSS font family for zone signs (the game's pixel body font). */
  font?: string;
};

const TILE = 16;
const SEVERITY_COLOUR: Record<string, number> = { low: 0x4f9d69, medium: 0xe0a32e, high: 0xd9472b };
const EMOTE: Record<string, string> = { heart: "♥", sweat: "💧", anger: "💢", note: "♪", exclaim: "!", question: "?" };

export function createScene(Phaser: typeof PhaserNS, o: Opts) {
  const s = o.scenario;

  return class MarketScene extends Phaser.Scene {
    player!: PhaserNS.GameObjects.Sprite;
    npcs = new Map<string, { sprite: PhaserNS.GameObjects.Sprite; bubble: PhaserNS.GameObjects.Container; shadow: PhaserNS.GameObjects.Ellipse }>();
    crowd: { sprite: PhaserNS.GameObjects.Sprite; path: { x: number; y: number }[]; key: string }[] = [];
    blocked: number[][] = [];
    keys!: Record<string, PhaserNS.Input.Keyboard.Key>;
    path: { x: number; y: number }[] = [];
    pathTarget?: { npc?: string };
    /** Fast travel never takes more than a few real seconds: after this, the player arrives. */
    walkDeadline = 0;
    walkGoal?: { x: number; y: number };
    star = new EasyStar.js();
    zone = "";
    light!: PhaserNS.GameObjects.Rectangle;
    darkRects = new Map<string, PhaserNS.GameObjects.Rectangle>();
    facing: "down" | "left" | "right" | "up" = "down";
    focusIndex = -1;
    focusRing?: PhaserNS.GameObjects.Ellipse;
    lastStepTile = "";
    minimap?: PhaserNS.Cameras.Scene2D.Camera;
    /** True while the camera tours the new problems after the cutscene; signs step aside. */
    panning = false;
    labels: { text: PhaserNS.GameObjects.Text; zone: MapScenario["zones"][number] }[] = [];

    constructor() {
      super("market");
    }

    preload() {
      this.load.tilemapTiledJSON("map", s.map.tiled);
      this.load.image("town", "/assets/tiles/kenney-tiny-town.png");
    }

    makeCharacter(key: string, look: Look) {
      if (this.textures.exists(key)) return;
      const sheet = characterSheet(look);
      const canvas = document.createElement("canvas");
      canvas.width = sheet.width;
      canvas.height = sheet.height;
      canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(sheet.data), sheet.width, sheet.height), 0, 0);
      // Phaser accepts a canvas as a sprite sheet source at runtime.
      this.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, { frameWidth: FRAME, frameHeight: FRAME });
      const dirs = ["down", "left", "right", "up"];
      dirs.forEach((d, row) => {
        this.anims.create({ key: `${key}-walk-${d}`, frames: [1, 0, 2, 0].map((f) => ({ key, frame: row * 3 + f })), frameRate: 8, repeat: -1 });
        this.anims.create({ key: `${key}-idle-${d}`, frames: [{ key, frame: row * 3 }], frameRate: 1 });
      });
    }

    create() {
      const map = this.make.tilemap({ key: "map" });
      const ts = map.addTilesetImage("kenney-tiny-town", "town")!;
      map.createLayer("ground", ts, 0, 0)!.setDepth(0);
      map.createLayer("deco", ts, 0, 0)!.setDepth(1);
      map.createLayer("above", ts, 0, 0)!.setDepth(50);
      const col = map.getLayer("collision")!;
      this.blocked = col.data.map((row) => row.map((t) => (t.index > 0 ? 1 : 0)));
      this.star.setGrid(this.blocked);
      this.star.setAcceptableTiles([0]);
      this.star.enableCornerCutting();
      this.star.disableDiagonals();

      // Zone signs in the pixel UI font. They stay inside the view and fade with distance (see placeLabels).
      // The attract map (title and avatar backdrop) shows none: the art carries the mood.
      for (const z of s.zones) {
        if (!o.attract) {
          const label = this.add.text((z.x + z.w / 2) * TILE, z.y * TILE - 2, z.name, {
            fontFamily: o.font ?? "monospace",
            fontSize: "8px",
            fontStyle: "600",
            color: "#fff8e7",
            backgroundColor: "#2e222fe6",
            padding: { x: 3, y: 1 },
            resolution: 6,
          });
          label.setOrigin(0.5, 1).setDepth(60);
          this.labels.push({ text: label, zone: z });
        }
        const dark = this.add.rectangle(z.x * TILE, z.y * TILE, z.w * TILE, z.h * TILE, 0x0b0b1a, 0).setOrigin(0, 0).setDepth(55);
        this.darkRects.set(z.id, dark);
      }

      // NPCs with shadows, idle breathing and issue bubbles.
      for (const n of s.npcs) {
        if (n.id === "laptop" || n.portrait.startsWith("prop:")) {
          // The HQ laptop and other props (an old report) are objects, not people.
          const isLaptop = n.id === "laptop";
          const g = this.add.rectangle(n.tile.x * TILE + 8, n.tile.y * TILE + 10, 10, isLaptop ? 7 : 9, isLaptop ? 0x2e3a4a : 0x8a5a2b).setStrokeStyle(1, 0x2e222f).setDepth(10);
          const screen = this.add.rectangle(n.tile.x * TILE + 8, n.tile.y * TILE + 9, 7, 4, isLaptop ? 0x8fd3ff : 0xe8dcb5).setDepth(11);
          if (isLaptop) this.tweens.add({ targets: screen, alpha: 0.6, duration: 900, yoyo: true, repeat: -1 });
          else
            g.setInteractive({ useHandCursor: true }).on("pointerdown", (p: PhaserNS.Input.Pointer) => {
              p.event.stopPropagation();
              if (!o.attract) this.walkToNpc(n.id, true);
            });
          const sprite = this.add.sprite(n.tile.x * TILE + 8, n.tile.y * TILE + 8, "__DEFAULT").setVisible(false);
          this.npcs.set(n.id, { sprite, bubble: this.makeBubble(), shadow: this.add.ellipse(0, 0, 1, 1).setVisible(false) });
          void g;
          continue;
        }
        const key = `npc-${n.id}`;
        this.makeCharacter(key, n.look);
        const x = n.tile.x * TILE + 8, y = n.tile.y * TILE + 8;
        const shadow = this.add.ellipse(x, y + 7, 10, 3, 0x000000, 0.25).setDepth(9);
        const sprite = this.add.sprite(x, y, key, 0).setDepth(10 + y / 1000);
        sprite.play(`${key}-idle-down`);
        this.tweens.add({ targets: sprite, scaleY: 1.04, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        this.npcs.set(n.id, { sprite, bubble: this.makeBubble(), shadow });
        sprite.setInteractive({ useHandCursor: true }).on("pointerdown", (p: PhaserNS.Input.Pointer) => {
          p.event.stopPropagation();
          if (!o.attract) this.walkToNpc(n.id, true);
        });
      }

      // Ambient crowd walking between points on the paths.
      const looks: Look[] = [
        { skin: "#eec19f", hair: "#6b3e22", hairStyle: "long", outfit: "#4a6fb0", extra: "none" },
        { skin: "#6b4430", hair: "#1f1720", hairStyle: "curly", outfit: "#c47a2c", extra: "none" },
        { skin: "#d9a17a", hair: "#e3c06a", hairStyle: "short", outfit: "#3f6b3a", extra: "none" },
        { skin: "#4a2f22", hair: "#1f1720", hairStyle: "bald", outfit: "#7a2e3a", extra: "none" },
        { skin: "#f6d7c3", hair: "#9a9a9a", hairStyle: "bun", outfit: "#6b4fa0", extra: "glasses" },
        { skin: "#b97c55", hair: "#3a2418", hairStyle: "spiky", outfit: "#2f7f73", extra: "none" },
      ];
      const spots = [
        { x: 3, y: 17 }, { x: 36, y: 17 }, { x: 19, y: 4 }, { x: 20, y: 28 }, { x: 33, y: 8 }, { x: 8, y: 8 }, { x: 6, y: 21 }, { x: 32, y: 22 },
      ];
      looks.forEach((l, i) => {
        const key = `crowd-${i}`;
        this.makeCharacter(key, l);
        const at = spots[i % spots.length];
        const sprite = this.add.sprite(at.x * TILE + 8, at.y * TILE + 8, key, 0).setDepth(10).setAlpha(0.95);
        this.crowd.push({ sprite, path: [], key });
      });
      this.time.addEvent({ delay: 1500, loop: true, callback: () => this.crowdThink(spots) });

      // Player.
      const startZone = s.zones.find((z) => z.id === s.map.start)!;
      const sx = (startZone.x + Math.floor(startZone.w / 2)) * TILE + 8;
      const sy = (startZone.y + startZone.h) * TILE + 8;
      this.makeCharacter("player", o.avatar);
      this.add.ellipse(sx, sy + 7, 10, 3, 0x000000, 0.25).setDepth(9).setName("player-shadow");
      this.player = this.add.sprite(sx, sy, "player", 0).setDepth(20);
      this.player.play("player-idle-down");
      this.focusRing = this.add.ellipse(0, 0, 18, 8, 0xffffff, 0).setStrokeStyle(1, 0xfff1a8).setDepth(8).setVisible(false);

      // Lighting overlay (day to evening) and camera.
      this.light = this.add.rectangle(0, 0, 4000, 4000, 0xff8a3d, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(70);
      const cam = this.cameras.main;
      cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      cam.setRoundPixels(true);
      this.fitZoom();
      this.scale.on("resize", () => this.fitZoom());
      if (o.attract) {
        cam.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);
        this.tweens.add({ targets: cam, scrollX: cam.scrollX + 120, duration: 14000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      } else {
        cam.startFollow(this.player, true, 0.12, 0.12);
        // Minimap in the corner (A0 HUD).
        const mw = 160, mh = 120;
        this.minimap = this.cameras.add(this.scale.width - mw - 12, this.scale.height - mh - 12, mw, mh).setZoom(mw / map.widthInPixels).setName("minimap");
        this.minimap.setBounds(0, 0, map.widthInPixels, map.heightInPixels).setBackgroundColor(0x2e222f);
        this.minimap.ignore([this.light, ...this.labels.map((l) => l.text)]);
        this.scale.on("resize", () => this.minimap?.setPosition(this.scale.width - mw - 12, this.scale.height - mh - 12));
      }

      // Input.
      const kb = this.input.keyboard!;
      // No key capture: React's dialogue buttons and text fields must keep Enter, Space and letters.
      this.keys = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ENTER,TAB,SPACE", false) as Record<string, PhaserNS.Input.Keyboard.Key>;
      kb.disableGlobalCapture();
      this.input.on("pointerdown", (p: PhaserNS.Input.Pointer) => {
        if (o.attract || o.isFrozen()) return;
        const tx = Math.floor(p.worldX / TILE), ty = Math.floor(p.worldY / TILE);
        this.walkToTile(tx, ty);
      });

      bus.on("walkTo", this.onWalkTo);
      bus.on("emote", this.onEmote);
      bus.on("shake", this.onShake);
      bus.on("burst", this.onBurst);
      bus.on("pan", this.onPan);
      const cleanup = () => {
        bus.off("walkTo", this.onWalkTo);
        bus.off("emote", this.onEmote);
        bus.off("shake", this.onShake);
        bus.off("burst", this.onBurst);
        bus.off("pan", this.onPan);
      };
      // Game.destroy() emits DESTROY rather than SHUTDOWN; clean up on both.
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
      this.game.events.once(Phaser.Core.Events.DESTROY, cleanup);
      bus.emit("ready", undefined);
    }

    fitZoom() {
      const w = this.scale.width;
      // Phones see about 14 tiles across, desktops about 24.
      const zoom = Math.max(2, Math.min(4, Math.floor((w / (w < 640 ? 14 : 24) / TILE) * 2) / 2));
      this.cameras.main.setZoom(zoom);
    }

    makeBubble() {
      const c = this.add.container(0, 0).setDepth(65).setVisible(false);
      const bg = this.add.circle(0, 0, 5, 0xffffff).setStrokeStyle(1, 0x2e222f);
      const t = this.add.text(0, 0, "!", { fontFamily: "monospace", fontSize: "8px", color: "#2e222f", fontStyle: "bold", resolution: 4 }).setOrigin(0.5);
      c.add([bg, t]);
      this.tweens.add({ targets: c, y: "-=2", duration: 450, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      return c;
    }

    crowdThink(spots: { x: number; y: number }[]) {
      for (const c of this.crowd) {
        if (c.path.length || Math.random() < 0.5) continue;
        const from = { x: Math.floor(c.sprite.x / TILE), y: Math.floor(c.sprite.y / TILE) };
        const to = spots[Math.floor(Math.random() * spots.length)];
        this.star.findPath(from.x, from.y, to.x, to.y, (p) => {
          if (p) c.path = p.slice(1, 12);
        });
      }
      this.star.calculate();
    }

    onWalkTo = (e: { npc: string; thenInteract: boolean }) => {
      if (this.alive()) this.walkToNpc(e.npc, e.thenInteract);
    };
    /** False once the scene or game is torn down; handlers must not touch a dead scene. */
    alive() {
      return !!this.sys && !!this.add && !!this.player && this.sys.isActive();
    }
    onEmote = (e: { npc: string; emote: string }) => {
      if (!this.alive()) return;
      const n = this.npcs.get(e.npc);
      if (!n) return;
      const t = this.add.text(n.sprite.x, n.sprite.y - 16, EMOTE[e.emote] ?? "!", { fontSize: "10px", resolution: 4 }).setOrigin(0.5).setDepth(66);
      this.tweens.add({ targets: t, y: t.y - 8, alpha: 0, duration: o.reducedMotion() ? 10 : 1400, onComplete: () => t.destroy() });
    };
    onShake = (e: { intensity: number }) => {
      if (!this.alive()) return;
      if (!o.reducedMotion()) this.cameras.main.shake(250, e.intensity);
    };
    onBurst = (e: { npc: string }) => {
      if (!this.alive()) return;
      const n = this.npcs.get(e.npc);
      if (!n || o.reducedMotion()) return;
      for (let i = 0; i < 12; i++) {
        const p = this.add.rectangle(n.sprite.x, n.sprite.y - 4, 2, 2, [0xffd166, 0x8fd694, 0xffffff][i % 3]).setDepth(67);
        const a = (i / 12) * Math.PI * 2;
        this.tweens.add({ targets: p, x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14 - 6, alpha: 0, duration: 600, onComplete: () => p.destroy() });
      }
    };
    onPan = (e: { npcs: string[] }) => {
      if (!this.alive()) return;
      const cam = this.cameras.main;
      if (o.reducedMotion()) return;
      cam.stopFollow();
      this.panning = true;
      const pts = e.npcs.map((id) => this.npcs.get(id)?.sprite).filter(Boolean) as PhaserNS.GameObjects.Sprite[];
      let delay = 0;
      for (const p of pts) {
        this.time.delayedCall(delay, () => cam.pan(p.x, p.y, 700, Phaser.Math.Easing.Sine.InOut));
        delay += 1100;
      }
      this.time.delayedCall(delay, () => {
        cam.pan(this.player.x, this.player.y, 600, Phaser.Math.Easing.Sine.InOut);
        this.time.delayedCall(650, () => {
          this.panning = false;
          cam.startFollow(this.player, true, 0.12, 0.12);
        });
      });
    };

    walkToNpc(id: string, thenInteract: boolean) {
      const n = s.npcs.find((x) => x.id === id);
      if (!n) return;
      // Stand on the tile below the NPC (or any free neighbour).
      const cands = [
        [n.tile.x, n.tile.y + 1], [n.tile.x - 1, n.tile.y], [n.tile.x + 1, n.tile.y], [n.tile.x, n.tile.y - 1],
      ].filter(([x, y]) => this.blocked[y]?.[x] === 0);
      const [tx, ty] = cands[0] ?? [n.tile.x, n.tile.y + 1];
      this.pathTarget = thenInteract ? { npc: id } : undefined;
      if (o.reducedMotion()) {
        // Reduced motion: no walking animation, arrive straight away.
        this.player.setPosition(tx * TILE + 8, ty * TILE + 8);
        this.arrive();
        return;
      }
      this.walkDeadline = this.time.now + 4000;
      this.walkGoal = { x: tx, y: ty };
      this.walkToTile(tx, ty, true);
    }

    walkToTile(tx: number, ty: number, keepTarget = false) {
      if (!keepTarget) {
        this.pathTarget = undefined;
        this.walkGoal = undefined;
      }
      const from = { x: Math.floor(this.player.x / TILE), y: Math.floor(this.player.y / TILE) };
      if (this.blocked[ty]?.[tx] !== 0) return;
      this.star.findPath(from.x, from.y, tx, ty, (p) => {
        this.path = p ? p.slice(1) : [];
        // No route (or already there): arrive directly so fast travel never gets stuck.
        if (!p || p.length <= 1) {
          if (!p && keepTarget) this.player.setPosition(tx * TILE + 8, ty * TILE + 8);
          this.arrive();
        }
      });
      this.star.calculate();
    }

    arrive() {
      if (this.pathTarget?.npc) {
        const id = this.pathTarget.npc;
        this.pathTarget = undefined;
        this.faceNpc(id);
        bus.emit("interact", { npc: id });
      }
    }

    faceNpc(id: string) {
      const n = this.npcs.get(id);
      if (!n) return;
      const dx = n.sprite.x - this.player.x, dy = n.sprite.y - this.player.y;
      this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      this.player.play(`player-idle-${this.facing}`, true);
    }

    nearestNpc(maxDist = 22) {
      let best: string | undefined, bd = maxDist;
      for (const [id, n] of this.npcs) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
        if (d < bd) {
          bd = d;
          best = id;
        }
      }
      return best;
    }

    canWalk(x: number, y: number) {
      const tx = Math.floor(x / TILE), ty = Math.floor((y + 6) / TILE);
      return this.blocked[ty]?.[tx] === 0;
    }

    update(_t: number, dtMs: number) {
      const st = o.getState();
      const dt = dtMs / 1000;
      // Crowd.
      for (const c of this.crowd) {
        const next = c.path[0];
        if (!next) {
          c.sprite.play(`${c.key}-idle-down`, true);
          continue;
        }
        const tx = next.x * TILE + 8, ty = next.y * TILE + 8;
        const dx = tx - c.sprite.x, dy = ty - c.sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) c.path.shift();
        else {
          const sp = 28 * dt;
          c.sprite.x += (dx / dist) * Math.min(sp, dist);
          c.sprite.y += (dy / dist) * Math.min(sp, dist);
          const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
          c.sprite.play(`${c.key}-walk-${d}`, true);
          c.sprite.setDepth(10 + c.sprite.y / 1000);
        }
      }

      // Bubbles, dark zones and lighting from engine state.
      if (st) {
        const openByNpc = new Map<string, string>();
        for (const i of s.issues) {
          const x = st.issues[i.id];
          if (x.status !== "open" || i.hidden) continue;
          const prev = openByNpc.get(i.npc);
          const rank = { low: 0, medium: 1, high: 2 };
          if (!prev || rank[i.severity] > rank[prev as keyof typeof rank]) openByNpc.set(i.npc, i.severity);
        }
        for (const [id, n] of this.npcs) {
          const sev = openByNpc.get(id);
          n.bubble.setVisible(!!sev);
          if (sev) {
            n.bubble.setPosition(n.sprite.x, n.sprite.y - 14);
            const bg = n.bubble.list[0] as PhaserNS.GameObjects.Arc;
            bg.setFillStyle(SEVERITY_COLOUR[sev]);
            (n.bubble.list[1] as PhaserNS.GameObjects.Text).setColor("#ffffff").setText(sev === "high" ? "!!" : "!");
          }
        }
        for (const [id, r] of this.darkRects) r.setFillStyle(0x0b0b1a, st.darkZones.includes(id) ? 0.55 : 0);
        const p = dayProgress(st.t);
        // Morning soft gold, midday clear, evening orange to dusk purple.
        const colour = p < 0.15 ? 0xffd27a : p < 0.7 ? 0xffffff : p < 0.9 ? 0xff8a3d : 0x5b3a8c;
        const alpha = p < 0.15 ? 0.08 : p < 0.7 ? 0 : p < 0.9 ? 0.14 + (p - 0.7) * 0.5 : 0.3;
        this.light.setFillStyle(colour, alpha);
      }

      if (o.attract || !this.player) return;
      const frozen = o.isFrozen();
      // The minimap steps aside while a dialogue, checkpoint or cutscene is up.
      this.minimap?.setVisible(!frozen);
      this.placeLabels();
      const k = this.keys;
      let vx = 0, vy = 0;
      if (!frozen) {
        if (k.A.isDown || k.LEFT.isDown) vx = -1;
        else if (k.D.isDown || k.RIGHT.isDown) vx = 1;
        if (k.W.isDown || k.UP.isDown) vy = -1;
        else if (k.S.isDown || k.DOWN.isDown) vy = 1;
      }
      if (vx || vy) this.path = [];
      // Fast travel took too long (slow device or blocked route): finish it now.
      if (this.walkGoal && this.pathTarget && this.time.now > this.walkDeadline && !frozen) {
        this.player.setPosition(this.walkGoal.x * TILE + 8, this.walkGoal.y * TILE + 8);
        this.path = [];
        this.walkGoal = undefined;
        this.arrive();
      }
      // Path following (click, tap, fast travel).
      if (!vx && !vy && this.path.length && !frozen) {
        const nx = this.path[0].x * TILE + 8, ny = this.path[0].y * TILE + 8;
        const dx = nx - this.player.x, dy = ny - this.player.y;
        if (Math.hypot(dx, dy) < 1.5) {
          this.player.setPosition(nx, ny);
          this.path.shift();
          if (!this.path.length) this.arrive();
        } else {
          vx = Math.abs(dx) > 0.5 ? Math.sign(dx) : 0;
          vy = Math.abs(dy) > 0.5 ? Math.sign(dy) : 0;
        }
      }
      const speed = 64 * dt;
      if (vx || vy) {
        const len = Math.hypot(vx, vy);
        const nx = this.player.x + (vx / len) * speed, ny = this.player.y + (vy / len) * speed;
        if (this.canWalk(nx, this.player.y)) this.player.x = nx;
        if (this.canWalk(this.player.x, ny)) this.player.y = ny;
        this.facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? "right" : "left") : vy > 0 ? "down" : "up";
        this.player.play(`player-walk-${this.facing}`, true);
        const tileKey = `${Math.floor(this.player.x / TILE)},${Math.floor(this.player.y / TILE)}`;
        if (tileKey !== this.lastStepTile) {
          this.lastStepTile = tileKey;
          bus.emit("zone", { zone: this.zoneAt(this.player.x, this.player.y) ?? "" });
        }
      } else {
        this.player.play(`player-idle-${this.facing}`, true);
      }
      this.player.setDepth(10 + this.player.y / 1000);
      const sh = this.children.getByName("player-shadow") as PhaserNS.GameObjects.Ellipse | null;
      sh?.setPosition(this.player.x, this.player.y + 7);

      // Interact (E / Enter / Space) with the nearest NPC; Tab cycles NPCs with open issues.
      if (!frozen) {
        const near = this.nearestNpc();
        if (near && (Phaser.Input.Keyboard.JustDown(k.E) || Phaser.Input.Keyboard.JustDown(k.ENTER) || Phaser.Input.Keyboard.JustDown(k.SPACE))) {
          this.faceNpc(near);
          bus.emit("interact", { npc: near });
        }
        if (Phaser.Input.Keyboard.JustDown(k.TAB) && st) {
          const withIssues = [...new Set(s.issues.filter((i) => st.issues[i.id].status === "open" && !i.hidden).map((i) => i.npc))];
          if (withIssues.length) {
            this.focusIndex = (this.focusIndex + 1) % withIssues.length;
            this.walkToNpc(withIssues[this.focusIndex], false);
          }
        }
      }
    }

    /** Keep zone signs fully on screen and clear of the HUD panels while their zone is in view; dim the far ones. */
    placeLabels() {
      const cam = this.cameras.main;
      const v = cam.worldView;
      const z = cam.zoom;
      const sw = this.scale.width;
      const desktop = sw >= 640;
      // Screen-space reserves: the top HUD strip, and on desktop the issue list in the top right.
      const big = sw >= 1700 && this.scale.height >= 950; // the HUD is drawn 1.25x there (tp-scale in GameShell)
      const k = big ? 1.25 : 1;
      const top = (132 * k) / z;
      const listW = desktop ? (320 * k) / z : 0, listBottom = (360 * k) / z;
      // Signs keep one on-screen size whatever the camera zoom (about 18 px tall).
      const scale = (desktop ? 17 : 14) / (8 * z);
      const hide = this.panning || !!o.hideSigns?.();
      for (const { text, zone: zn } of this.labels) {
        const zx = zn.x * TILE, zy = zn.y * TILE, zw = zn.w * TILE, zh = zn.h * TILE;
        const inView = zx < v.right && zx + zw > v.x && zy < v.bottom && zy + zh > v.y;
        text.setVisible(inView && !hide);
        if (!inView || hide) continue;
        text.setScale(scale);
        const hw = text.displayWidth / 2 + 2;
        const y = Phaser.Math.Clamp(zy - 2, v.y + top + text.displayHeight, v.bottom - 2);
        const right = y - v.y < listBottom ? v.right - listW : v.right;
        const x = Phaser.Math.Clamp(zx + zw / 2, v.x + hw, Math.max(v.x + hw, right - hw));
        text.setPosition(x, y);
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, zx + zw / 2, zy + zh / 2) / TILE;
        text.setAlpha(Phaser.Math.Clamp(1.4 - d / 18, 0.45, 1));
      }
    }

    zoneAt(x: number, y: number) {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      return s.zones.find((z) => tx >= z.x - 1 && tx < z.x + z.w + 1 && ty >= z.y - 1 && ty < z.y + z.h + 1)?.id;
    }

    teleportToNpc(id: string) {
      const n = s.npcs.find((x) => x.id === id);
      if (n) this.player.setPosition(n.tile.x * TILE + 8, (n.tile.y + 1) * TILE + 8);
    }
  };
}
