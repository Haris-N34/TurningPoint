"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { skillName } from "@/components/card/CapabilityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValueMapper, type MappedSkill } from "./ValueMapper";
import { getScenario, SCENARIO_IDS } from "@/content/scenarios";
import { challengeUrl, publish, qrDataUrl, saveDraft, type Challenge } from "@/lib/challenge/challenge";
import { preparePublishedContent } from "@/lib/ai/services/publish";
import { tailor } from "@/lib/ai/services/tailor";
import { INDUSTRIES, type Industry } from "@/lib/challenge/tailor";
import { ScenarioSchema, type Scenario } from "@/lib/engine/schema";
import { SKILLS, type SkillSlug } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";
import { cn } from "@/lib/utils";

// Challenge builder (E1): Company, Skills, Scenario, Review. One engine, no custom game per employer.

const STEPS = ["Company", "Skills", "Scenario", "Review"] as const;
const templates = SCENARIO_IDS.filter((id) => id !== "sample").concat(SCENARIO_IDS.includes("sample") ? ["sample"] : []).map((id) => getScenario(id)!);

export function Builder() {
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({ name: "", colour: "#a63e20", logoUrl: "" });
  const [title, setTitle] = useState("");
  const [skills, setSkills] = useState<SkillSlug[]>([]);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "sample");
  const [industry, setIndustry] = useState<Industry>("Non-profit");
  const [scenario, setScenario] = useState<Scenario>(templates[0]);
  const [tailorNote, setTailorNote] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string>();
  const [published, setPublished] = useState<Challenge | null>(null);
  const [qr, setQr] = useState<string>();
  const [startedAt] = useState(() => Date.now());
  const [customSkills, setCustomSkills] = useState<MappedSkill[]>([]);

  const valid = useMemo(() => ScenarioSchema.safeParse(scenario), [scenario]);
  const errors = valid.success ? [] : valid.error.issues.map((i) => i.message);

  const canNext = [company.name.trim() && title.trim(), skills.length >= 3 && skills.length <= 4, !!scenario, valid.success][step];

  const applyTemplate = (id: string, ind: Industry) => {
    const base = getScenario(id)!;
    // Scenario Tailor (B2): wording only; structure is locked and checked.
    const r = tailor(base, ind, company.name || undefined);
    setScenario(r.scenario);
    // E1.3: an invalid rewrite is never used; the builder says so and keeps the original.
    setTailorNote(r.error ? `Couldn't tailor to ${ind}, kept the original: ${r.error}` : r.changed ? `Rewritten for ${ind}. Edit any line in Review.` : null);
  };

  const persist = () => {
    const c = saveDraft(store(), { id: draftId, company: { name: company.name.trim(), colour: company.colour, logoUrl: company.logoUrl || undefined }, title: title.trim(), templateId, industry, targetSkills: skills, scenario, customSkills });
    setDraftId(c.id);
    return c;
  };

  useEffect(() => {
    if (published?.publicSlug) qrDataUrl(challengeUrl(window.location.origin, published)).then(setQr);
  }, [published]);

  const editNode = (i: number, patch: (n: Scenario["nodes"][number]) => void) => {
    setScenario((s) => {
      const next = structuredClone(s);
      patch(next.nodes[i]);
      return next;
    });
  };

  if (published) {
    const url = challengeUrl(typeof window === "undefined" ? "" : window.location.origin, published);
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    return (
      <main className="mx-auto max-w-3xl px-6 py-12" data-testid="published">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Published</p>
        <h1 className="mt-2 font-display text-4xl">{published.title}</h1>
        <p className="mt-1 text-muted-foreground">{published.company.name} · set up in about {mins} minute{mins === 1 ? "" : "s"}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <p className="text-sm font-medium">Candidate link</p>
            <p className="break-all rounded-lg bg-muted p-3 font-mono text-sm" data-testid="public-link">{url}</p>
            <p className="text-sm">Job code <span className="font-mono font-medium" data-testid="job-code">{published.jobCode}</span></p>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link href={`/recruiter?challenge=${published.id}`}>Open inbox</Link></Button>
              <Button asChild variant="outline"><Link href={`/c/${published.publicSlug}`}>Open candidate link</Link></Button>
            </div>
          </div>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${url}`} width={180} height={180} className="rounded-lg border bg-white p-2" data-testid="qr" />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 sm:px-10" data-testid="builder">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">New challenge</p>
      <ol className="mt-3 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn("min-h-9 rounded-full border px-4 text-sm", i === step && "bg-foreground text-background", i > step && "text-muted-foreground")}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="mt-8 max-w-lg space-y-4" aria-label="Company">
          <div>
            <label htmlFor="b-company" className="text-sm font-medium">Company name</label>
            <Input id="b-company" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Prairie Grid Energy" />
          </div>
          <div>
            <label htmlFor="b-title" className="text-sm font-medium">Role or challenge title</label>
            <Input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Field Operations Analyst, Summer 2027" />
          </div>
          <div className="flex gap-4">
            <div>
              <label htmlFor="b-colour" className="text-sm font-medium">Brand colour</label>
              <input id="b-colour" type="color" value={company.colour} onChange={(e) => setCompany({ ...company, colour: e.target.value })} className="mt-1 block h-11 w-20 rounded-md border" />
            </div>
            <div className="flex-1">
              <label htmlFor="b-logo" className="text-sm font-medium">Logo URL (optional)</label>
              <Input id="b-logo" value={company.logoUrl} onChange={(e) => setCompany({ ...company, logoUrl: e.target.value })} placeholder="https://" />
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="mt-8" aria-labelledby="skills-h">
          <h2 id="skills-h" className="font-display text-2xl">Pick 3 or 4 skills</h2>
          <p className="text-sm text-muted-foreground">One shared framework, so candidates can reuse their card across employers. {skills.length} of 4 picked.</p>
          <ValueMapper picked={skills} onUse={(sl) => setSkills((x) => (x.includes(sl) || x.length >= 4 ? x : [...x, sl]))} onDecided={setCustomSkills} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SKILLS.map((s) => {
              const on = skills.includes(s.slug);
              const full = !on && skills.length >= 4;
              return (
                <label key={s.slug} className={cn("cursor-pointer rounded-xl border bg-card p-4 shadow-card", on && "border-primary ring-2 ring-primary", full && "cursor-not-allowed opacity-50")} data-testid={`skill-${s.slug}`}>
                  <input type="checkbox" className="sr-only" checked={on} disabled={full} onChange={() => setSkills((x) => (on ? x.filter((k) => k !== s.slug) : [...x, s.slug]))} />
                  <span className="font-medium">{s.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{s.definition}</span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-8 space-y-6" aria-labelledby="tpl-h">
          <h2 id="tpl-h" className="font-display text-2xl">Choose a scenario</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => {
              const tests = t.targetSkills.filter((k) => skills.includes(k as SkillSlug));
              return (
                <label key={t.id} className={cn("cursor-pointer overflow-hidden rounded-xl border bg-card shadow-card", templateId === t.id && "border-primary ring-2 ring-primary")} data-testid={`template-${t.id}`}>
                  <input
                    type="radio"
                    name="template"
                    className="sr-only"
                    checked={templateId === t.id}
                    onChange={() => {
                      setTemplateId(t.id);
                      applyTemplate(t.id, industry);
                    }}
                  />
                  <div aria-hidden className="h-24 bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-rose-900/30" />
                  <div className="p-4">
                    <p className="font-medium">{t.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      About {t.estimatedMinutes ?? 15} minutes · Tests well: {t.targetSkills.map(skillName).join(", ")}
                    </p>
                    <p className="mt-1 text-xs">{tests.length ? `Matches ${tests.length} of your skills` : "Doesn't target your skills directly"}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="max-w-xs">
            <label htmlFor="b-industry" className="text-sm font-medium">Industry flavour</label>
            <select
              id="b-industry"
              value={industry}
              onChange={(e) => {
                const ind = e.target.value as Industry;
                setIndustry(ind);
                applyTemplate(templateId, ind);
              }}
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
            >
              {INDUSTRIES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
          {tailorNote && <p role="status" className="text-sm" data-testid="tailor-note">{tailorNote}</p>}
          <p className="rounded-lg bg-story p-3 text-sm" data-testid="tailored-opening">{scenario.nodes[0]?.text}</p>
        </section>
      )}

      {step === 3 && (
        <section className="mt-8 space-y-4" aria-labelledby="rev-h">
          <h2 id="rev-h" className="font-display text-2xl">Review and edit</h2>
          <p className="text-sm text-muted-foreground">Edit any line. Mark which decisions can trigger a surprise checkpoint (at least 3).</p>
          {errors.length > 0 && (
            <ul role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive" data-testid="builder-errors">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <ol className="space-y-3">
            {scenario.nodes.map((n, i) => (
              <li key={n.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{n.id} · {n.type === "event" && n.turningPoint ? "turning point" : n.type}</span>
                  {n.type === "choice" && (
                    <label className="flex items-center gap-2 text-foreground">
                      <input type="checkbox" checked={n.checkpointEligible} onChange={(e) => editNode(i, (x) => x.type === "choice" && (x.checkpointEligible = e.target.checked))} data-testid={`eligible-${n.id}`} />
                      Checkpoint can fire here
                    </label>
                  )}
                </div>
                <label className="sr-only" htmlFor={`node-${n.id}`}>Text for {n.id}</label>
                <textarea id={`node-${n.id}`} value={n.text} rows={2} onChange={(e) => editNode(i, (x) => (x.text = e.target.value))} className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm" data-testid={`text-${n.id}`} />
                {n.type === "choice" && (
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {n.options.map((o, j) => (
                      <input
                        key={o.id}
                        aria-label={`Option ${o.id} for ${n.id}`}
                        value={o.label}
                        onChange={(e) => editNode(i, (x) => x.type === "choice" && (x.options[j].label = e.target.value))}
                        className="min-h-9 rounded-md border border-input bg-background px-2 text-sm"
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-3 border-t bg-background py-4">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < 3 && (
          <Button
            disabled={!canNext}
            onClick={() => {
              if (step === 1 && templates.length) applyTemplate(templateId, industry);
              setStep((s) => s + 1);
            }}
          >
            Next
          </Button>
        )}
        {step === 3 && (
          <>
            <Button
              variant="outline"
              disabled={!valid.success}
              onClick={() => {
                const c = persist();
                window.open(`/admin/preview/${c.id}`, "_blank");
              }}
              data-testid="preview"
            >
              Preview as candidate
            </Button>
            <Button
              disabled={!valid.success}
              onClick={() => {
                const c = persist();
                // Publish-time AI (B.3): dialogue variants are made once here and cached with the challenge.
                preparePublishedContent(store(), c);
                setPublished(publish(store(), c.id));
              }}
            >
              Publish
            </Button>
          </>
        )}
        {step === 1 && <span className="text-sm text-muted-foreground">Pick 3 or 4</span>}
      </div>
    </main>
  );
}
