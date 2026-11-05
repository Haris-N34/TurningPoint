"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { mapValues, splitTerms, type Mapping } from "@/lib/ai/services/valueMapper";
import { SKILLS, type SkillSlug } from "@/lib/engine/skills";
import { cn } from "@/lib/utils";

// Value Mapper step (B.5): the employer types their own competency names; each is mapped onto the shared
// framework with a confidence. Nothing is applied until the admin accepts, changes or rejects it.

export type MappedSkill = { term: string; skill: SkillSlug | null; confidence: number; status: "accepted" | "changed" | "rejected" };
type Row = Mapping & { chosen: SkillSlug | null; status?: MappedSkill["status"] };

const skillName = (s: SkillSlug | null) => (s ? SKILLS.find((k) => k.slug === s)?.name ?? s : "No match");

export function ValueMapper({ picked, onUse, onDecided }: { picked: SkillSlug[]; onUse: (s: SkillSlug) => void; onDecided: (m: MappedSkill[]) => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const update = (next: Row[]) => {
    setRows(next);
    onDecided(next.filter((r) => r.status).map((r) => ({ term: r.term, skill: r.chosen, confidence: r.confidence, status: r.status! })));
  };
  const decide = (i: number, status: MappedSkill["status"], chosen?: SkillSlug | null) => {
    const next = rows.map((r, k) => (k === i ? { ...r, status, chosen: chosen === undefined ? r.chosen : chosen } : r));
    update(next);
    const skill = next[i].chosen;
    if (status !== "rejected" && skill && !picked.includes(skill) && picked.length < 4) onUse(skill);
  };

  return (
    <section className="mt-4 rounded-xl border bg-card p-4 shadow-card" aria-labelledby="vm-h" data-testid="value-mapper">
      <h3 id="vm-h" className="font-medium">Use your own competency names (optional)</h3>
      <p className="text-sm text-muted-foreground">Type them one per line or separated by commas. We suggest the closest framework skill; you confirm each one.</p>
      <label htmlFor="vm-terms" className="sr-only">Your competency names</label>
      <textarea
        id="vm-terms"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Communicate tech and business, Analytical thinking, Make new discoveries"
        className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm"
        data-testid="vm-terms"
      />
      <Button type="button" variant="outline" className="mt-2" disabled={!splitTerms(text).length} onClick={() => update(mapValues(splitTerms(text)).map((m) => ({ ...m, chosen: m.skill })))} data-testid="vm-map">
        Map to framework
      </Button>
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.term}-${i}`} className={cn("rounded-lg border p-3 text-sm", r.status === "rejected" && "opacity-60")} data-testid={`vm-row-${i}`} data-status={r.status ?? "pending"}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span className="font-medium">“{r.term}”</span> → <span className="font-medium" data-testid={`vm-skill-${i}`}>{skillName(r.chosen)}</span>
                </p>
                <span className="text-xs text-muted-foreground" data-testid={`vm-confidence-${i}`}>
                  Confidence {Math.round(r.confidence * 100)}%
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.why}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant={r.status === "accepted" ? "default" : "outline"} disabled={!r.chosen} onClick={() => decide(i, "accepted")} aria-pressed={r.status === "accepted"} data-testid={`vm-accept-${i}`}>
                  Accept
                </Button>
                <label className="sr-only" htmlFor={`vm-change-${i}`}>Change the skill for {r.term}</label>
                <select
                  id={`vm-change-${i}`}
                  value={r.chosen ?? ""}
                  onChange={(e) => decide(i, "changed", (e.target.value || null) as SkillSlug | null)}
                  className="min-h-9 rounded-md border border-input bg-background px-2 text-sm"
                  data-testid={`vm-change-${i}`}
                >
                  <option value="">Change to…</option>
                  {SKILLS.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.name}</option>
                  ))}
                </select>
                <Button type="button" size="sm" variant={r.status === "rejected" ? "default" : "outline"} onClick={() => decide(i, "rejected")} aria-pressed={r.status === "rejected"} data-testid={`vm-reject-${i}`}>
                  Reject
                </Button>
                {r.status && <span className="text-xs font-medium capitalize" data-testid={`vm-status-${i}`}>{r.status}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
