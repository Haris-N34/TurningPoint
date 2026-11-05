"use client";

import { useState } from "react";

type Result = { valid: true; issuerKnown: boolean; issuer: string; name: string; skills: { skill: string; level: string }[]; validFrom: string } | { valid: false; reason: string };

// Public /verify (C.9): paste or upload a credential and check its signature.
export function VerifyCredential() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: text });
      setResult((await res.json()) as Result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor="vc-text" className="text-sm font-medium">
        Credential JSON
      </label>
      <textarea id="vc-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-mono text-xs" data-testid="verify-input" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer text-sm underline">
          Or choose a file
          <input
            type="file"
            accept=".json,application/json,application/ld+json"
            className="sr-only"
            data-testid="verify-file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
            }}
          />
        </label>
        <button type="button" onClick={check} disabled={busy || !text.trim()} className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50" data-testid="verify-check">
          {busy ? "Checking…" : "Verify"}
        </button>
      </div>
      {result && (
        <div role="status" className={`rounded-xl border p-4 text-sm ${result.valid ? "border-primary" : "border-destructive"}`} data-testid="verify-result" data-valid={result.valid}>
          {result.valid ? (
            <>
              <p className="font-semibold">Valid. Signed by Turning Point{result.issuerKnown ? "" : " (an earlier issuer key)"}.</p>
              <p className="mt-1">{result.name}</p>
              <ul className="mt-2 list-disc pl-5">
                {result.skills.map((s) => (
                  <li key={s.skill}>
                    {s.skill}: {s.level}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Issued {result.validFrom.slice(0, 10)}</p>
            </>
          ) : (
            <p className="font-semibold">Not valid. {result.reason}</p>
          )}
        </div>
      )}
    </div>
  );
}
