"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Landing hero: a muted, looping 10-second look at the product (four real stills, crossfaded).
// Stills come from scripts/landing-stills.mjs. Autoplay stops under reduced motion and on hover or focus,
// and a visible Pause control is always there (WCAG 2.2.2).

const FRAMES = [
  { src: "/landing/1-title.webp", caption: "The plan breaks.", alt: "The Launch Week game title screen: you're the student lead, and on Tuesday the plan breaks." },
  { src: "/landing/2-cutscene.webp", caption: "You choose.", alt: "A game cutscene: the main sponsor pulls out and the budget drops." },
  { src: "/landing/3-checkpoint.webp", caption: "We ask why.", alt: "A checkpoint quotes the player's pick: You chose B, to keep Saturday and Sunday. Walk us through why." },
  { src: "/landing/4-card.webp", caption: "The recruiter sees evidence.", alt: "The recruiter's Capability Card with a highlighted quote playing as captions, and Shortlist, Hold and Pass." },
] as const;
const STEP_MS = 2500;

export function HeroPreview() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const running = !paused && !hold && !reduced;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setI((x) => (x + 1) % FRAMES.length), STEP_MS);
    return () => clearInterval(t);
  }, [running]);

  return (
    <figure
      className="self-center"
      aria-label="See it in 10 seconds"
      data-testid="hero-preview"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/70 bg-[#2b2620] shadow-card">
        {FRAMES.map((f, k) => (
          <Image
            key={f.src}
            src={f.src}
            alt={k === i ? f.alt : ""}
            aria-hidden={k !== i}
            width={800}
            height={450}
            sizes="(min-width: 1024px) 560px, 100vw"
            priority={k === 0}
            loading={k === 0 ? undefined : "lazy"}
            className={cn("absolute inset-0 size-full object-cover transition-opacity duration-700", k === i ? "opacity-100" : "opacity-0")}
            data-testid={k === i ? "hero-frame" : undefined}
          />
        ))}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="absolute right-3 top-3 inline-flex min-h-9 items-center rounded-full bg-black/60 px-3 text-xs font-medium text-white backdrop-blur hover:bg-black/75"
          data-testid="hero-pause"
        >
          {paused || reduced ? "Paused" : "Pause"}
        </button>
      </div>
      <figcaption className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">See it in 10 seconds</p>
        <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {FRAMES.map((f, k) => (
            <li key={f.src}>
              <button
                type="button"
                onClick={() => setI(k)}
                aria-current={k === i ? "step" : undefined}
                className={cn(
                  "flex w-full items-start gap-2 border-t-2 pt-2 text-left text-sm transition-colors",
                  k === i ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="font-mono text-xs text-primary">{k + 1}</span>
                {f.caption}
              </button>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
