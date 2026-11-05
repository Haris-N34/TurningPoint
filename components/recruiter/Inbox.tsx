"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LevelBadge, skillName } from "@/components/card/CapabilityCard";
import { Button } from "@/components/ui/button";
import { buildExport, sendToAts, type GreenhousePayload } from "@/lib/ats/ats";
import { type InboxFilter, type InboxRow, type InboxSort, type Level, type Status } from "@/lib/card/inbox";
import { COMPARE_MAX, COMPARE_MIN } from "@/lib/card/compare";
import { decide, inboxFor } from "@/lib/card/recruiter";
import { listChallenges, updateSettings, type Challenge } from "@/lib/challenge/challenge";
import { seedDemo } from "@/lib/demo/seed";
import { seedImpactDemo } from "@/lib/impact/seed";
import type { SkillSlug } from "@/lib/engine/skills";
import { store } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { SecondLookQueue } from "./SecondLook";

const STATUS_LABEL: Record<Status, string> = { new: "New", shortlist: "Shortlisted", hold: "On hold", pass: "Passed", withdrawn: "Withdrawn" };

// Candidate inbox (E2): one table per challenge, filters, sorting, keyboard review, fair-review settings, ATS export.
export function Inbox() {
  const router = useRouter();
  const params = useSearchParams();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<InboxFilter>({});
  const [sort, setSort] = useState<InboxSort>({ by: "date" });
  const [sel, setSel] = useState(0);
  // E4.1: pick 2 or 3 cards to compare, in the order picked.
  const [picked, setPicked] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; payload?: GreenhousePayload } | null>(null);

  useEffect(() => setChallenges(listChallenges(store()).filter((c) => c.status === "published")), [version]);
  const challengeId = params.get("challenge") ?? challenges?.[0]?.id;
  useEffect(() => setPicked([]), [challengeId]);
  const challenge = challenges?.find((c) => c.id === challengeId);

  const rows: InboxRow[] = useMemo(() => {
    if (!challenge) return [];
    void version;
    return inboxFor(store(), challenge.id, challenge.targetSkills as SkillSlug[], { anonymous: challenge.anonymousReview, filter, sort });
  }, [challenge, filter, sort, version]);

  const open = useCallback(
    (r: InboxRow | undefined) => r && challenge && router.push(`/recruiter/card/${r.attemptId}?challenge=${challenge.id}`),
    [challenge, router],
  );
  const shortlist = useCallback(
    (r: InboxRow | undefined) => {
      if (!r || !challenge || r.withdrawn) return;
      decide(store(), r.attemptId, challenge.id, "shortlist");
      setToast({ text: `Shortlisted ${r.anonymous ? r.displayName : "candidate"}` });
      setVersion((v) => v + 1);
    },
    [challenge],
  );

  // J/K move, Enter opens, S shortlists (E2.3). Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j") setSel((i) => Math.min(rows.length - 1, i + 1));
      else if (e.key === "k") setSel((i) => Math.max(0, i - 1));
      else if (e.key === "Enter" && t.tagName !== "BUTTON" && t.tagName !== "A") open(rows[sel]);
      else if (e.key === "s") shortlist(rows[sel]);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, sel, open, shortlist]);

  useEffect(() => setSel((i) => Math.min(i, Math.max(0, rows.length - 1))), [rows.length]);

  if (challenges === null) return <PageSkeleton />;

  if (!challenges.length) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl">Your inbox is empty</h1>
        <p className="mt-3 text-muted-foreground">No published challenges yet. Create one as Admin, or load the demo employers.</p>
        <Button
          className="mt-6"
          onClick={() => {
            seedDemo(store());
            setVersion((v) => v + 1);
          }}
        >
          Load demo data
        </Button>
        <Button
          className="ml-3 mt-6"
          variant="outline"
          onClick={() => {
            seedImpactDemo(store());
            setVersion((v) => v + 1);
          }}
        >
          Load 200 fictional candidates
        </Button>
      </main>
    );
  }

  const skills = (challenge?.targetSkills ?? []) as SkillSlug[];
  const setSettings = (s: Partial<Pick<Challenge, "anonymousReview" | "transcriptFirst">>) => {
    if (!challenge) return;
    const updated = updateSettings(store(), challenge.id, s);
    // Update local state in the same tick so the controlled checkbox never shows the old value.
    setChallenges((list) => list?.map((c) => (c.id === updated.id ? updated : c)) ?? null);
  };

  const exportAts = async () => {
    if (!challenge) return;
    const payload = buildExport(store(), challenge, window.location.origin);
    try {
      const r = await sendToAts(store(), payload);
      setToast({ text: `Sent ${r.received} shortlisted candidate${r.received === 1 ? "" : "s"} to Greenhouse (mock)`, payload });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Export failed" });
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 sm:px-10" data-testid="inbox">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-full">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Recruiter inbox</p>
          <label htmlFor="challenge-pick" className="sr-only">Challenge</label>
          <select
            id="challenge-pick"
            value={challenge?.id}
            onChange={(e) => router.push(`/recruiter?challenge=${e.target.value}`)}
            className="mt-2 min-h-11 w-full max-w-full truncate rounded-md border border-input bg-background px-3 font-display text-xl sm:w-auto"
          >
            {challenges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company.name} · {c.title}
              </option>
            ))}
          </select>
          {challenge && <p className="mt-1 text-sm text-muted-foreground">Job code {challenge.jobCode} · Skills: {skills.map(skillName).join(", ")}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={challenge?.anonymousReview ?? true} onChange={(e) => setSettings({ anonymousReview: e.target.checked })} data-testid="anon-toggle" />
            Anonymous first review
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={challenge?.transcriptFirst ?? false} onChange={(e) => setSettings({ transcriptFirst: e.target.checked })} data-testid="transcript-first-toggle" />
            Transcript first
          </label>
          <Button variant="outline" onClick={exportAts} data-testid="send-ats">
            Send shortlist to ATS
          </Button>
        </div>
      </div>

      <SecondLookQueue challengeId={challenge?.id} nameFor={(id) => rows.find((r) => r.attemptId === id)?.displayName} />

      <fieldset className="mt-6 flex flex-wrap items-end gap-3 text-sm" aria-label="Filters">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Skill</span>
          <select
            className="min-h-11 rounded-md border border-input bg-background px-2"
            value={filter.skill ?? ""}
            onChange={(e) => {
              const skill = (e.target.value || undefined) as SkillSlug | undefined;
              setFilter((f) => ({ ...f, skill, minLevel: skill ? f.minLevel ?? "some" : undefined }));
              setSort(skill ? { by: "skill", skill } : { by: "date" });
            }}
            data-testid="filter-skill"
          >
            <option value="">Any skill</option>
            {skills.map((s) => (
              <option key={s} value={s}>{skillName(s)}</option>
            ))}
          </select>
        </label>
        {filter.skill && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">At least</span>
            <select className="min-h-11 rounded-md border border-input bg-background px-2" value={filter.minLevel} onChange={(e) => setFilter((f) => ({ ...f, minLevel: e.target.value as Level }))} data-testid="filter-level">
              <option value="strong">Strong</option>
              <option value="some">Some</option>
              <option value="not_observed">Any</option>
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <select className="min-h-11 rounded-md border border-input bg-background px-2" value={filter.status ?? ""} onChange={(e) => setFilter((f) => ({ ...f, status: (e.target.value || undefined) as Status | undefined }))} data-testid="filter-status">
            <option value="">Any</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Witness</span>
          <select className="min-h-11 rounded-md border border-input bg-background px-2" value={filter.witness === undefined ? "" : String(filter.witness)} onChange={(e) => setFilter((f) => ({ ...f, witness: e.target.value === "" ? undefined : e.target.value === "true" }))} data-testid="filter-witness">
            <option value="">Any</option>
            <option value="true">Confirmed</option>
            <option value="false">Not confirmed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Sort</span>
          <select
            className="min-h-11 rounded-md border border-input bg-background px-2"
            value={sort.by === "final" ? "final" : "default"}
            onChange={(e) => setSort(e.target.value === "final" ? { by: "final" } : filter.skill ? { by: "skill", skill: filter.skill } : { by: "date" })}
            data-testid="sort"
          >
            <option value="default">{filter.skill ? "Skill evidence" : "Most recent"}</option>
            <option value="final">Final score</option>
          </select>
        </label>
        <p className="ml-auto text-xs text-muted-foreground">Keys: J/K move · Enter open · S shortlist</p>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <Button
          size="sm"
          disabled={picked.length < COMPARE_MIN || !challenge}
          onClick={() => challenge && router.push(`/recruiter/compare?challenge=${challenge.id}&ids=${picked.join(",")}`)}
          data-testid="compare-open"
        >
          Compare {picked.length ? `(${picked.length})` : ""}
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {picked.length < COMPARE_MIN ? `Pick ${COMPARE_MIN} or ${COMPARE_MAX} cards to compare side by side.` : `${picked.length} picked. Side by side, evidence first.`}
        </span>
      </div>

      <div className="relative mt-4 overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm" aria-label="Candidates">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium"><span className="sr-only">Compare</span></th>
              <th className="px-4 py-3 font-medium">Candidate</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Top evidence</th>
              <th className="px-4 py-3 font-medium">Witness</th>
              <th className="px-4 py-3 font-medium">Reused</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.attemptId}
                aria-selected={i === sel}
                onClick={() => setSel(i)}
                className={cn("border-b last:border-0", i === sel && "bg-accent/50", r.withdrawn && "text-muted-foreground")}
                data-testid={`row-${r.attemptId}`}
              >
                <td className="px-4 py-3">
                  {!r.withdrawn && (
                    <input
                      type="checkbox"
                      className="size-5"
                      aria-label={`Compare ${r.displayName}`}
                      checked={picked.includes(r.attemptId)}
                      disabled={!picked.includes(r.attemptId) && picked.length >= COMPARE_MAX}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setPicked((p) => (on ? [...p, r.attemptId].slice(0, COMPARE_MAX) : p.filter((x) => x !== r.attemptId)));
                      }}
                      data-testid={`pick-${r.attemptId}`}
                    />
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/recruiter/card/${r.attemptId}?challenge=${challenge?.id}`} className="underline-offset-2 hover:underline">
                    {r.displayName}
                  </Link>
                  {r.university && <span className="block text-xs text-muted-foreground">{r.university}</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">{new Date(r.date).toLocaleDateString("en-CA")}</td>
                <td className="px-4 py-3">{STATUS_LABEL[r.status]}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {r.withdrawn ? (
                      <span>Candidate withdrew this card</span>
                    ) : r.topSkills.length ? (
                      r.topSkills.map((t) => (
                        <span key={t.skill} className="flex items-center gap-1 text-xs">
                          {skillName(t.skill)} <LevelBadge level={t.level} />
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No evidence observed</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{r.witnessConfirmed ? "Confirmed" : "No"}</td>
                <td className="px-4 py-3">
                  {r.reused ? (
                    <span className="text-xs" data-testid={`reused-${r.attemptId}`}>
                      Reused · covers {r.covers.map(skillName).join(", ") || "none"}
                    </span>
                  ) : (
                    "No"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!r.withdrawn && r.status !== "shortlist" && (
                    <Button size="sm" variant="outline" onClick={() => shortlist(r)}>
                      Shortlist
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No candidates match. Share the link {challenge ? `/c/${challenge.publicSlug}` : ""} or clear the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Levels show evidence found in candidates&apos; own words. Not observed is not a negative judgment. Sorted by {sort.by === "skill" ? `${skillName(sort.skill)} evidence` : sort.by === "final" ? "Final score" : "most recent"}. The Final score only sorts; it never hides or rejects anyone. <Link href="/how-scores-work" className="underline">How scores work</Link>
      </p>

      {toast && (
        <div role="status" className="fixed bottom-4 left-4 right-4 z-50 max-w-md rounded-xl sm:left-auto border bg-card p-4 text-sm shadow-card" data-testid="toast">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{toast.text}</p>
            <button type="button" aria-label="Dismiss" onClick={() => setToast(null)} className="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground">✕</button>
          </div>
          {toast.payload && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">Payload</summary>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(toast.payload, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </main>
  );
}
