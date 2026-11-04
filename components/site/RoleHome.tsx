import Link from "next/link";
import { Button } from "@/components/ui/button";

export function RoleHome({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-10 sm:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h1 className="mt-5 max-w-2xl font-display text-4xl leading-tight sm:text-6xl">{title}</h1>
      <div className="mt-8 max-w-xl space-y-6 leading-relaxed text-muted-foreground">{children}</div>
      <div className="mt-12 border-t border-border pt-6"><Button asChild variant="link" className="px-0"><Link href="/">← Back to Turning Point</Link></Button></div>
    </main>
  );
}
