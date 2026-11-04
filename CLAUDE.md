# Turning Point: project context for Claude Code

Read this file first. Full build spec: `docs/PRD.md`. Progress per acceptance criterion: `docs/PROGRESS.md`. Task board: the "Board" GitHub issue plus one issue per task (labels `div` / `haris`, `M0` to `M5`).

## What we are building

DICC 2026 (Haskayne, UCalgary) case: "Beyond the Page: Rebuilding the Signals of Capability in an Age of AI." AI made resumes and cover letters cheap, so they no longer signal ability.

Turning Point: a short story-based challenge where the plan breaks partway through. Surprise checkpoints ask candidates to defend the exact choices they just made (video, voice or timed text). A final checkpoint links the game to a real experience, optionally confirmed by a witness. Recruiters get a one-minute, evidence-linked Capability Card. No overall score, no auto-reject. Cards are portable across employers because everyone uses one 10-skill framework.

Pitch line: "McKinsey tests you on its scenario. Turning Point tests how you handle it when the plan breaks."

## Team

- **Div (@divakargaba):** candidate experience, engine, AI pipeline, data APIs, auth, CI, deploy, tests.
- **Haris (@Haris-N34, repo owner):** design system, landing, recruiter and employer screens, scenario content and art, fallback questions, accessibility and phone testing, seed data, pitch.

Writing style for anything produced for the team: direct, short, no em dashes.

## Hard rules (from the research; never break)

- Never score faces, emotion, voice tone, accent, grammar or fluency. Score transcripts against the rubric only.
- No overall score and no auto-reject. A human makes every decision, and a pass needs a reason.
- AI models never receive the candidate's name, email, university or video frames.
- Every AI evidence quote must match the transcript exactly as a substring, checked in code. Drop any quote that doesn't match.
- Every checkpoint can be answered without a camera. Timer accommodations of 1.5x or 2x.
- Candidates own their data: share per employer, revoke, delete everything.
- Never put API keys in code. Read them from `.env.local`.

## Stack and layout

Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Framer Motion, Supabase, Claude via the Vercel AI SDK, Whisper or Deepgram, Resend, Vitest, Playwright, axe-core, Vercel. Package manager: pnpm.

`app/` (routes per role), `components/game`, `components/card`, `lib/engine` (pure TypeScript, fully unit tested), `lib/ai` (prompts and schemas), `content/scenarios/*.json`, `supabase/migrations`, `tests/e2e`, `fixtures/`, `docs/`.

## The iterate-until-done loop

You are building Turning Point. The spec is docs/PRD.md. Progress is tracked in docs/PROGRESS.md.
Loop until every P0 and P1 acceptance criterion in PROGRESS.md is checked:

1. Pick the first unchecked criterion in the current milestone.
2. Write a failing test for it first (Vitest for logic, Playwright for flows).
3. Implement the smallest change that makes it pass.
4. Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`
5. If anything fails, read the error, fix it, and rerun. Never skip or delete a test to go green.
6. When green, commit with the criterion id (e.g. "C4.2 checkpoint question quotes the choice"), tick it in PROGRESS.md, and push.
7. When a milestone's checks are all ticked, run its "Done when" check, deploy a preview, and take Playwright screenshots of every screen into docs/screens/.
8. Then move to the next milestone.

If you are stuck on one criterion after 3 attempts, write what blocked you in PROGRESS.md and move on.
Only edit areas your human owns (see Team). Ask on the Board issue before touching the other person's screens.
