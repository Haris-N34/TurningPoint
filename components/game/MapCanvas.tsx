"use client";

import { useEffect, useRef, useState } from "react";
import type PhaserNS from "phaser";
import type { Look, MapScenario } from "@/lib/game/schema";
import { useGame } from "@/lib/game/store";
import { createScene } from "./phaser/createScene";

// Client-only Phaser mount (PRD v2, A2). Loaded with next/dynamic and ssr: false by its parent.
export default function MapCanvas({ scenario, avatar, attract = false, label }: { scenario: MapScenario; avatar: Look; attract?: boolean; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  // Add ?fps=1 to the URL to see the live frame rate (A.20 device check).
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    let game: PhaserNS.Game | undefined;
    let alive = true;
    const showFps = new URLSearchParams(window.location.search).has("fps");
    const fpsTimer = showFps ? setInterval(() => game && setFps(Math.round(game.loop.actualFps)), 500) : undefined;
    void import("phaser").then((Phaser) => {
      if (!alive || !host.current) return;
      const Scene = createScene(Phaser, {
        scenario,
        avatar,
        attract,
        getState: () => useGame.getState().state,
        isFrozen: () => {
          const g = useGame.getState();
          return g.paused || g.cutscene || !!g.state?.dialogue || (g.state?.checkpointsDue.length ?? 0) > 0 || !!g.state?.ended || g.recapDay !== undefined;
        },
        reducedMotion: () => useGame.getState().settings.reducedMotion,
      });
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        backgroundColor: "#2e222f",
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
        // Test builds draw at 20 fps: headless Chrome renders WebGL in software, and 60 fps per tab starves the test machine.
        fps: process.env.NEXT_PUBLIC_TEST_HOOKS === "1" ? { target: 20, limit: 20 } : { target: 60 },
        audio: { noAudio: true },
        scene: [Scene],
      });
      if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") (window as unknown as { __phaser?: PhaserNS.Game }).__phaser = game;
    });
    return () => {
      alive = false;
      clearInterval(fpsTimer);
      game?.destroy(true);
    };
    // Recreate only when the scenario or avatar changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id, attract, JSON.stringify(avatar)]);
  return (
    <>
      <div ref={host} className="absolute inset-0 [image-rendering:pixelated]" role="img" aria-label={label} data-testid={attract ? "title-map" : "map-canvas"} />
      {fps !== null && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 z-[80] -translate-x-1/2 rounded bg-black/70 px-2 font-mono text-xs text-white" data-testid="fps">
          {fps} fps
        </span>
      )}
    </>
  );
}
