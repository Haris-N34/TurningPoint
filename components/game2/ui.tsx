import { cn } from "@/lib/utils";

// Pixel-styled building blocks for the game HUD and menus (PRD v2, A0).
export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[6px] border-[3px] border-[#2e222f] bg-[#fff8e7] text-[#2e222f] shadow-[inset_0_-4px_0_#e8d9b5,0_4px_0_#2e222f]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PixelButton({ className, tone = "primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "plain" | "danger" }) {
  const tones = {
    primary: "bg-[#c43d22] text-white shadow-[inset_0_-3px_0_#9c2c18] hover:bg-[#b5371e]",
    plain: "bg-[#fff8e7] text-[#2e222f] shadow-[inset_0_-3px_0_#e0cfa6] hover:bg-white",
    danger: "bg-[#7a2e3a] text-white shadow-[inset_0_-3px_0_#4e1c25]",
  };
  return (
    <button
      className={cn(
        "min-h-11 rounded-[4px] border-[3px] border-[#2e222f] px-4 py-1.5 font-semibold transition-transform active:translate-y-0.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#ffd166] disabled:opacity-50",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
