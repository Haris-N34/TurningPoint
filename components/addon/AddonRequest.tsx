"use client";

import { useState } from "react";
import { LevelBadge, skillName } from "@/components/card/CapabilityCard";
import { Button } from "@/components/ui/button";
import { addonFor, ADDON_MINUTES, missingSkills, requestAddon, type Addon } from "@/lib/addon/addon";
import type { SkillSlug } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";

// E8.2: recruiter side. One click asks the candidate for a short add-on covering only the missing skills.
export function AddonRequest({ attemptId, challengeId, employerSkills, cardSkills }: { attemptId: string; challengeId: string; employerSkills: SkillSlug[]; cardSkills: SkillSlug[] }) {
  const [addon, setAddon] = useState<Addon | undefined>(() => addonFor(store(), attemptId, challengeId));
  const missing = missingSkills({ targetSkills: cardSkills }, employerSkills);
  if (!missing.length && !addon) return null;

  return (
    <section className="mt-4 rounded-xl border bg-card p-4 text-sm" data-testid="addon" aria-label="Short add-on">
      <p className="font-medium">Not covered by this card: {missing.map(skillName).join(", ")}</p>
      {!addon && (
        <>
          <p className="mt-1 text-muted-foreground">Ask the candidate for a {ADDON_MINUTES}-minute mini-scenario on only these skills. They can say no.</p>
          <Button className="mt-2" variant="outline" data-testid="addon-request" onClick={() => setAddon(requestAddon(store(), attemptId, challengeId, employerSkills))}>
            Ask for a short add-on
          </Button>
        </>
      )}
      {addon?.status === "requested" && <p className="mt-1" data-testid="addon-status">Add-on requested. Waiting for the candidate.</p>}
      {addon?.status === "done" && (
        <div className="mt-2 space-y-3" data-testid="addon-done">
          <p className="text-xs text-muted-foreground">Add-on answers, in the candidate&apos;s own words. Evidence levels only, no score.</p>
          {addon.evidence.map((e) => (
            <div key={e.skill}>
              <p className="flex items-center gap-2 font-medium">{skillName(e.skill)} <LevelBadge level={e.level} /></p>
              {addon.answers[e.skill] && <blockquote className="mt-1 border-l-2 pl-3">{addon.answers[e.skill]}</blockquote>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
