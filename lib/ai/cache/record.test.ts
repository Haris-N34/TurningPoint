import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixturesOf, PROMPTS } from "../prompts/registry";
import { cacheKey } from "../prompts/types";
import { LocalProvider, resolveProvider } from "../providers";
import { run } from "../run";
import type { CacheTable } from "../providers/cached";

// `pnpm ai:record` records every prompt fixture into lib/ai/cache/recorded.json for AI_MODE=cached (B9).
// With AI_MODE=live and ANTHROPIC_API_KEY set it records Claude's answers; otherwise the local rules'.
// Only outputs that pass the schema and guards are recorded. Skipped in normal test runs.

describe.runIf(!!process.env.AI_RECORD)("record AI cache", () => {
  it("records every fixture", async () => {
    const live = resolveProvider();
    const provider = live.name === "claude" ? live : new LocalProvider();
    const table: CacheTable = {};
    for (const p of PROMPTS.filter((x) => !x.localOnly)) {
      for (const f of fixturesOf(p)) {
        const r = await run(p, f.input, { provider, log: () => {}, timeoutMs: 60_000 });
        if (r.valid) table[cacheKey(p, f.input)] = { output: r.output, model: r.model };
      }
    }
    const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(path.join(process.cwd(), "lib/ai/cache/recorded.json"), JSON.stringify(sorted, null, 1) + "\n");
    expect(Object.keys(sorted).length).toBeGreaterThan(0);
  }, 600_000);
});
