import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AddonList } from "@/components/addon/AddonList";
import { YourCards } from "@/components/site/YourCards";

const more: { href: string; title: string; text: string; pre?: string }[] = [
  { href: "/game/client-pivot", title: "The Client Pivot", text: "A second story. The client changes the brief.", pre: "Play the game: " },
  { href: "/candidate/intro", title: "Prepare for your challenge", text: "What to expect, accommodations and answer formats." },
  { href: "/play/sample", title: "Start the sample challenge", text: "The step-by-step version, no game map." },
  { href: "/practice", title: "Practice run, never shared", text: "Try one checkpoint and see how it works." },
];

export default function CandidateHome() {
  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-10 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Candidate</p>
        <h1 className="mt-4 max-w-xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">Let your next move speak for you.</h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
          Lead a team through one week. The plan breaks, and short checkpoints ask why you chose what you did.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button asChild size="lg">
            <Link href="/game/launch-week" data-testid="play-game">
              Play the game <span aria-hidden>→</span>
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">Launch Week · about 15 minutes</p>
        </div>
        <ul className="mt-8 flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><span aria-hidden className="size-1.5 rounded-full bg-primary" />Video, voice or text, your choice</li>
          <li className="flex items-center gap-2"><span aria-hidden className="size-1.5 rounded-full bg-primary" />Never scored on face or voice</li>
          <li className="flex items-center gap-2"><span aria-hidden className="size-1.5 rounded-full bg-primary" />Saved in this browser</li>
        </ul>
      </div>
      <div className="space-y-4">
        <AddonList />
        <YourCards />
        <nav aria-labelledby="more-h" className="rounded-xl border bg-card shadow-card">
          <h2 id="more-h" className="border-b border-border/70 px-5 py-3 text-sm font-semibold">More ways in</h2>
          <ul className="divide-y divide-border/70">
            {more.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="group flex min-h-11 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/60">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{m.pre && <span className="sr-only">{m.pre}</span>}{m.title}</span>
                    <span className="block text-xs text-muted-foreground">{m.text}</span>
                  </span>
                  <span aria-hidden className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
