import { afterEach, describe, expect, it } from "vitest";
import { consoleAllowed, handleIntegrations } from "@/lib/integrations/console";

// QA night: POST /api/integrations/keys minted a live API key for anyone. With TP_CONSOLE_SECRET set, every
// console route needs the secret; the candidate's own routes (report a result, look up an invite) stay open.
const ORIGIN = "https://tp.example";
afterEach(() => {
  delete process.env.TP_CONSOLE_SECRET;
});

describe("QA: console secret", () => {
  it("unset (local demo): the console stays open", async () => {
    const r = await handleIntegrations("POST", ["keys"], new URLSearchParams(), {}, ORIGIN, null);
    expect(r.status).toBe(201);
  });

  it("set: minting a key, reading state and rotating the webhook secret need it", async () => {
    process.env.TP_CONSOLE_SECRET = "s3cret-for-tests";
    for (const [m, p] of [["POST", ["keys"]], ["GET", ["state"]], ["POST", ["secret", "rotate"]], ["POST", ["companies"]], ["POST", ["simulate"]]] as const) {
      const r = await handleIntegrations(m, [...p], new URLSearchParams(), {}, ORIGIN, null);
      expect(r.status, `${m} ${p.join("/")}`).toBe(401);
      const wrong = await handleIntegrations(m, [...p], new URLSearchParams(), {}, ORIGIN, "nope");
      expect(wrong.status).toBe(401);
    }
    const ok = await handleIntegrations("POST", ["keys"], new URLSearchParams(), {}, ORIGIN, "s3cret-for-tests");
    expect(ok.status).toBe(201);
  });

  it("set: the candidate's routes stay open", () => {
    process.env.TP_CONSOLE_SECRET = "s3cret-for-tests";
    expect(consoleAllowed("POST", ["attempts"], null)).toBe(true);
    expect(consoleAllowed("GET", ["invites", "inv_123"], null)).toBe(true);
    expect(consoleAllowed("GET", ["invites"], null)).toBe(false);
  });
});
