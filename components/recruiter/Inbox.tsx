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
import { DEMO_PREFIX } from "@/lib/impact/metrics";
import { isPeer } from "@/lib/demo/peers";
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
  // No row is highlighted until J/K is pressed; Enter and S act on the first row until then.
  const [sel, setSel] = useState(-1);
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
      else if (e.key === "Enter" && t.tagName !== "BUTTON" && t.tagName !== "A") open(rows[Math.max(0, sel)]);
      else if (e.key === "s") shortlist(rows[Math.max(0, sel)]);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, sel, open, shortlist]);

  useEffect(() => setSel((i) => Math.min(i, rows.length - 1)), [rows.length]);

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
          Load 200 fictional candidates (3 employers)
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

  const selectCls = "h-11 w-full min-w-0 rounded-lg border border-border bg-card pl-2.5 pr-7 text-sm text-foreground shadow-xs transition-colors hover:border-input/70 sm:h-9 sm:w-auto";
  const synthetic = rows.some((r) => isPeer(r.attemptId) || r.attemptId.startsWith(DEMO_PREFIX));
  return (
    <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-10 sm:pt-8" data-testid="inbox">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-full">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Recruiter inbox</p>
          <h1 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight sm:text-3xl">{challenge?.title ?? "Inbox"}</h1>
          {challenge && (
            <p className="mt-1 text-sm text-muted-foreground">
              {challenge.company.name} · <span className="font-medium text-foreground" data-testid="inbox-count">{rows.length} candidate{rows.length === 1 ? "" : "s"}</span> · Job code {challenge.jobCode}
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label htmlFor="challenge-pick" className="sr-only">Challenge</label>
          <select
            id="challenge-pick"
            value={challenge?.id}
            onChange={(e) => router.push(`/recruiter?challenge=${e.target.value}`)}
            className="h-11 min-w-0 max-w-full flex-1 truncate rounded-lg border border-border bg-card pl-2.5 pr-7 text-sm shadow-xs transition-colors hover:border-input/70 sm:h-9 sm:max-w-72 sm:flex-none"
          >
            {challenges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company.name} · {c.title}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={exportAts} data-testid="send-ats">
            Send shortlist to ATS
          </Button>
        </div>
      </div>

      <SecondLookQueue challengeId={challenge?.id} nameFor={(id) => rows.find((r) => r.attemptId === id)?.displayName} />

      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border/70 px-4 py-2.5">
          <fieldset className="grid w-full grid-cols-2 gap-2 text-sm sm:flex sm:w-auto sm:flex-wrap sm:items-center" aria-label="Filters">
            <label className="sr-only" htmlFor="filter-skill">Skill</label>
            <select
              id="filter-skill"
              className={selectCls}
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
            {filter.skill && (
              <>
                <label className="sr-only" htmlFor="filter-level">At least</label>
                <select id="filter-level" className={selectCls} value={filter.minLevel} onChange={(e) => setFilter((f) => ({ ...f, minLevel: e.target.value as Level }))} data-testid="filter-level">
                  <option value="strong">At least Strong</option>
                  <option value="some">At least Some</option>
                  <option value="not_observed">Any level</option>
                </select>
              </>
            )}
            <label className="sr-only" htmlFor="filter-status">Status</label>
            <select id="filter-status" className={selectCls} value={filter.status ?? ""} onChange={(e) => setFilter((f) => ({ ...f, status: (e.target.value || undefined) as Status | undefined }))} data-testid="filter-status">
              <option value="">Any status</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="filter-witness">Witness</label>
            <select id="filter-witness" className={selectCls} value={filter.witness === undefined ? "" : String(filter.witness)} onChange={(e) => setFilter((f) => ({ ...f, witness: e.target.value === "" ? undefined : e.target.value === "true" }))} data-testid="filter-witness">
              <option value="">Any witness</option>
              <option value="true">Witness confirmed</option>
              <option value="false">Not confirmed</option>
            </select>
            <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <label htmlFor="sort" className="sr-only">Sort</label>
            <select
              id="sort"
              className={selectCls}
              value={sort.by === "final" ? "final" : "default"}
              onChange={(e) => setSort(e.target.value === "final" ? { by: "final" } : filter.skill ? { by: "skill", skill: filter.skill } : { by: "date" })}
              data-testid="sort"
            >
              <option value="default">{filter.skill ? "Sort: Skill evidence" : "Sort: Most recent"}</option>
              <option value="final">Sort: Final score</option>
            </select>
          </fieldset>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <label className="flex min-h-11 items-center gap-2 sm:min-h-0">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={challenge?.anonymousReview ?? true} onChange={(e) => setSettings({ anonymousReview: e.target.checked })} data-testid="anon-toggle" />
              Anonymous first review
            </label>
            <label className="flex min-h-11 items-center gap-2 sm:min-h-0">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={challenge?.transcriptFirst ?? false} onChange={(e) => setSettings({ transcriptFirst: e.target.checked })} data-testid="transcript-first-toggle" />
              Transcript first
            </label>
          </div>
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-sm max-sm:block sm:min-w-[760px]" aria-label="Candidates">
            <thead className="border-b border-border/70 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground max-sm:sr-only">
              <tr>
                <th className="w-10 py-2.5 pl-4 pr-2 font-medium"><span className="sr-only">Compare</span></th>
                <th className="px-3 py-2.5 font-medium">Candidate</th>
                <th className="px-3 py-2.5 font-medium">Top evidence</th>
                <th className="px-3 py-2.5 font-medium">Witness</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="py-2.5 pl-3 pr-4"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {rows.map((r, i) => (
                <tr
                  key={r.attemptId}
                  aria-selected={i === sel}
                  onClick={() => setSel(i)}
                  className={cn("group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40 max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-1 max-sm:px-4 max-sm:py-3 max-sm:[&>td]:p-0", i === sel && "bg-accent/40 hover:bg-accent/40", r.withdrawn && "text-muted-foreground")}
                  data-testid={`row-${r.attemptId}`}
                >
                  <td className="py-2.5 pl-4 pr-2">
                    {!r.withdrawn && (
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
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
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link href={`/recruiter/card/${r.attemptId}?challenge=${challenge?.id}`} className="whitespace-nowrap font-medium underline-offset-2 hover:underline">
                        {r.displayName}
                      </Link>
                      {(isPeer(r.attemptId) || r.attemptId.startsWith(DEMO_PREFIX)) && <span className="whitespace-nowrap rounded border border-dashed border-border px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Synthetic</span>}
                    </div>
                    {r.university && <span className="block text-xs text-muted-foreground">{r.university}</span>}
                    {r.reused && (
                      <span className="block text-xs text-muted-foreground" data-testid={`reused-${r.attemptId}`}>
                        Reused · covers {r.covers.map(skillName).join(", ") || "none"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 max-sm:order-last max-sm:basis-full">
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {r.withdrawn ? (
                        <span>Candidate withdrew this card</span>
                      ) : r.topSkills.length ? (
                        r.topSkills.map((t) => (
                          <span key={t.skill} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {skillName(t.skill)} <LevelBadge level={t.level} />
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No evidence observed</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground max-sm:order-3 max-sm:text-xs">{r.witnessConfirmed ? <span className="text-foreground"><span aria-hidden>✓ </span>Confirmed</span> : "None yet"}</td>
                  <td className="px-3 py-2.5 max-sm:order-3">
                    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", r.status === "new" ? "text-muted-foreground" : "text-foreground")}>
                      <span aria-hidden className={cn("size-1.5 rounded-full", r.status === "shortlist" ? "bg-primary" : r.status === "new" ? "bg-input" : "bg-foreground/50")} />
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground max-sm:order-3 max-sm:text-xs">{new Date(r.date).toLocaleDateString("en-CA")}</td>
                  <td className="py-2.5 pl-3 pr-4 text-right max-sm:order-2 max-sm:ml-auto">
                    {!r.withdrawn &&
                      (r.status === "shortlist" ? (
                        <span className="inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium text-primary">
                          <span aria-hidden>✓</span> Shortlisted
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => shortlist(r)}>
                          Shortlist
                        </Button>
                      ))}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No candidates match. Share the link {challenge ? `/c/${challenge.publicSlug}` : ""} or clear the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant={picked.length >= COMPARE_MIN ? "default" : "outline"}
              disabled={picked.length < COMPARE_MIN || !challenge}
              onClick={() => challenge && router.push(`/recruiter/compare?challenge=${challenge.id}&ids=${picked.join(",")}`)}
              data-testid="compare-open"
            >
              Compare {picked.length ? `(${picked.length})` : ""}
            </Button>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {picked.length < COMPARE_MIN ? `Tick ${COMPARE_MIN} or ${COMPARE_MAX} candidates to compare side by side.` : `${picked.length} picked. Side by side, evidence first.`}
            </span>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            <kbd className="rounded border bg-card px-1 font-mono text-[10px]">J</kbd> <kbd className="rounded border bg-card px-1 font-mono text-[10px]">K</kbd> move · <kbd className="rounded border bg-card px-1 font-mono text-[10px]">Enter</kbd> open · <kbd className="rounded border bg-card px-1 font-mono text-[10px]">S</kbd> shortlist
          </p>
        </div>
      </div>
      <p className="mt-3 max-w-4xl text-xs leading-relaxed text-muted-foreground">
        Levels show evidence found in candidates&apos; own words. Not observed is not a negative judgment. Sorted by {sort.by === "skill" ? `${skillName(sort.skill)} evidence` : sort.by === "final" ? "Final score" : "most recent"}. The Final score only sorts; it never hides or rejects anyone. <Link href="/how-scores-work" className="underline underline-offset-2 hover:text-foreground">How scores work</Link>
        {synthetic && <> Rows marked Synthetic are fictional demo candidates.</>}
      </p>

      {toast && (
        <div role="status" className="tp-pop fixed bottom-4 left-4 right-4 z-50 max-w-md rounded-xl border bg-card p-4 text-sm shadow-lg sm:left-auto" data-testid="toast">
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
