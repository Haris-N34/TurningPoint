import Link from "next/link";
import { Button } from "@/components/ui/button";

export function RoleHome({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-10 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
      <div className="mt-6 max-w-xl space-y-5 leading-relaxed text-muted-foreground">{children}</div>
      <div className="mt-10 border-t border-border/70 pt-4"><Button asChild variant="ghost" size="sm" className="-ml-3.5"><Link href="/">← Back to Turning Point</Link></Button></div>
    </main>
  );
}
