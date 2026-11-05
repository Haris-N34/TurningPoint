"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Card } from "@/lib/card/types";
import { getChallenge, reusableFor } from "@/lib/challenge/challenge";
import { SKILLS } from "@/lib/engine/skills";
import { deleteMyData } from "@/lib/store/delete";
import { store } from "@/lib/store/store";
import { addWitness, confirmationLine, MAX_WITNESSES, RELATIONSHIPS, witnessesFor } from "@/lib/witness/witness";
import { RELATIONSHIP_LABELS, witnessStatus } from "@/components/witness/labels";

const skillName = (slug: string) => SKILLS.find((s) => s.slug === slug)?.name ?? slug;

// Candidate controls (C6.1, C7.2 to C7.5). Keep transcripts immutable and share/revoke actions explicit.
export function CandidateActions({ card, onChange }: { card: Card; onChange: (c: Card) => void }) {
  const router = useRouter();
  const s = store();
  const [, force] = useState(0);
  const refresh = () => force((x) => x + 1);
  const shares = s.listShares().filter((x) => x.attemptId === card.attemptId);
  const activeIds = shares.filter((x) => !x.revokedAt).map((x) => x.challengeId);
  const options = reusableFor(s, card, activeIds);
  const witnesses = witnessesFor(s, card.attemptId);

  const [name, setName] = useState("");
  const [linkName, setLinkName] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [rel, setRel] = useState<(typeof RELATIONSHIPS)[number]>("supervisor");
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggleHidden = (id: string) => {
    const next = { ...card, checkpoints: card.checkpoints.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)) };
    s.saveCard(next);
    onChange(next);
    setNotice("Recording visibility updated. Your transcript is unchanged.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <p role="status" className="text-sm text-primary lg:col-span-2">{notice}</p>
      {card.realStory && (
        <section aria-labelledby="w-h" className="rounded-xl border bg-card p-5 shadow-card sm:p-6" data-testid="witness-form">
          <h2 id="w-h" className="text-base font-semibold">Add a witness (optional)</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Someone who saw your real turning point. Employers see the relationship and their sentence, never their email.</p>
          {confirmationLine(card.realStory.witnesses) && <p className="mt-2 text-sm font-medium">{confirmationLine(card.realStory.witnesses)}</p>}
          <div className="mt-5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Your witnesses</h3>
            <p className="text-xs text-muted-foreground" data-testid="witness-slots">{witnesses.length} of {MAX_WITNESSES} witnesses added</p>
          </div>
          <ul className="mt-2 space-y-2" data-testid="witness-list">
            {witnesses.map((w, i) => {
              const status = witnessStatus(w);
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                  <span><span className="font-medium">Witness {i + 1}</span> · {RELATIONSHIP_LABELS[w.relationship]}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status === "Confirmed" ? "border-primary text-primary" : "text-muted-foreground"}`}>
                    <span aria-hidden>{status === "Confirmed" ? "✓ " : status === "Waiting for reply" ? "… " : "· "}</span>{status}
                  </span>
                </li>
              );
            })}
          </ul>
          {!witnesses.length && <p className="mt-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">No witnesses yet. Add someone who saw your real turning point.</p>}
          {witnesses.length >= MAX_WITNESSES && <p className="mt-4 text-sm text-muted-foreground">Both witness slots are in use.</p>}
          {witnesses.length < MAX_WITNESSES && (
            <form
              className="mt-5 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setErr(null);
                try {
                  const r = addWitness(s, { attemptId: card.attemptId, storyTitle: card.realStory!.title, email, relationship: rel, candidateEmail: s.getProfile().email });
                  setLink(`${window.location.origin}${r.link}`);
                  setLinkName(name.trim());
                  setName("");
                  setNotice("Witness link created. No email was sent.");
                  setEmail("");
                  refresh();
                } catch (x) {
                  setErr(x instanceof Error ? x.message : "Could not add witness");
                }
              }}
            >
              <label htmlFor="w-name" className="text-sm font-medium">Witness name (optional, for this link)</label>
              <input id="w-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="min-h-11 w-full rounded-md border bg-background px-3" />
              <p className="text-xs text-muted-foreground">The name stays on this page and is not stored or shared with employers.</p>
              <label className="text-sm font-medium" htmlFor="w-email">Witness email</label>
              <input id="w-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className="min-h-11 w-full rounded-md border bg-background px-3 py-2" />
              <label className="text-sm font-medium" htmlFor="w-rel">Relationship</label>
              <select id="w-rel" value={rel} onChange={(e) => setRel(e.target.value as typeof rel)} className="min-h-11 w-full rounded-md border bg-background px-3 py-2">
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>
                ))}
              </select>
              <button className="min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 justify-self-start">Add</button>
            </form>
          )}
          {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
          {link && (
            <p className="mt-2 break-all text-sm" data-testid="witness-link">
              Link {linkName ? `for ${linkName}` : "for your witness"} (expires in 14 days). No email was sent. Open it in this browser for the local demo: <a className="underline" href={link}>{link}</a>
            </p>
          )}
          {link && <button type="button" className="mt-3 min-h-11 rounded-md border px-4 text-sm font-medium" onClick={async () => { try { await navigator.clipboard.writeText(link); setNotice("Witness link copied. No email was sent."); } catch { setNotice("Copy is unavailable. Select and copy the displayed witness link."); } }}>Copy witness link</button>}
        </section>
      )}

      <section aria-labelledby="share-h" className="rounded-xl border bg-card p-5 shadow-card sm:p-6" data-testid="share">
        <h2 id="share-h" className="text-base font-semibold">Share with another employer</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Same card, no replay. They see it was reused and which of their skills it covers.</p>
        <ul className="mt-3 space-y-2">
          {options.map(({ challenge, overlap }) => (
            <li key={challenge.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                <span className="font-medium">{challenge.company.name}</span> · {challenge.title}
                <span className="block text-xs opacity-70">Covers: {overlap.map(skillName).join(", ")}</span>
              </span>
              <button
                className="min-h-11 rounded-md border px-4 py-2 text-sm font-medium"
                data-testid={`share-${challenge.id}`}
                onClick={() => {
                  s.share(card.attemptId, challenge.id, true);
                  setNotice(`Card shared with ${challenge.company.name}. No replay needed.`);
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
                        className="min-h-11 shrink-0 px-3 underline underline-offset-4"
                        data-testid={`revoke-${sh.challengeId}`}
                        onClick={() => {
                          s.revokeShare(card.attemptId, sh.challengeId);
                          setNotice("Share withdrawn. That employer can no longer open your card.");
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

      <section aria-labelledby="hide-h" className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <h2 id="hide-h" className="text-base font-semibold">Hide a clip</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Employers won&apos;t see the recording. The transcript stays, and can&apos;t be edited.</p>
        {!card.checkpoints.some((c) => c.media) && <p className="mt-4 text-sm text-muted-foreground">This card has no saved recordings to hide. Text answers remain part of your evidence.</p>}
        <ul className="mt-2 space-y-1">
          {card.checkpoints
            .filter((c) => c.media)
            .map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" checked={c.hidden} onChange={() => toggleHidden(c.id)} data-testid={`hide-${c.id}`} />
                  Hide recording: “{c.question}”
                </label>
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="del-h" className="rounded-xl border border-destructive/30 bg-card p-5 sm:p-6">
        <h2 id="del-h" className="text-base font-semibold">Delete everything</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Removes your profile, runs, cards, recordings, shares and witnesses from this device, right now.</p>
        <button
          className="mt-4 min-h-11 rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground"
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
