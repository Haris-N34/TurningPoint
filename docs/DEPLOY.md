# Deploy (Vercel)

The demo runs with no database and no API keys. On a public URL, set the two secrets below first. Never commit any of them.

## Environment variables

| Variable | Set on a public deploy? | What it does |
|---|---|---|
| `TP_ISSUER_ED25519_KEY` | Yes | The Ed25519 key that signs Open Badges (`/api/credentials`), PKCS8 DER, base64. Without it every server instance makes its own key, so a badge issued by one Vercel function fails `/verify` on another, and every badge fails after a redeploy. |
| `TP_CONSOLE_SECRET` | Yes | Locks the integration console API (`/api/integrations/*`): every console route then needs this value in the `x-tp-console-secret` header. Without it anyone with the URL can mint live API keys (`POST /api/integrations/keys`) and read evidence summaries through `/api/v1`. The candidate's own routes (reporting a finished attempt with an invite, looking up an invite) stay open. Unset locally so the demo console works without a prompt. |
| `AI_MODE` | Optional | `off` (default: local rules, no network), `cached` (replays recorded answers) or `live` (calls the model; needs `ANTHROPIC_API_KEY`). |
| `ANTHROPIC_API_KEY` | Only with `AI_MODE=live` | Model access. The demo does not need it. |
| `NEXT_PUBLIC_TEST_HOOKS` | Never | Compiles `window.__tp` test hooks into the build. CI sets it for e2e only. |

## Make the keys

```sh
# Issuer key (keep it: badges stay verifiable across redeploys)
node -e 'const {generateKeyPairSync}=require("crypto");const {privateKey}=generateKeyPairSync("ed25519");console.log(privateKey.export({format:"der",type:"pkcs8"}).toString("base64"))'

# Console secret
node -e 'console.log(require("crypto").randomBytes(24).toString("base64url"))'
```

Add both in Vercel: Project, Settings, Environment Variables (Production and Preview), then redeploy.

## What a badge proves

`/api/credentials` takes the candidate's answers, not levels. The server re-scores them with the Evidence Scanner, signs only the levels it finds, and puts a SHA-256 digest of the answers in the badge. A valid badge proves Turning Point issued it for those answers; the card link carries the evidence itself. It does not prove who typed the answers.

## Still open on a public URL

- `/api/mock-ats/*` is a mock ATS with fictional applicants and stays open by design.
- All candidate data lives in the visitor's browser (localStorage, IndexedDB); nothing is stored server-side except the integration console's in-memory demo state, which resets on cold start.
