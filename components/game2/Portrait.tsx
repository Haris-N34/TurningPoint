"use client";

import manifest from "@/public/assets/portraits/manifest.json";
import { cn } from "@/lib/utils";

type Expr = "neutral" | "worried" | "happy" | "angry";

/** NPC portrait with an expression (Haris's 96px set). The HQ laptop and "you" get a pixel icon. */
export function Portrait({ id, expression = "neutral", className }: { id: string; expression?: Expr; className?: string }) {
  const p = (manifest as { portraits: { id: string; name: string; expressions: Record<Expr, { src: string; alt: string }> }[] }).portraits.find((x) => x.id === id);
  if (!p) {
    return (
      <div className={cn("flex items-center justify-center bg-[#2e3a4a] text-3xl", className)} role="img" aria-label="Your laptop">
        <span aria-hidden>💻</span>
      </div>
    );
  }
  const e = p.expressions[expression] ?? p.expressions.neutral;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={e.src} alt={e.alt} width={96} height={96} className={cn("[image-rendering:pixelated]", className)} data-expression={expression} />;
}
