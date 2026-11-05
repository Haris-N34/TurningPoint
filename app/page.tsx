import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const steps = [
  { n: "01", title: "Step into a story.", text: "Lead a team. Make the calls. Work with limited time, money and information." },
  { n: "02", title: "Meet your turning point.", text: "The plan changes. Short checkpoints ask you to explain the choices you just made." },
  { n: "03", title: "Show the evidence.", text: "Your decisions and reflections become a Capability Card a person can review." },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-12 sm:px-10 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:pb-24">
        <div>
          <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"><span className="h-px w-8 bg-primary" aria-hidden />Beyond the résumé</p>
          <h1 className="mt-7 max-w-2xl font-display text-5xl leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">The plan breaks. <span className="text-primary">Your capability shows.</span></h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">A story-based challenge that shows how you think, adapt and bring people along when things change.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/game/launch-week" data-testid="play-game">Play the game <span aria-hidden>↗</span></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/candidate">Try the demo <span aria-hidden>↗</span></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/admin">For employers</Link></Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Free for candidates. Video, voice or text. Always a human decision.</p>
        </div>
        <div className="relative self-center rounded-xl bg-story p-6 sm:p-9" aria-label="Illustrated example of a turning point">
          <div className="flex items-center justify-between border-b border-border pb-4 text-xs font-medium uppercase tracking-widest"><span>Launch Week</span><span className="text-muted-foreground">A sample story</span></div>
          <div className="relative my-7 border-l-2 border-dashed border-input pl-6">
            <span aria-hidden className="absolute -left-[7px] top-1 size-3 rounded-full border-2 border-input bg-story" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">The plan</p>
            <p className="mt-2 text-lg">Three weeks. One market. A team counting on you.</p>
          </div>
          <div className="-mx-2 rotate-[-2deg] rounded-lg bg-primary p-6 text-primary-foreground shadow-card sm:-mx-5">
            <p className="text-xs font-medium uppercase tracking-widest">↳ The turning point</p>
            <p className="mt-3 font-display text-3xl leading-tight sm:text-4xl">Your sponsor just pulled out.</p>
            <p className="mt-3 text-sm">Less budget. Same promise to your community.</p>
          </div>
          <div className="mt-8 border-l-2 border-foreground pl-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Your next move</p>
            <p className="mt-2 text-lg font-medium">What do you protect? What do you change?</p>
            <div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">Adaptability</Badge><Badge variant="outline">Prioritization</Badge></div>
          </div>
        </div>
      </section>
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10 sm:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-3xl sm:text-4xl">Capability leaves a trail.</h2>
            <p className="text-sm text-muted-foreground">Three steps. More than a page of claims.</p>
          </div>
          <ol aria-label="How Turning Point works" className="mt-10 grid gap-8 md:grid-cols-3 md:gap-12">
            {steps.map(step => <li key={step.n} className="border-t border-border pt-5"><span className="font-mono text-sm text-primary">{step.n}</span><h3 className="mt-5 text-xl font-semibold tracking-tight">{step.title}</h3><p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">{step.text}</p></li>)}
          </ol>
        </div>
      </section>
      <section className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-6 py-14 sm:px-10">
        <div className="max-w-xl"><p className="text-xs font-medium uppercase tracking-widest text-primary">Evidence over impressions</p><h2 className="mt-3 font-display text-3xl">Your words. Your choices. Your story.</h2><p className="mt-4 leading-relaxed text-muted-foreground">No face or voice-tone scoring. No overall score. No automatic rejection. Just evidence, with a person making the call.</p></div>
        <Button asChild variant="outline"><Link href="/recruiter">Explore the recruiter role <span aria-hidden>↗</span></Link></Button>
      </section>
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">Turning Point · A local demo for DICC 2026 · Built around human judgment</footer>
    </main>
  );
}
