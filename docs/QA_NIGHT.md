# QA night (Nov 5)

Production build (`pnpm build && pnpm start`), crawled and clicked. Severity: S1 breaks the demo or a hard rule, S2 a user-visible bug, S3 polish.

| # | Bug | Sev | Status | Test | Owner |
|---|---|---|---|---|---|
| 1 | `/verify` says "Valid. Signed by Turning Point (an earlier issuer key)" for a badge anyone self-signs with their own Ed25519 key. Forged Strong levels pass. | S1 | Fixed: unknown issuer key is now invalid | tests/qa/credential-forgery.test.ts | QA (lib/integrations) |
| 2 | Withdrawn card rows in the inbox still carry name and university (if shortlisted before), skill levels, witness status and the Final score; the skill filter still matches them. C7.4 says nothing is shown. | S2 | Fixed in lib/card/inbox.ts | tests/qa/withdrawn-row.test.ts | QA (lib/card) |

## Risks to note

- Issuer key is random per server process unless `TP_ISSUER_ED25519_KEY` is set. On Vercel, a badge issued by one function instance fails `/verify` on another, and every badge fails after a redeploy. Set the env var before the demo.

## Runs

- Round 1: crawl of 40 routes x 4 viewports x light/dark, seeded and cleared storage: no console errors, no hydration warnings, no asset 404s, no horizontal overflow. Click-everything pass on every route: no page errors.
- demo-60s on the production build, 10 in a row: 10/10 green (24 to 28 s each).
