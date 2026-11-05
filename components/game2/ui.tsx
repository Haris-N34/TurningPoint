import { cn } from "@/lib/utils";

// One pixel UI kit for the game (PRD v2, A0). Two fonts only: Pixelify Sans (body) and Press Start 2P (titles, numbers).
// Palette: ink #2e222f, paper #fff8e7, shade #e8d9b5, red #c43d22, gold #ffd166, green #4f9d69, blue #4a6fb0.
// Spacing: 4 px steps. Borders: 3 px ink on panels and buttons, 2 px inside panels.

export const INK = "#2e222f";

/** Paper panel with a hard pixel drop shadow. `tone="ink"` is the dark variant for overlays. */
export function Panel({ className, children, tone = "paper", ...rest }: React.HTMLAttributes<HTMLDivElement> & { tone?: "paper" | "ink" }) {
  return (
    <div
      className={cn(
        "rounded-[6px] border-[3px] border-[#2e222f]",
        tone === "paper" ? "bg-[#fff8e7] text-[#2e222f] shadow-[inset_0_-4px_0_#e8d9b5,0_4px_0_#2e222f]" : "bg-[#3b2f45] text-[#fff8e7] shadow-[inset_0_-4px_0_#2e222f,0_4px_0_#1a1320]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

const SIZES = {
  sm: "min-h-8 px-2.5 py-0.5 text-[13px] border-2",
  md: "min-h-11 px-4 py-1.5 text-[15px] border-[3px]",
  lg: "min-h-14 px-7 py-2 text-[18px] border-[3px]",
} as const;

export function PixelButton({
  className,
  tone = "primary",
  size = "md",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "plain" | "danger" | "ghost"; size?: keyof typeof SIZES }) {
  const tones = {
    primary: "bg-[#c43d22] text-white shadow-[inset_0_-3px_0_#9c2c18] hover:bg-[#d4492c]",
    plain: "bg-[#fff8e7] text-[#2e222f] shadow-[inset_0_-3px_0_#e0cfa6] hover:bg-white",
    danger: "bg-[#7a2e3a] text-white shadow-[inset_0_-3px_0_#4e1c25]",
    ghost: "border-transparent bg-transparent text-current shadow-none hover:bg-black/10",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[4px] border-[#2e222f] font-semibold leading-tight transition-transform active:translate-y-0.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#ffd166] disabled:opacity-50",
        SIZES[size],
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

/** Small uppercase label above a heading ("Turning point", "Checkpoint"). */
export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9c2c18]", className)}>{children}</p>;
}

/** A key hint, like [Enter]. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-block rounded-[3px] border-2 border-current px-1 font-[inherit] text-[11px] font-semibold leading-none [padding-block:2px]", className)}>{children}</kbd>;
}
