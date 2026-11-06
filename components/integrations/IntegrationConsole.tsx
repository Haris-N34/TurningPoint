"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listChallenges, type Challenge } from "@/lib/challenge/challenge";
import { seedDemo } from "@/lib/demo/seed";
import { CONSOLE_LOCKED, consoleNeedsSecret, integrationsApi, setCompanyId, setConsoleSecret } from "@/lib/integrations/client";
import type { Connection, Delivery, Provider, SecondLookEntry, SimEmail, WebhookEvent } from "@/lib/integrations/store";
import { store } from "@/lib/store/store";

// Integration console (PRD v2 C2, C.10): connect the mock ATS, map requisitions to challenges, watch
// the live webhook log with payloads, re-send failed deliveries, rotate keys.

type Applicant = { id: string; jobId: string; name: string; email: string; status: string; stage: string; reviewed: boolean; hasResume: boolean };
type Job = { id: string; title: string; requisitionId?: string; status: string; applicants: Applicant[] };
type State = {
  company: { id: string; name: string };
  providers: { provider: Provider; label: string; connected: boolean; connection: Connection | null; failNext: number }[];
  jobs: Record<Provider, Job[]>;
  webhookUrl: string;
  webhookSecret: string;
  secretRotatedAt: string;
  apiKeys: { id: string; prefix: string; createdAt: string; revokedAt?: string }[];
  events: WebhookEvent[];
  deliveries: Delivery[];
  emails: SimEmail[];
  secondLook: SecondLookEntry[];
  stats: { queued: number; rescued: number; confirmedPass: number };
};

const SAMPLE_RESUME = `Ada Obi
ada.obi@example.com | (587) 555-0110

Experience
Shift Lead at Northwind Coffee (2024 - 2025)
- Led a team of 6 and rebuilt the weekend schedule when two staff quit
- Tracked waste in a spreadsheet and cut it by 30%`;

