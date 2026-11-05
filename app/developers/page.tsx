import type { Metadata } from "next";
import Link from "next/link";
import { ApiTryIt } from "@/components/integrations/ApiTryIt";
import { openApiSpec } from "@/lib/integrations/api";

export const metadata: Metadata = { title: "Developers · Turning Point" };
export const dynamic = "force-dynamic";

// Public API docs (C.4), rendered from the OpenAPI document that is generated from the Zod schemas.
export default function Developers() {
  const spec = openApiSpec();
  const ops = Object.entries(spec.paths).map(([path, item]) => {
    const op = (item as { get: { operationId: string; summary: string; parameters?: { name: string; in: string; required: boolean; description?: string }[]; responses: Record<string, { description: string }> } }).get;
    return { path, ...op };
  });
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12 sm:px-10" data-testid="developers">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Developers · API v{spec.info.version}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight">{spec.info.title}</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">{spec.info.description}</p>
        <p className="mt-3 text-sm">
          Base URL <code>/api/v1</code> · Auth <code>Authorization: Bearer &lt;key&gt;</code> · Create a key in{" "}
          <Link className="underline" href="/admin/integrations">
            /admin/integrations
          </Link>{" "}
          · OpenAPI:{" "}
          <a className="underline" href="/api/v1/openapi.json" data-testid="openapi-link">
            /api/v1/openapi.json
          </a>
        </p>
      </header>

      <ApiTryIt operations={ops.map((o) => ({ path: o.path, operationId: o.operationId, summary: o.summary }))} />

      <section aria-labelledby="ep-h" className="space-y-4">
        <h2 id="ep-h" className="text-xl font-semibold">Endpoints</h2>
        {ops.map((o) => (
          <article key={o.path} className="rounded-xl border bg-card p-4 shadow-card" data-testid={`op-${o.operationId}`}>
            <h3 className="font-mono text-sm">
              <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">GET</span>
              {o.path}
            </h3>
            <p className="mt-1 text-sm">{o.summary}</p>
            {o.parameters && (
              <ul className="mt-2 text-xs text-muted-foreground">
                {o.parameters.map((p) => (
                  <li key={p.name}>
                    <code>{p.name}</code> ({p.in}
                    {p.required ? ", required" : ""}){p.description ? `: ${p.description}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Responses: {Object.entries(o.responses).map(([code, r]) => `${code} ${r.description}`).join(" · ")}
            </p>
          </article>
        ))}
      </section>

      <section aria-labelledby="sch-h">
        <h2 id="sch-h" className="text-xl font-semibold">Schemas</h2>
        <details className="mt-2 rounded-xl border p-4">
          <summary className="cursor-pointer text-sm">Attempt (generated from Zod)</summary>
          <pre tabIndex={0} className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(spec.components.schemas.Attempt, null, 2)}</pre>
        </details>
      </section>

      <section aria-labelledby="wh-h" className="space-y-2 text-sm">
        <h2 id="wh-h" className="text-xl font-semibold">Webhooks into Turning Point</h2>
        <p>
          POST to <code>/api/webhooks/&lt;company&gt;</code> with header <code>x-tp-signature: t=&lt;unix seconds&gt;,v1=&lt;hex HMAC-SHA256 of &quot;t.body&quot;&gt;</code> and{" "}
          <code>idempotency-key</code>. Timestamps older than 5 minutes are rejected; a repeated key is acknowledged once and not processed again. Events:{" "}
          <code>application.created</code>, <code>application.status_changed</code>.
        </p>
      </section>
    </main>
  );
}
