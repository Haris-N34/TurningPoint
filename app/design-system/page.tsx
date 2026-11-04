import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function DesignSystem() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:px-10">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Turning Point / Design foundations</p>
      <h1 className="mt-6 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">A little structure. Room to adapt.</h1>
      <p className="mt-6 max-w-xl text-muted-foreground">Warmth for the story. Clarity for the evidence. One shared language for every role.</p>
      <section className="mt-12 grid gap-8 sm:grid-cols-2" aria-label="Component examples">
        <Card>
          <CardHeader>
            <Badge className="w-fit" variant="secondary">Recruiter surface</Badge>
            <CardTitle><h2>Evidence, in their own words</h2></CardTitle>
            <CardDescription>Calm surfaces and clear hierarchy make room for a human decision.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label htmlFor="challenge" className="text-sm font-medium">Challenge title</label>
            <Input id="challenge" placeholder="Name your challenge" />
            <div className="flex flex-wrap gap-3">
              <Button>Primary action</Button><Button variant="outline">Secondary action</Button>
              <Button disabled>Unavailable</Button>
            </div>
          </CardContent>
        </Card>
        <section className="rounded-xl bg-story p-8">
          <p className="text-sm font-medium text-primary">The story side</p>
          <h2 className="mt-4 font-display text-3xl">Then the plan changed.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">The sponsor has pulled out. Your team is looking to you. What do you protect first?</p>
          <Badge variant="outline" className="mt-6">Adaptability</Badge>
        </section>
      </section>
      <section className="mt-12" aria-label="Palette">
        <h2 className="text-lg font-semibold">A single accent, grounded in neutrals</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Primary', 'bg-primary text-primary-foreground'], ['Secondary', 'bg-secondary text-secondary-foreground'], ['Muted', 'bg-muted text-muted-foreground'], ['Accent', 'bg-accent text-accent-foreground']].map(([name, style]) => <div key={name} className={`rounded-lg p-6 text-sm ${style}`}>{name}</div>)}
        </div>
      </section>
    </main>
  );
}
