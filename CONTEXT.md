# Turning Point: project context

Read this file first, then `CLAUDE.md` (working rules and the build loop), `docs/PRD.md` (full spec, including "Upgrade v2"), `docs/PROGRESS.md` (every acceptance criterion) and `docs/ARCHITECTURE.md`.

## 1. Who and what

- **Team:** Divakar Gaba (Div, @divakargaba), 3rd-year CS at UCalgary, and Haris (@Haris-N34, repo owner). Div owns the candidate experience, the game, the AI pipeline and integrations. Haris owns design, content, art, portraits, accessibility and phone testing, seed data and the pitch.
- **Competition:** DICC 2026 (Digital Innovation Case Competition), Haskayne School of Business, UCalgary.
- **Writing style:** direct, short, no em dashes.

## 2. The case

"Beyond the Page: Rebuilding the Signals of Capability in an Age of AI." AI made resumes and cover letters cheap, so they no longer signal ability or interest. Recruiters drown in volume (Greenhouse 2026: 244 applications per role, up 111% since 2022; applications per recruiter up 412%). Only 1 in 3 employers trust resumes to reflect real skills.

Central question: how can digital innovation help people distinguish themselves and connect with meaningful work when AI has made traditional signals less distinctive? Deliverables: the solution (candidate and recruiter experience, why it is hard to fake with AI), an engagement model, a social-impact lens, and trade-offs.

Rubric: challenge understanding 20%, innovation 25%, impact and differentiation 25%, feasibility 20%, presentation and Q&A 10%. Solutions "clearly created by AI with no original thought" are penalised; the team must own every idea.

## 3. Research findings that shaped the product

- Live checks work; detection doesn't. AI-assisted cheaters passed 73% of standard coding questions but only 25% of custom ones.
- Structured, observed evidence predicts best (structured interviews .42, work samples .33, years of experience .07).
- McKinsey: candidates who "experienced a setback and recovered" are more likely to make partner. Hence a turning point.
- Failure modes to avoid: biased resume models (Amazon), facial analysis (HireVue), name bias in LLM screeners, vendor liability (Mobley v. Workday), reused scores that blackball, emotion recognition (EU ban), undisclosed AI screening (Ontario 2026).

## 4. The product

A story-based game where the plan breaks midway. Surprise checkpoints ask candidates to defend the exact choices they just made (video, voice or timed text). A final checkpoint links the game to a real experience, optionally confirmed by a witness. Recruiters get a one-minute Capability Card with evidence linked to the exact second. No overall auto-reject, a human decides, and cards are portable across employers on one shared skill framework.

v2 adds a real top-down game map with a live clock, an AI Engine with guardrails and evals, and an integration layer next to employers' ATS (Second Look rescues candidates the resume screen would reject).

Pitch line: "McKinsey tests you on its scenario. Turning Point tests how you handle it when the plan breaks."

## 5. Demo scope

Local-first demo. No database, no required API keys except Vercel hosting (deferred until the product is done). See `CLAUDE.md`, Demo scope decisions, and the PRD "Upgrade v2" note on how v2 fits.

## 6. Hard rules

Never score face, emotion, voice tone, accent, grammar, fluency, typing speed, movement speed or reflexes. No auto-reject; a pass needs a reason. Models never see name, email, university, photos or video frames. Every quote is an exact transcript substring, checked in code. Playable without camera, mouse or real-time pressure. Candidates own their data. No secrets in code.

## 7. Working setup

Task board: GitHub issue #1 plus one issue per task. Div's agent (Claude Code) and Haris's agent (Codex) post there with `[Name's Agent]` prefixes. PRs target `main`.
