"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Card } from "@/lib/card/types";
import { getChallenge, reusableFor } from "@/lib/challenge/challenge";
import { SKILLS } from "@/lib/engine/skills";
import { deleteMyData } from "@/lib/store/delete";
import { store } from "@/lib/store/store";
import { addWitness, confirmationLine, RELATIONSHIPS, witnessesFor } from "@/lib/witness/witness";

const skillName = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;

// Candidate controls (C6.1, C7.2 to C7.5). Functional version; Haris owns the final layout (#19).
export function CandidateActions({ card, onChange }: { card: Card; onChange: (c: Card) => void }) {
  const router = useRouter();
  const s = store();
  const [, force] = useState(0);
  const refresh = () => force((x) => x + 1);
  const shares = s.listShares().filter((x) => x.attemptId === card.attemptId);
  const activeIds = shares.filter((x) => !x.revokedAt).map((x) => x.challengeId);
  const options = reusableFor(s, card, activeIds);
  const witnesses = witnessesFor(s, card.attemptId);

  const [email, setEmail] = useState("");
  const [rel, setRel] = useState<(typeof RELATIONSHIPS)[number]>("supervisor");
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggleHidden = (id: string) => {
    const next = { ...card, checkpoints: card.checkpoints.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)) };
    s.saveCard(next);
    onChange(next);
  };

  return (
    <div className="space-y-8">
      {card.realStory && (
        <section aria-labelledby="w-h" className="rounded-2xl border p-4" data-testid="witness-form">
          <h2 id="w-h" className="font-semibold">Add a witness (optional)</h2>
          <p className="text-sm opacity-80">Someone who saw your real turning point. Employers see the relationship and their sentence, never their email.</p>
          {confirmationLine(card.realStory.witnesses) && <p className="mt-2 text-sm font-medium">{confirmationLine(card.realStory.witnesses)}</p>}
          {witnesses.length < 2 && (
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                setErr(null);
                try {
                  const r = addWitness(s, { attemptId: card.attemptId, storyTitle: card.realStory!.title, email, relationship: rel, candidateEmail: s.getProfile().email });
                  setLink(`${window.location.origin}${r.link}`);
                  setEmail("");
                  refresh();
                } catch (x) {
                  setErr(x instanceof Error ? x.message : "Could not add witness");
                }
              }}
            >
              <label className="sr-only" htmlFor="w-email">Witness email</label>
              <input id="w-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className="flex-1 rounded-xl border px-3 py-2" />
              <label className="sr-only" htmlFor="w-rel">Relationship</label>
              <select id="w-rel" value={rel} onChange={(e) => setRel(e.target.value as typeof rel)} className="rounded-xl border bg-background px-3 py-2">
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>{r.replace("_", " ")}</option>
                ))}
              </select>
              <button className="rounded-full bg-foreground px-4 py-2 font-medium text-background">Add</button>
            </form>
          )}
          {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
          {link && (
            <p className="mt-2 break-all text-sm" data-testid="witness-link">
              Send them this one-time link (expires in 14 days): <a className="underline" href={link}>{link}</a>
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="share-h" className="rounded-2xl border p-4" data-testid="share">
        <h2 id="share-h" className="font-semibold">Share with another employer</h2>
        <p className="text-sm opacity-80">Same card, no replay. They see it was reused and which of their skills it covers.</p>
        <ul className="mt-3 space-y-2">
          {options.map(({ challenge, overlap }) => (
            <li key={challenge.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                <span className="font-medium">{challenge.company.name}</span> · {challenge.title}
                <span className="block text-xs opacity-70">Covers: {overlap.map(skillName).join(", ")}</span>
              </span>
              <button
                className="rounded-full border px-3 py-1 text-sm"
                data-testid={`share-${challenge.id}`}
                onClick={() => {
                  s.share(card.attemptId, challenge.id, true);
                  refresh();
                }}
              >
                Share
              </button>
            </li>
          ))}
          {!options.length && <li className="text-sm opacity-70">No other open challenges match your skills right now.</li>}
        </ul>
        {shares.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-medium">Shared with</h3>
            <ul className="mt-1 space-y-1">
              {shares.map((sh) => {
                const ch = getChallenge(s, sh.challengeId);
                return (
                  <li key={sh.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {ch ? `${ch.company.name} · ${ch.title}` : sh.challengeId}
                      {sh.reused ? " · reused" : ""}
                      {sh.revokedAt ? " · withdrawn" : ""}
                    </span>
                    {!sh.revokedAt && (
                      <button
                        className="underline"
                        data-testid={`revoke-${sh.challengeId}`}
                        onClick={() => {
                          s.revokeShare(card.attemptId, sh.challengeId);
                          refresh();
                        }}
                      >
                        Withdraw
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="hide-h" className="rounded-2xl border p-4">
        <h2 id="hide-h" className="font-semibold">Hide a clip</h2>
        <p className="text-sm opacity-80">Employers won&apos;t see the recording. The transcript stays, and can&apos;t be edited.</p>
        <ul className="mt-2 space-y-1">
          {card.checkpoints
            .filter((c) => c.media)
            .map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.hidden} onChange={() => toggleHidden(c.id)} data-testid={`hide-${c.id}`} />
                  Hide recording: “{c.question}”
                </label>
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="del-h" className="rounded-2xl border border-red-300 p-4">
        <h2 id="del-h" className="font-semibold">Delete everything</h2>
        <p className="text-sm opacity-80">Removes your profile, runs, cards, recordings, shares and witnesses from this device, right now.</p>
        <button
          className="mt-2 rounded-full bg-red-700 px-4 py-2 font-medium text-white"
          data-testid="delete-all"
          onClick={async () => {
            if (!window.confirm("Delete all your Turning Point data? This can't be undone.")) return;
            await deleteMyData();
            router.push("/");
          }}
        >
          Delete all my data
        </button>
      </section>
    </div>
  );
}
