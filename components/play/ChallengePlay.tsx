"use client";

import { useEffect, useState } from "react";
import { Game } from "@/components/game/Game";
import { GameShell } from "@/components/game2/GameShell";
import { challengeScenario, getChallenge, getChallengeBySlug, type Challenge } from "@/lib/challenge/challenge";
import { mapForTemplate } from "@/lib/challenge/mapTailor";
import { saveInvite } from "@/lib/integrations/client";
import { store } from "@/lib/store/store";

/** A published challenge from its public link (/c/<slug>), or the admin's sandbox preview (E1.5). */
export function ChallengePlay({ slug, challengeId, sandbox = false }: { slug?: string; challengeId?: string; sandbox?: boolean }) {
  const [c, setC] = useState<Challenge | null | undefined>(undefined);
  useEffect(() => {
    const s = store();
    const found = (slug ? getChallengeBySlug(s, slug) : challengeId ? getChallenge(s, challengeId) : undefined) ?? null;
    // Arrived from an ATS invite (C.2): remember the token so the result goes back to that application.
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (found && invite && !sandbox) saveInvite(found.id, invite);
    setC(found);
  }, [slug, challengeId, sandbox]);

  if (c === undefined) return <div className="p-8" aria-busy="true">Loading…</div>;
  if (c === null) return <main className="mx-auto max-w-xl p-6">This challenge isn&apos;t available.</main>;
  const shell = { id: c.id, title: c.title, company: c.company.name, targetSkills: c.targetSkills };
  // Templates with a v2 map play the map game, with the employer's tailoring and edits applied.
  const map = mapForTemplate(c.templateId);
  if (map) return <GameShell mapId={map.mapId} challenge={shell} sandbox={sandbox} overrides={c.mapOverrides} />;
  return (
    <>
      {sandbox && (
        <p className="sticky top-0 z-30 bg-amber-200 px-4 py-1 text-center text-sm font-medium text-amber-950" role="status">
          Preview as candidate · nothing is saved
        </p>
      )}
      <Game
        scenario={challengeScenario(c)}
        challenge={shell}
        sandbox={sandbox}
      />
    </>
  );
}
