"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { skillName } from "@/components/card/CapabilityCard";
import { ADDON_MINUTES, addonsForAttempt, type Addon } from "@/lib/addon/addon";
import { getChallenge } from "@/lib/challenge/challenge";
import { store } from "@/lib/store/store";

// E8.2: candidate side. Pending add-on requests for any of this device's cards.
export function AddonList() {
  const [list, setList] = useState<Addon[]>([]);
  useEffect(() => {
    const s = store();
    setList(s.listCards().flatMap((c) => addonsForAttempt(s, c.attemptId)).filter((a) => a.status === "requested"));
  }, []);
  if (!list.length) return null;
  return (
    <ul className="space-y-2" data-testid="addon-list">
      {list.map((a) => (
        <li key={a.id} className="rounded-xl border p-3 text-sm">
          <p className="font-medium">{getChallenge(store(), a.challengeId)?.company.name ?? "An employer"} asked for a short add-on</p>
          <p className="text-muted-foreground">{ADDON_MINUTES} minutes, on {a.skills.map(skillName).join(", ")}. Optional.</p>
          <Link href={`/addon/${a.id}`} className="underline" data-testid={`addon-open-${a.id}`}>Start the add-on</Link>
        </li>
      ))}
    </ul>
  );
}
