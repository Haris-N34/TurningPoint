"use client";

import { useState } from "react";

// Interactive "try it" for /developers (C.4). Calls the real /api/v1 with the key you paste.
export function ApiTryIt({ operations }: { operations: { path: string; operationId: string; summary: string }[] }) {
  const [key, setKey] = useState("");
  const [op, setOp] = useState(operations[0]?.path ?? "/attempts");
  const [id, setId] = useState("att_demo_maya");
  const [out, setOut] = useState<{ status: number; headers: string; body: string } | null>(null);

  const send = async () => {
    const path = op.replace("{id}", encodeURIComponent(id));
    const res = await fetch(`/api/v1${path}`, { headers: key ? { authorization: `Bearer ${key.trim()}` } : {} });
    const remaining = res.headers.get("x-ratelimit-remaining");
    setOut({ status: res.status, headers: remaining ? `x-ratelimit-remaining: ${remaining}` : "", body: JSON.stringify(await res.json(), null, 2) });
  };

  return (
    <section aria-labelledby="try-h" className="rounded-xl border-2 border-primary/30 p-4" data-testid="try-it">
      <h2 id="try-h" className="text-xl font-semibold">Try it</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">API key</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="tp_live_…" className="min-h-11 rounded-md border px-2 font-mono text-xs" data-testid="try-key" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Endpoint</span>
          <select value={op} onChange={(e) => setOp(e.target.value)} className="min-h-11 rounded-md border bg-background px-2" data-testid="try-op">
            {operations.map((o) => (
              <option key={o.path} value={o.path}>
                GET {o.path}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={send} className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background" data-testid="try-send">
          Send
        </button>
      </div>
      {op.includes("{id}") && (
        <label className="mt-2 flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">id</span>
          <input value={id} onChange={(e) => setId(e.target.value)} className="min-h-11 rounded-md border px-2 font-mono text-xs" />
        </label>
      )}
      {out && (
        <div className="mt-3" data-testid="try-result">
          <p className="text-sm font-medium" data-testid="try-status">
            {out.status} {out.headers && <span className="text-xs font-normal text-muted-foreground">· {out.headers}</span>}
          </p>
          <pre tabIndex={0} className="mt-1 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{out.body}</pre>
        </div>
      )}
    </section>
  );
}