export function IntegrationConsole() {
  const [s, setS] = useState<State | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [keyOnce, setKeyOnce] = useState<string | null>(null);
  const [applicant, setApplicant] = useState({ name: "Ada Obi", email: "ada.obi@example.com", resume: true });

  const load = useCallback(async () => {
    if (await consoleNeedsSecret()) return setError(CONSOLE_LOCKED);
    integrationsApi<State>("state")
      .then((x) => {
        setS(x);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("company");
    if (fromUrl) setCompanyId(fromUrl);
    const st = store();
    if (!listChallenges(st).some((c) => c.status === "published")) seedDemo(st);
    setChallenges(listChallenges(st).filter((c) => c.status === "published"));
    load();
    // Live log: poll while the console is open.
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (path: string, body: unknown = {}) => {
    setError(null);
    try {
      const r = await integrationsApi<Record<string, unknown>>(path, body);
      load();
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  // A locked deploy (TP_CONSOLE_SECRET) answers 401: ask for the secret once per tab, then retry.
  const unlock = error === CONSOLE_LOCKED && (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4 shadow-card"
      data-testid="console-secret"
      onSubmit={(e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget).get("secret");
        if (typeof v === "string" && v.trim()) {
          setConsoleSecret(v.trim());
          load();
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="console-secret-input" className="block text-sm font-medium">Console secret required</label>
        <p className="text-xs text-muted-foreground">This deploy locks the integration console. The secret stays in this tab only.</p>
        <input id="console-secret-input" name="secret" type="password" autoComplete="off" className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" />
      </div>
      <Button type="submit">Unlock</Button>
    </form>
  );

  if (!s) return <div className="mx-auto max-w-xl p-8" aria-busy={!unlock}>{unlock || error || "Loading…"}</div>;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 sm:px-10" data-testid="integration-console">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Admin · Integrations</p>
          <h1 className="mt-2 font-display text-3xl">ATS integration console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.company.name} · tenant <code>{s.company.id}</code> · Both ATS connections are mocks we run ourselves. No real ATS or email is contacted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Button
            variant="outline"
            onClick={async () => {
              const r = await integrationsApi<{ id: string; webhookSecret: string }>("companies", { name: "Prairie Grid Energy (fictional)" });
              setCompanyId(r.id);
              setSecretOnce(r.webhookSecret);
              load();
            }}
            data-testid="fresh-company"
          >
            Start a fresh demo tenant
          </Button>
          <Button asChild variant="link">
            <Link href="/developers">API docs</Link>
          </Button>
        </div>
      </header>
      {unlock}
      {error && error !== CONSOLE_LOCKED && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <section aria-labelledby="ats-h" className="space-y-4">
        <h2 id="ats-h" className="text-lg font-semibold">ATS connections</h2>
        {s.providers.map((p) => (
          <div key={p.provider} className="rounded-xl border bg-card p-4 shadow-card" data-testid={`provider-${p.provider}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {p.label} <Badge variant="outline">Mock</Badge> {p.connected ? <Badge>Connected</Badge> : <Badge variant="secondary">Not connected</Badge>}
              </p>
              <div className="flex flex-wrap gap-2">
                {p.connected ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => run("simulate", { provider: p.provider, action: "failNext", count: 5 })} data-testid={`fail-${p.provider}`}>
                      Make next deliveries fail{p.failNext ? ` (${p.failNext} left)` : ""}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => run("disconnect", { provider: p.provider })}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => run("connect", { provider: p.provider })} data-testid={`connect-${p.provider}`}>
                    Connect
                  </Button>
                )}
              </div>
            </div>
            {p.connected && (
              <div className="mt-3 space-y-3">
                {s.jobs[p.provider].map((j) => {
                  const m = p.connection?.mappings.find((x) => x.jobId === j.id);
                  return (
                    <div key={j.id} className="rounded-lg border p-3" data-testid={`job-${p.provider}-${j.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <p>
                          <span className="font-medium">{j.title}</span> <span className="text-muted-foreground">· requisition {j.requisitionId ?? j.id}</span>
                        </p>
                        <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                          <span className="text-xs text-muted-foreground">Challenge</span>
                          <select
                            className="min-h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 sm:w-72"
                            value={m?.challengeId ?? ""}
                            data-testid={`map-${p.provider}-${j.id}`}
                            onChange={(e) => {
                              const c = challenges.find((x) => x.id === e.target.value);
                              if (!c) return run("unmap", { provider: p.provider, jobId: j.id });
                              run("map", { provider: p.provider, jobId: j.id, challengeId: c.id, slug: c.publicSlug, title: c.title, targetSkills: c.targetSkills });
                            }}
                          >
                            <option value="">Not linked</option>
                            {challenges.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.company.name} · {c.title}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {j.applicants.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2" data-testid={`applicant-${a.id}`}>
                            <span>
                              {a.name} · <span className="capitalize">{a.status}</span> · {a.stage}
                              {!a.reviewed && a.status === "active" ? " · not reviewed" : ""}
                            </span>
                            {a.status === "active" ? (
                              <Button size="sm" variant="outline" onClick={() => run("simulate", { provider: p.provider, action: "reject", applicantId: a.id })} data-testid={`reject-${a.id}`}>
                                Reject at resume screen
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => run("simulate", { provider: p.provider, action: "activate", applicantId: a.id })}>
                                Set active
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                      <form
                        className="mt-2 flex flex-wrap items-end gap-2 text-sm"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run("simulate", { provider: p.provider, action: "apply", jobId: j.id, name: applicant.name, email: applicant.email, resumeText: applicant.resume ? SAMPLE_RESUME : undefined });
                        }}
                      >
                        <label className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Applicant name</span>
                          <input value={applicant.name} onChange={(e) => setApplicant({ ...applicant, name: e.target.value })} className="min-h-9 rounded-md border px-2" />
                        </label>
                        <label className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Email</span>
                          <input value={applicant.email} onChange={(e) => setApplicant({ ...applicant, email: e.target.value })} className="min-h-9 rounded-md border px-2" />
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={applicant.resume} onChange={(e) => setApplicant({ ...applicant, resume: e.target.checked })} /> With resume
                        </label>
                        <Button size="sm" type="submit" data-testid={`apply-${p.provider}-${j.id}`}>
                          New application
                        </Button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="wh-h" className="rounded-xl border bg-card p-4 shadow-card">
          <h2 id="wh-h" className="font-semibold">Webhook log (live)</h2>
          <p className="text-xs text-muted-foreground">Inbound events, signature checked with HMAC-SHA256, 5-minute window, idempotency keys.</p>
          <ul className="mt-2 max-h-[28rem] space-y-2 overflow-auto text-sm" data-testid="webhook-log">
            {s.events.length === 0 && <li className="text-muted-foreground">No events yet.</li>}
            {s.events.map((e) => (
              <li key={e.id} className="rounded-lg border p-2" data-outcome={e.outcome}>
                <p>
                  <Badge variant={e.outcome === "processed" ? "default" : e.outcome === "duplicate" ? "secondary" : "outline"}>{e.outcome}</Badge> {e.type ?? "unknown"}{" "}
                  <span className="text-xs text-muted-foreground">{new Date(e.receivedAt).toLocaleTimeString("en-CA")}</span>
                  {e.reason && <span className="ml-1 text-destructive">{e.reason}</span>}
                </p>
                {e.actions.map((a, i) => (
                  <p key={i} className="text-xs">
                    → {a}
                  </p>
                ))}
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Payload</summary>
                  <pre tabIndex={0} className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(e.payload, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="dl-h" className="rounded-xl border bg-card p-4 shadow-card">
          <h2 id="dl-h" className="font-semibold">Outbound deliveries</h2>
          <p className="text-xs text-muted-foreground">Results posted to the ATS on attempt finish. Exponential backoff; every call logged.</p>
          <ul className="mt-2 max-h-[28rem] space-y-2 overflow-auto text-sm" data-testid="delivery-log">
            {s.deliveries.length === 0 && <li className="text-muted-foreground">No deliveries yet.</li>}
            {s.deliveries.map((d) => (
              <li key={d.id} className="rounded-lg border p-2" data-testid={`delivery-${d.id}`} data-status={d.status}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <Badge variant={d.status === "delivered" ? "default" : d.status === "failed" ? "outline" : "secondary"}>{d.status}</Badge> {d.kind} → {d.provider} application {d.applicantId}
                  </p>
                  {d.status === "failed" && (
                    <Button size="sm" onClick={() => run(`deliveries/${d.id}/resend`)} data-testid="resend">
                      Re-send
                    </Button>
                  )}
                </div>
                <ol className="mt-1 list-decimal pl-5 text-xs">
                  {d.attempts.map((a, i) => (
                    <li key={i}>
                      {a.ok ? "OK" : `Failed (${a.status || "network"}): ${a.error}`}
                      {a.waitMs ? `, retried after ${a.waitMs} ms` : ""}
                    </li>
                  ))}
                </ol>
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Payload</summary>
                  <pre tabIndex={0} className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(d.payload, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="em-h" className="rounded-xl border bg-card p-4 shadow-card">
          <h2 id="em-h" className="font-semibold">Simulated invite emails</h2>
          <p className="text-xs text-muted-foreground">Not sent. Shown here so you can open the unique link.</p>
          <ul className="mt-2 space-y-2 text-sm" data-testid="email-log">
            {s.emails.length === 0 && <li className="text-muted-foreground">No invites yet.</li>}
            {s.emails.map((m) => {
              const link = m.body.match(/\/c\/\S+/)?.[0];
              return (
                <li key={m.id} className="rounded-lg border p-2">
                  <p className="font-medium">To {m.to}</p>
                  <p className="text-xs">{m.subject}</p>
                  {link && (
                    <Link href={link} className="break-all text-xs underline" data-testid="invite-link">
                      {link}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="keys-h" className="rounded-xl border bg-card p-4 shadow-card">
          <h2 id="keys-h" className="font-semibold">Keys</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Webhook URL</dt>
              <dd>
                <code>{s.webhookUrl}</code>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Signing secret (rotated {new Date(s.secretRotatedAt).toLocaleString("en-CA")})</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <code data-testid="secret-masked">{s.webhookSecret}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const r = await run("secret/rotate");
                    if (r) setSecretOnce(String(r.webhookSecret));
                  }}
                  data-testid="rotate-secret"
                >
                  Rotate
                </Button>
              </dd>
            </div>
          </dl>
          {secretOnce && (
            <p className="mt-2 rounded bg-muted p-2 text-xs" data-testid="secret-once">
              New secret, shown once: <code className="break-all">{secretOnce}</code>
            </p>
          )}
          <h3 className="mt-4 text-sm font-medium">API keys (stored hashed)</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {s.apiKeys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2">
                <code>{k.prefix}…</code>
                {k.revokedAt ? (
                  <span className="text-xs text-muted-foreground">Revoked</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => run(`keys/${k.id}/revoke`)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            className="mt-2"
            onClick={async () => {
              const r = await run("keys");
              if (r) setKeyOnce(String(r.key));
            }}
            data-testid="create-key"
          >
            Create API key
          </Button>
          {keyOnce && (
            <p className="mt-2 rounded bg-muted p-2 text-xs" data-testid="key-once">
              Copy it now, it is shown once: <code className="break-all">{keyOnce}</code>
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="slc-h" className="rounded-xl border bg-card p-4 shadow-card">
        <h2 id="slc-h" className="font-semibold">Second Look</h2>
        <p className="text-sm" data-testid="console-rescued">
          {s.stats.queued} waiting · {s.stats.rescued} rescued this season · {s.stats.confirmedPass} pass confirmed
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => run("second-look/sweep", {})}>
          Check never-reviewed applicants
        </Button>
        <ul className="mt-2 space-y-1 text-sm">
          {s.secondLook.map((e) => (
            <li key={e.id}>
              {e.reason} · <span className="capitalize">{e.status.replace("_", " ")}</span>{" "}
              <Link className="underline" href={`/recruiter/card/${e.attemptId}?challenge=${e.challengeId}`}>
                Card
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
