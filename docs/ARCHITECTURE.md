# Architecture

Five layers. The demo build is local-first: the Data layer is the browser's local store plus an in-process demo store on the server, and the AI layer runs on deterministic local providers unless `AI_MODE=live` and a key are set in the environment. The full-product targets (Supabase, Claude, a transcription API, Resend) are shown as the swap-in providers.

```mermaid
flowchart TB
  subgraph EXP["Experience layer"]
    CG["Candidate game<br/>map view + list view"]
    RA["Recruiter app<br/>inbox, Capability Card, Second Look,<br/>compare, Copilot"]
    AA["Admin app<br/>builder, integration console,<br/>AI health, fairness + impact"]
    WP["Witness page"]
    PUB["/verify and /developers"]
  end

  subgraph GAME["Game layer"]
    PH["Phaser map renderer"]
    HUD["React HUD + dialogue"]
    ENG["Pure TS engine<br/>state, clock, issues, KPIs, seed"]
    BUS["Event bus (mitt) + Zustand"]
  end

  API["App APIs (Next.js route handlers)"]

  subgraph AI["AI layer (lib/ai)"]
    PROV["Provider interface<br/>local rules | cached | Claude"]
    TPROV["Transcription provider<br/>browser speech | API"]
    SVC["Services: Scenario Tailor, Dialogue Variants,<br/>Checkpoint Interviewer, Transcriber, Evidence Scanner,<br/>Consistency Checker, Value Mapper, Recruiter Copilot,<br/>Candidate Coach, Fairness Monitor"]
    GRD["Guards: quote check, PII strip,<br/>protected-attribute filter"]
    EVL["Evals + telemetry (ai_calls)"]
  end

  subgraph INT["Integration layer (lib/integrations)"]
    ADP["ATS adapters<br/>mock Greenhouse, mock Workday"]
    WH["Webhooks in/out<br/>HMAC, timestamp, idempotency"]
    REST["Public REST API + OpenAPI"]
    RES["Resume Analyzer"]
    VC["Open Badges / VC issuer"]
    SL["Second Look rule"]
  end

  subgraph DATA["Data layer"]
    LS["Demo: browser local store<br/>+ IndexedDB recordings"]
    SS["Demo: server demo store<br/>(integration state)"]
    FULL["Full product: Supabase Postgres + RLS,<br/>Auth, Storage, Edge Functions, Resend"]
  end

  CLAUDE["Claude API"]
  STT["Transcription API"]
  MOCKATS["Mock ATS servers"]

  CG --> GAME
  EXP --> API
  PH <--> BUS
  HUD <--> BUS
  BUS <--> ENG
  API --> AI
  API --> INT
  PROV -.live mode.-> CLAUDE
  TPROV -.live mode.-> STT
  ADP --> MOCKATS
  GAME --> DATA
  AI --> DATA
  INT --> DATA
  EXP --> DATA
  CG -.recordings: direct upload / local save.-> LS
```

## Rules the architecture enforces

- Phaser only renders and sends input. All game logic is in the pure TypeScript engine, unit-tested without a canvas.
- Nothing outside `lib/ai` calls a model. Every call goes through a guard (PII in, quotes and protected attributes out) and is logged.
- The Final score sorts, never filters. There is no threshold anywhere in the inbox or API.
- No secrets in code. Live providers read keys from the environment only.
