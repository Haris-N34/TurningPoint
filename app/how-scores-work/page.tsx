import type { Metadata } from "next";
import { SKILLS } from "@/lib/engine/skills";
import { SCORING_CONFIG as C } from "@/lib/scoring/config";
import { finalScore, gameSkillScore } from "@/lib/scoring/score";

export const metadata: Metadata = { title: "How scores work · Turning Point" };

// Public explanation of the Final score (PRD v2 D.3). Renders the live config, so it can never drift from the code.

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function HowScoresWork() {
  const example = finalScore({
    targetSkills: ["prioritization", "collaboration"],
    game: [gameSkillScore("prioritization", 80, "strong"), gameSkillScore("collaboration", 60, "some")],
    claims: [{ skills: ["prioritization"], backed: true }],
  });
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-12 sm:px-10" data-testid="how-scores-work">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Public · Formula version {C.version}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight">How scores work</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Every Capability Card leads with evidence: quotes, choices and in-game results. The Final score is a sorting aid that sits in a small box at the top
          right. It never hides, filters or rejects anyone. A person makes every decision.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Game score per skill (0 to 100)</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            In-game results (KPIs) count for <strong data-testid="kpi-share">{pct(C.kpiShare)}</strong>. They are computed from game outcomes only, never
            from speed, clicks or keystrokes.
          </li>
          <li>
            Evidence in the candidate&apos;s own words counts for <strong>{pct(C.transcriptShare)}</strong>: Strong ={" "}
            <strong data-testid="strong-points">{C.levelPoints.strong}</strong>, Some = <strong>{C.levelPoints.some}</strong>. Not observed and Needs human
            review add nothing.
          </li>
          <li>No transcript evidence means the score uses results only and is marked Low confidence.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">2. Resume score per skill (0 to 100)</h2>
        <p className="text-sm leading-relaxed">
          Names, contact details, photos, addresses, graduation years, school and company names are removed before anything is analyzed. Each claim is
          &ldquo;Backed by game evidence&rdquo; (worth {C.backedClaimPoints}) or &ldquo;Not yet shown&rdquo; (worth {C.unbackedClaimPoints}). A claim is
          never labelled false.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">3. Final score (0 to 100)</h2>
        <p className="text-sm leading-relaxed">
          For each of the employer&apos;s target skills: game × <strong data-testid="game-weight">{pct(C.gameWeight)}</strong> + resume ×{" "}
          <strong data-testid="resume-weight">{pct(C.resumeWeight)}</strong>, then a weighted average using the employer&apos;s skill weights. Employers can
          move the resume weight between 0% and <strong data-testid="max-resume-weight">{pct(C.maxResumeWeight)}</strong>, never higher. No resume means
          game only, with no penalty.
        </p>
        <div className="rounded-xl border bg-card p-4 text-sm shadow-card">
          <p className="font-medium">Worked example</p>
          <ul className="mt-2 space-y-1">
            {example.breakdown.map((b) => (
              <li key={b.skill}>
                {SKILLS.find((s) => s.slug === b.skill)?.name}: game {b.game}
                {b.resume !== null ? `, resume ${b.resume}` : ", no resume claim"} → {b.combined} (weight {pct(b.weight)})
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Final score: <strong data-testid="example-value">{example.value}</strong>
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Guardrails</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>The Final score sorts. It never filters. There is no threshold, hide-below or auto-reject setting anywhere, and a test checks that.</li>
          <li>Every Final score shows its per-skill breakdown next to it; the full table opens on hover or keyboard focus.</li>
          <li>Second Look still applies: strong evidence brings back candidates a resume screen rejected.</li>
          <li>Faces, voice tone, accent, grammar and fluency are never scored.</li>
          <li>Changing any weight bumps the formula version, and every score records the version it used.</li>
        </ul>
      </section>
    </main>
  );
}
