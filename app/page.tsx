import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroPreview } from "@/components/site/HeroPreview";

const steps = [
  { n: "01", title: "Step into a story.", text: "Lead a team. Make the calls. Work with limited time, money and information." },
  { n: "02", title: "Meet your turning point.", text: "The plan changes. Short checkpoints ask you to explain the choices you just made." },
  { n: "03", title: "Show the evidence.", text: "Your decisions and reflections become a Capability Card a person can review." },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-10 sm:px-10 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-20 lg:pb-20">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span className="h-px w-8 bg-primary" aria-hidden />Beyond the résumé</p>
          <h1 className="mt-6 max-w-2xl font-display text-[2.75rem] leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.25rem]">The plan breaks. <span className="text-primary">Your capability shows.</span></h1>
          <p className="mt-4 text-base font-medium text-foreground/80" data-testid="pitch-line">Turning Point tests how you handle it when the plan breaks.</p>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">A short story game where the plan falls apart. Candidates explain the calls they just made. Recruiters get evidence, not polished claims.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg"><Link href="/game/launch-week" data-testid="play-game">Play the game <span aria-hidden>→</span></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/candidate">Try the demo</Link></Button>
            <Link href="/admin" className="inline-flex min-h-12 items-center gap-1.5 px-2 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground">For employers</Link>
          </div>
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span>Free for candidates</span><span aria-hidden className="hidden sm:inline">·</span><span>Video, voice or text</span><span aria-hidden className="hidden sm:inline">·</span><span>A human makes every call</span></p>
        </div>
        <HeroPreview />
      </section>
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-10 sm:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-3xl sm:text-4xl">Capability leaves a trail.</h2>
            <p className="text-sm text-muted-foreground">Three steps. More than a page of claims.</p>
          </div>
          <ol aria-label="How Turning Point works" className="mt-10 grid gap-8 md:grid-cols-3 md:gap-12">
            {steps.map(step => <li key={step.n} className="border-t border-border pt-5"><span className="font-mono text-sm text-primary">{step.n}</span><h3 className="mt-5 text-xl font-semibold tracking-tight">{step.title}</h3><p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">{step.text}</p></li>)}
          </ol>
        </div>
      </section>
      <section className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-4 py-14 sm:px-10">
        <div className="max-w-xl"><p className="text-xs font-medium uppercase tracking-widest text-primary">Evidence over impressions</p><h2 className="mt-3 font-display text-3xl">Your words. Your choices. Your story.</h2><p className="mt-4 leading-relaxed text-muted-foreground">No face or voice-tone scoring. No automatic rejection. The Final score only sorts a list and always shows its working. A person makes the call.</p></div>
        <Button asChild size="lg" variant="outline"><Link href="/recruiter">See the recruiter view <span aria-hidden>→</span></Link></Button>
      </section>
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">Turning Point · A local demo for DICC 2026 · Built around human judgment</footer>
    </main>
  );
}
