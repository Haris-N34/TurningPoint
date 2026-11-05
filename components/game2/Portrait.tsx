import manifest from "@/public/assets/portraits/manifest.json";
import { cn } from "@/lib/utils";

type Expr = "neutral" | "worried" | "happy" | "angry";

// 16x16 pixel icons for things that have no drawn portrait. Each row is a string; "." is empty.
const PAL: Record<string, string> = { k: "#2e222f", g: "#5b6b7a", d: "#3a4756", s: "#8fd3ff", w: "#e9f7ff", y: "#ffd166", p: "#fff8e7", e: "#e8d9b5", b: "#8a5a2b", r: "#c43d22", h: "#6b3e22", f: "#eec19f", o: "#4a6fb0" };
const ICONS: Record<string, { label: string; bg: string; rows: string[] }> = {
  laptop: {
    label: "Your laptop",
    bg: "#3b2f45",
    rows: [
      "................",
      "................",
      "..kkkkkkkkkkkk..",
      "..kggggggggggk..",
      "..kgsssssssssgk.",
      "..kgswwssssssgk.",
      "..kgsssyyyssgk..",
      "..kgsssssssssgk.",
      "..kgsyyysssssgk.",
      "..kgsssssssssgk.",
      "..kggggggggggk..",
      ".kkkkkkkkkkkkkk.",
      "kdddddddddddddk.",
      "kgggggggggggggk.",
      ".kkkkkkkkkkkkk..",
      "................",
    ],
  },
  report: {
    label: "An old report",
    bg: "#3b2f45",
    rows: [
      "................",
      "....kkkkkkkk....",
      "....kpppppkek...",
      "....kpppppkeek..",
      "....kpkkkpkkkk..",
      "....kppppppppk..",
      "....kpkkkkkkpk..",
      "....kppppppppk..",
      "....kpkkkkkkpk..",
      "....kppppppppk..",
      "....kpkkkkpppk..",
      "....kppppppppk..",
      "....kpprrppppk..",
      "....kppppppppk..",
      "....kkkkkkkkkk..",
      "................",
    ],
  },
  phone: {
    label: "A ringing phone",
    bg: "transparent",
    rows: [
      "................",
      "................",
      "...kkkkkkkkkk...",
      "..kyyyyyyyyyyk..",
      ".kyykkkkkkkyyk..",
      ".kykk....kkykk..",
      ".kkk.kkkk.kkk...",
      ".....kyyk.......",
      "....kyyyyk......",
      "...kyykkyyk.....",
      "...kykppkyk.....",
      "...kyykkyyk.....",
      "...kyyyyyyk.....",
      "...kkkkkkkk.....",
      "................",
      "................",
    ],
  },
  person: {
    label: "A person",
    bg: "#3b2f45",
    rows: [
      "................",
      "................",
      "......kkkk......",
      ".....khhhhk.....",
      "....khhhhhhk....",
      "....kffffffk....",
      "....kfkffkfk....",
      "....kffffffk....",
      ".....kffffk.....",
      "......kffk......",
      "....kkooookk....",
      "...kooooooook...",
      "...kooooooook...",
      "...kooooooook...",
      "...kkkkkkkkkk...",
      "................",
    ],
  },
};

/** A crisp 16x16 pixel icon drawn as SVG rects. */
export function PixelIcon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  const icon = ICONS[name];
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" role="img" aria-label={icon.label} style={{ backgroundColor: icon.bg }}>
      {icon.rows.flatMap((row, y) => [...row].map((c, x) => (PAL[c] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PAL[c]} /> : null)))}
    </svg>
  );
}

/** NPC portrait with an expression (Haris's 96px set). The HQ laptop and props get a pixel icon. */
export function Portrait({ id, expression = "neutral", className }: { id: string; expression?: Expr; className?: string }) {
  const p = (manifest as { portraits: { id: string; name: string; expressions: Record<Expr, { src: string; alt: string }> }[] }).portraits.find((x) => x.id === id);
  if (!p) {
    const icon = id === "laptop" ? "laptop" : id.startsWith("prop:") ? "report" : "person";
    return <PixelIcon name={icon} className={cn("block", className)} />;
  }
  const e = p.expressions[expression] ?? p.expressions.neutral;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={e.src} alt={e.alt} width={96} height={96} className={cn("[image-rendering:pixelated]", className)} data-expression={expression} />;
}
