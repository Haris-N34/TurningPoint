# Turning Point PRD

Nov 4, 2026 · @div. Source: `Turning_Point_PRD.pdf`. Living doc: https://claude.ai/artifact/BrRP8vHyTKvkE7tpvJpVkx

> **Scope change (Nov 4):** the build is a local-only demo. No database, no auth server, no API keys except Vercel. See `CLAUDE.md`, Demo scope decisions. Sections below that mention Supabase, Claude API, Whisper, Deepgram or Resend describe the full product, not the demo build.

## Summary

We are building a working web prototype of Turning Point for the DICC 2026 pitch. Employers pick the skills they care about. Candidates play a short story-based challenge where something goes wrong partway through. Surprise checkpoints make them explain the decisions they just made by video, voice or text. Recruiters get a one-minute Capability Card instead of another resume.

**Product promise:** "McKinsey tests you on its scenario. Turning Point tests how you handle it when the plan breaks, and lets you show you have done it for real."

**Who it serves:**

- **Candidates** (students and early-career): a fair, free way to show judgment, adaptability and resilience, in their own words.
- **Recruiters:** evidence they can read in about 60 seconds, linked to the exact moment that shows each skill.
- **Employer admins:** set up a challenge in about 10 minutes without building a game.
- **Universities:** a free practice mode and outcome data for their students.

**Definition of done for the competition:** a deployed site where a judge can complete the full loop live in under 20 minutes, end to end, with real AI calls:

1. An admin creates a challenge for a fictional employer.
2. A candidate plays it on a laptop or phone, hits at least 2 surprise checkpoints, records a real answer, and finishes with the real-life checkpoint.
3. A witness confirms the real-life story from an emailed link.
4. A recruiter opens the Capability Card, sees the decision path, skill evidence, clips and witness confirmation, and shortlists the candidate.
5. The candidate shares the same card with a second employer without replaying.

**Non-goals for the prototype:** real ATS integration (mock it), real government ID checks (mock it), payments, and native mobile apps.

## Users and core flows

There are four roles. One person can hold more than one role in the demo, switched from a role picker in the header.

| Role | Signs in with | Main goal | Key screens |
| --- | --- | --- | --- |
| Employer admin | Email magic link | Create a challenge tied to the company's skills | Challenge builder, preview, analytics |
| Recruiter | Email magic link | Review candidates fast and shortlist | Candidate inbox, Capability Card, compare view |
| Candidate | Email magic link, verified once | Show capability, get shortlisted | Home, game, checkpoint, results, share |
| Witness | No account; one-time link | Confirm a real experience in 30 seconds | Confirm page |

**Flow A: employer setup**

1. Admin creates a company profile (name, logo, colour).
2. Picks 3 or 4 target skills from the shared skill framework.
3. Picks a scenario template and an industry flavour (e.g. "Energy", "Banking", "Non-profit").
4. The AI rewrites the template's names, setting and details for that industry. The admin previews and edits any line.
5. Admin publishes and gets a share link and a job code.

**Flow B: candidate challenge**

1. Candidate opens the link, signs in, and verifies identity once (mocked).
2. Sees a 3-screen intro: what happens, that 2 or 3 checkpoints will pop up, the answer formats, and how to request accommodations.
3. Does a 20-second device check (camera, mic, or text-only).
4. Plays the scenario: scenes, choices, a resource meter (budget, team morale, time).
5. The turning-point event fires midway and changes the situation.
6. 2 or 3 checkpoints interrupt at decision moments. Each one: 15 seconds to think, 60 seconds to answer.
7. The final checkpoint is real-life: "When have you faced something like this?" with an optional witness tag.
8. Sees a results page with their own Capability Card and a list of employers they can share it with.

**Flow C: witness confirmation**

1. Witness gets an email with a one-time link.
2. Sees a one-sentence summary of the story, written by the candidate.
3. Taps "Yes, this happened" or "I can't confirm this", ticks up to 3 skills they saw, and optionally writes one sentence.

**Flow D: recruiter review**

1. Recruiter opens the candidate inbox for a challenge, sorted by most recent with filters by skill evidence.
2. Opens a Capability Card and reads it in about a minute.
3. Plays any clip, which jumps to the exact decision it refers to.
4. Shortlists, holds or passes, and must pick a reason from a list. There is no auto-reject.
5. Exports the shortlist to the mock ATS.

## Candidate features

Each feature lists what it does and the acceptance criteria (AC) that must pass before it counts as done. P0 is required for the demo, P1 makes it impressive, P2 is a stretch goal.

### C1. Onboarding and device check (P0)

Intro screens, identity verification (mocked), accommodations request, device test.

- C1.1 three intro screens explain checkpoints, timing, answer formats and that no face or voice tone is scored.
- C1.2 the candidate picks a default answer mode (video, voice or text) and can change it at every checkpoint.
- C1.3 the device check shows a live camera preview and a mic level meter, and falls back to text mode if permission is denied, with no error dead end.
- C1.4 the accommodations form (extra time multiplier 1.5x or 2x, text-only, screen reader mode) changes the timers in the game.
- C1.5 "Verify identity" shows a mocked university SSO screen and sets `verified=true` on the profile.

### C2. Scenario game (P0)

A branching story in scenes. Each scene has illustrated art, narration text, and 2 to 4 choices. A resource bar tracks Budget, Team morale and Time.

- C2.1 the game loads a scenario from JSON (see Scenario engine) and renders every node type: scene, choice, event, checkpoint, end.
- C2.2 choices change resources and can branch to different nodes; the resource bar animates each change.
- C2.3 every choice is logged with timestamp, node id, option id and time taken to decide.
- C2.4 the candidate can pause; progress is saved server-side and resumes on refresh or on another device.
- C2.5 a full run takes 12 to 18 minutes and works at 375 px wide (phone).
- C2.6 keyboard-only play works (arrow keys and Enter), and all art has alt text.

### C3. Turning-point event (P0)

A scripted disruption midway (e.g. the main sponsor pulls out, half the team quits).

- C3.1 fires between 40% and 60% of the run, with a full-screen transition and a sound cue that can be muted.
- C3.2 resets at least one resource sharply and unlocks a new set of choices.
- C3.3 which disruption fires is picked from the template's pool by a per-candidate seed, so two candidates can get different events.

### C4. Surprise checkpoints (P0, the signature feature)

At 2 or 3 decision moments, a checkpoint interrupts. It asks the candidate to explain the specific choice they just made.

- C4.1 checkpoints fire on decision nodes marked `checkpointEligible`. The engine picks 2 or 3 of them per run using the candidate's seed, so the timing differs per candidate and cannot be predicted.
- C4.2 the question is generated by the AI from the candidate's actual last 1 to 3 choices and resource state (e.g. "You cut the catering budget instead of reducing volunteers. Why?"). It must quote their choice.
- C4.3 a 15-second think countdown, then a 60-second answer timer (both multiplied by any accommodation).
- C4.4 video mode records webcam plus mic; voice mode records mic with a live waveform; text mode shows a textarea with a live timer, and paste is disabled.
- C4.5 one retake is allowed per checkpoint, and the card shows whether a retake was used.
- C4.6 the recording uploads in the background with a progress indicator; on failure it retries 3 times, then saves locally and retries on the next scene.
- C4.7 the transcript appears on the results page within 30 seconds of the run ending.
- C4.8 tab switching or losing window focus during an answer is logged as an integrity note. It is shown to the recruiter as information, never as an automatic penalty.

### C5. Real-life checkpoint (P0)

The last checkpoint asks: "When have you faced something like this in real life? What broke, what did you decide, what changed?"

- C5.1 30 seconds to think, up to 120 seconds to answer, in any mode.
- C5.2 after answering, the AI asks one follow-up question about a specific detail they mentioned (e.g. "You said the funder pulled out. How did you tell the volunteers?"), with a 60-second answer.
- C5.3 the candidate writes a one-sentence title for the story (their words, not AI) that appears on the card.

### C6. Witness tag (P1)

- C6.1 the candidate can add up to 2 witnesses (name, email, relationship: supervisor, peer, community partner, instructor, other).
- C6.2 each witness receives an email with a one-time link that expires in 14 days.
- C6.3 the witness page (see Flow C) works without an account and on a phone in under 30 seconds.
- C6.4 the card shows "Confirmed by 1 supervisor, 1 peer" plus the witness sentence, never the witness's email.
- C6.5 a witness email matching the candidate's own email or domain alias is rejected.

### C7. Results and sharing (P0)

- C7.1 after the run, the candidate sees their own Capability Card exactly as a recruiter would.
- C7.2 they can hide any single clip from employers (but not edit transcripts).
- C7.3 a "Share with another employer" list shows other published challenges that target overlapping skills. One click shares the existing card. The new employer sees a badge: "Reused from a previous challenge, skills: X, Y".
- C7.4 the candidate can revoke a share; the employer then sees "Candidate withdrew this card".
- C7.5 the candidate can delete everything, and it is gone from the database and storage within 1 minute.

### C8. Practice mode (P1)

- C8.1 a free practice scenario with the same mechanics; nothing is shared and data is deleted after 24 hours.
- C8.2 after practice, the candidate gets AI feedback on clarity and specificity of their answers (never a hire score).

## Employer and recruiter features

### E1. Challenge builder (P0)

A 4-step wizard: Company, Skills, Scenario, Review.

- E1.1 the skills step shows the shared framework (see the skill list below) as selectable cards with definitions. The admin must pick 3 or 4.
- E1.2 the scenario step shows at least 2 templates with a thumbnail, length and which skills each one tests well.
- E1.3 choosing an industry flavour calls the AI to rewrite names, setting and details. It must return valid scenario JSON that passes schema validation, or the builder shows the error and keeps the original.
- E1.4 the admin can edit any scene text inline, and can mark which decisions are checkpoint-eligible.
- E1.5 "Preview as candidate" runs the full game in a sandbox, with no data saved.
- E1.6 publishing creates a public link and a QR code.
- E1.7 the whole setup takes under 10 minutes for a first-time user.

**Shared skill framework** (merged from the case's ET-7 and WEF durable skills, 10 skills): Problem-solving, Adaptability, Resilience (failing forward), Decision-making under ambiguity, Prioritization, Creativity with limited resources, Collaboration, Empathy, Communication, Responding to feedback.

### E2. Candidate inbox (P0)

- E2.1 a table of candidates per challenge with name (or anonymised ID, see E6), date, status, top 3 evidenced skills, witness confirmed (yes/no), reused card (yes/no).
- E2.2 filter by skill evidence level, status and witness confirmation. Sort by date or by evidence strength for a chosen skill.
- E2.3 keyboard shortcuts: J/K to move, Enter to open, S to shortlist.

### E3. Capability Card (P0, the recruiter's main screen)

Fits on one laptop screen without scrolling. Recruiter reads it in about 60 seconds.

- E3.1 header shows candidate name or ID, the challenge, date, verified badge, accommodations used (shown only as "adjusted timing", no detail).
- E3.2 **Skill evidence strip:** each target skill gets Strong, Some, or Not observed, with one sentence of evidence and a link to the moment. Never a single overall score.
- E3.3 **Decision path:** a horizontal timeline of the run, with the turning point marked and each checkpoint as a playable dot. Hover shows the choice made.
- E3.4 **Clips:** up to 3 checkpoint clips with transcripts. Clicking a sentence in an AI summary jumps to the exact second in the clip it came from.
- E3.5 **Real turning point:** the candidate's own title, transcript excerpt, follow-up answer, and witness confirmation.
- E3.6 **Integrity notes** (focus lost, retake used) in a small grey section, labelled "For context, not scored".
- E3.7 actions: Shortlist, Hold, Pass. Pass requires a reason from a dropdown. A free-text note is optional.
- E3.8 every AI-written sentence has a small "AI summary" label and a source link. No unsourced AI claim may appear.

### E4. Compare view (P1)

- E4.1 select 2 or 3 candidates and see their skill strips side by side, and their answers to the same checkpoint type next to each other.

### E5. ATS export (P1, mocked)

- E5.1 "Send to ATS" posts the shortlist as JSON to a mock Greenhouse endpoint inside our app and shows a success toast with the payload.
- E5.2 each exported candidate carries a link back to their Capability Card.

### E6. Fair-review settings (P0)

- E6.1 "Anonymous first review" is ON by default. It hides name, university and email, and shows a random ID until the recruiter shortlists.
- E6.2 video clips can be set to "transcript first": the recruiter reads the transcript and must click to reveal video.

### E7. Fairness and analytics dashboard (P1)

- E7.1 funnel counts per challenge: started, finished, shortlisted.
- E7.2 completion rate and shortlist rate by answer mode and by accommodation use, to spot formats that disadvantage people.
- E7.3 if candidates opt in to share demographic data, shortlist rates by group, with a four-fifths rule check that shows a warning when any group falls below 80% of the top group's rate.
- E7.4 works with seeded demo data (200 fake candidates) so the chart looks real in the pitch.

### E8. Reused cards (P0)

- E8.1 when a candidate shares an existing card, the inbox shows it with a "Reused" badge and which of the employer's skills it covers.
- E8.2 (P2) if the employer's skills are not covered, the recruiter can send a one-click "Ask for a short add-on" request, which gives the candidate a 5-minute mini-scenario for only the missing skill.

## Scenario engine and content spec

Scenarios are data, not code. One engine plays any scenario JSON, so a new employer or template never needs new code.

**Node types:** `scene` (narration, no choice), `choice` (2 to 4 options), `event` (scripted disruption), `checkpoint` (placeholder the engine may activate), `end`.

**Per-candidate variation:** a seed from the attempt id picks (a) which disruption fires from the pool, (b) which 2 or 3 checkpoint-eligible nodes activate, (c) small number changes (budget amounts, team size) within set ranges. Store the seed so a run can be replayed exactly.

```json
{
  "id": "launch-week",
  "version": 1,
  "title": "Launch Week",
  "industryFlavour": "non-profit",
  "targetSkills": ["adaptability", "prioritization", "resilience", "collaboration"],
  "resources": {
    "budget": { "label": "Budget", "start": 5000, "min": 0, "unit": "$" },
    "morale": { "label": "Team morale", "start": 70, "min": 0, "max": 100 },
    "time":   { "label": "Days left", "start": 21, "min": 0 }
  },
  "variation": { "budget.start": [4000, 6000], "teamSize": [6, 10] },
  "disruptionPool": ["sponsor-pulls-out", "venue-cancels", "lead-volunteer-quits"],
  "nodes": [
    {
      "id": "n3",
      "type": "choice",
      "art": "team-meeting",
      "text": "Two volunteers want to run social media. Nobody wants logistics.",
      "checkpointEligible": true,
      "skillSignals": ["collaboration", "prioritization"],
      "options": [
        { "id": "a", "label": "Assign roles yourself", "effects": { "morale": -10, "time": -1 }, "next": "n4" },
        { "id": "b", "label": "Let the team vote", "effects": { "morale": 5, "time": -2 }, "next": "n4" },
        { "id": "c", "label": "Take logistics on yourself", "effects": { "morale": 10, "time": -3 }, "next": "n4b" }
      ]
    }
  ]
}
```

Validate every scenario with a Zod schema at load time and in the builder. The schema rejects: unreachable nodes, options pointing to missing nodes, runs with no path to `end`, fewer than 3 checkpoint-eligible nodes.

### Demo scenario: Launch Week (write this one in full)

You lead a student team running a 3-week pop-up food market with a local non-profit. It deliberately mirrors Maya's situation without copying it.

| Act | Nodes | What happens | Skills it signals |
| --- | --- | --- | --- |
| 1. Set-up | 1 to 4 | Recruit volunteers, split roles, choose a vendor mix, set the budget | Collaboration, prioritization |
| 2. Momentum | 5 to 7 | Scheduling clash, a vendor asks for a bigger cut, low sign-ups in week 1 | Problem-solving, communication |
| 3. Turning point | 8 | Disruption from the pool fires (default for the demo: the main sponsor pulls out, budget drops 60%) | Resilience, adaptability |
| 4. Recovery | 9 to 12 | Cut scope, find a new partner, reassure the team, decide what to protect | Creativity with limited resources, decision-making under ambiguity |
| 5. Outcome | 13 to 14 | Market day and a debrief with the non-profit lead who gives critical feedback | Responding to feedback, empathy |
| End | 15 | Summary of resources, then the real-life checkpoint | All |

Mark nodes 3, 6, 9, 10 and 12 as checkpoint-eligible. Write a second template, "Client Rescue" (a consulting project whose client changes scope midway), so the builder has two options in the demo.

**Art:** 12 to 15 illustrated scenes in one consistent flat style (generate with an image model once, then store as static files). No real people, logos or brands.

## AI pipeline

AI has four jobs: tailor scenarios, ask checkpoint questions, transcribe, and organise evidence. It never makes the hiring decision and never scores face, voice tone or accent. Every AI output is structured JSON validated with Zod. On a validation failure, retry once, then fall back to a template.

| Job | When | Model | Input | Output | Fallback |
| --- | --- | --- | --- | --- | --- |
| Scenario tailoring | Admin picks an industry | Claude (large model) | Template JSON, industry, company name | Rewritten scenario JSON | Keep the original template |
| Checkpoint question | A checkpoint fires | Claude (fast model), streamed | Last 1 to 3 choices, resources, node text, target skills | One question under 30 words that quotes the choice | A pre-written question for that node |
| Follow-up question | After the real-life answer | Claude (fast model) | Transcript of the real-life answer | One question about a specific detail they said | "What was the hardest part to tell your team?" |
| Transcription | After each upload | Whisper or Deepgram | Audio track | Transcript with word timestamps | Show "Transcript pending" and retry |
| Evidence extraction | Run ends | Claude (large model) | All transcripts, choice log, target skills, rubric | Per-skill level + quote + timestamp | Mark the skill "Needs human review" |

**Latency budget:** the checkpoint question must appear within the 15-second think window. Pre-generate it the moment the candidate makes the choice before an eligible node, so it is ready when the checkpoint fires.

### Evidence rubric

Each target skill gets one of three levels. The model must cite a transcript quote with timestamps or a logged choice for any level above "Not observed".

| Level | Rule |
| --- | --- |
| Strong | The candidate names the trade-off, explains why they chose it, and shows awareness of who it affects or what they would change |
| Some | Gives a reason, but generic or without a trade-off |
| Not observed | No relevant evidence. This is not a negative judgment |

### Evidence extraction prompt (core)

```
You organise evidence for a human recruiter. You do not decide who is hired.
For each skill in TARGET_SKILLS, decide Strong, Some, or Not observed using RUBRIC.
Use only TRANSCRIPTS and CHOICE_LOG. Every level above Not observed must include:
  - a verbatim quote (max 25 words) with clip_id and start/end seconds, or a choice_id
  - one plain sentence (max 20 words) saying what the quote shows
Do not judge grammar, accent, fluency, confidence, appearance or emotion.
Do not infer personality, age, gender, ethnicity, disability or background.
If evidence is thin, say Not observed. Never invent quotes.
Return JSON matching EVIDENCE_SCHEMA only.
```

### Guardrails (checked in code, not only in the prompt)

- G1 Every returned quote is checked against the transcript with exact substring match. Any quote that is not found is dropped and the skill drops a level.
- G2 No model ever receives the candidate's name, email, university or video frames. It gets audio transcripts and choices only.
- G3 Prompts and model versions are stored with every result so a card can be audited later.
- G4 A bias test script runs the extractor on the same answer with 6 different names and dialect variants in the text and fails the build if levels differ.

## Architecture

One Next.js app serves every role. Keys and AI calls stay on the server, so the browser never talks to Claude or the transcription service directly.

- Clients: Candidate app (game, checkpoints, recorder on phone or laptop), Recruiter and admin (inbox, Capability Card, builder, fairness view), Witness page (one-time link, confirm in 30 seconds).
- Next.js app on Vercel: Scenario engine (plays scenario JSON, seeds, choice log), AI routes (questions, tailoring, evidence and quote check), Data APIs (shares, reviews, witness tokens, export).
- Services: Supabase (Postgres, Auth, Storage, RLS), Claude API (questions, evidence JSON), Transcription (Whisper or Deepgram), Resend (magic links, witness emails), Mock ATS (Greenhouse-style JSON export).

The one exception: recordings upload straight from the browser to Supabase Storage with a signed upload URL, then the app triggers transcription. That keeps large video files off the app server.

## Data model

Postgres in Supabase. Turn on Row Level Security for every table: candidates see only their own rows, recruiters see only attempts shared with their company.

| Table | Key fields | Notes |
| --- | --- | --- |
| `profiles` | id, role (candidate, recruiter, admin), display_name, email, university, verified, accommodations jsonb | One row per auth user |
| `companies` | id, name, logo_url, brand_colour | |
| `company_members` | company_id, profile_id, role | Links recruiters and admins to a company |
| `skills` | id, slug, name, definition | Seeded with the 10 framework skills |
| `scenario_templates` | id, slug, title, json, version | The base templates |
| `challenges` | id, company_id, template_id, title, target_skill_ids[], scenario_json, status, public_slug | The tailored, published version |
| `attempts` | id, challenge_id, candidate_id, seed, status, started_at, finished_at, resources_final jsonb | One per play-through |
| `choices` | id, attempt_id, node_id, option_id, decided_ms, created_at | Every decision |
| `checkpoints` | id, attempt_id, node_id, kind (decision, real_life, follow_up), question, mode, media_path, transcript jsonb, retake_used, integrity jsonb | `transcript` holds word timestamps |
| `evidence` | id, attempt_id, skill_id, level, quote, checkpoint_id, start_s, end_s, choice_id, sentence, model, prompt_version | One row per skill per attempt |
| `real_stories` | id, attempt_id, title, checkpoint_id, follow_up_checkpoint_id | The candidate's own turning point |
| `witnesses` | id, story_id, name, email_hash, relationship, token, status, skills_seen[], sentence, confirmed_at | Store the email hash only after sending |
| `shares` | id, attempt_id, company_id, challenge_id, reused, revoked_at | Powers portability |
| `reviews` | id, attempt_id, recruiter_id, decision, reason, note, created_at | Shortlist, hold, pass |
| `ats_exports` | id, company_id, payload jsonb, created_at | Mock Greenhouse log |
| `demographics` | attempt_id, opt_in, fields jsonb | Optional, separate table, used only for aggregated fairness charts |

**Storage buckets:** `recordings` (private; signed URLs that expire in 1 hour), `scenario-art` (public).

**Deletion:** a single `delete_my_data` database function removes the profile's attempts, checkpoints, evidence, stories, witnesses, shares and storage files.

## Screens and visual design

The goal is for judges to think "this is a real product" within 5 seconds. Two looks: the game feels warm and playful, and the recruiter side feels calm and professional.

**Design system:** Tailwind + shadcn/ui, one font family (Inter or Geist) for the app, one display font for game titles. One accent colour plus neutrals. Rounded corners, generous whitespace, no stock photos.

**Motion:** Framer Motion for scene transitions, the resource bar, and the checkpoint takeover. The checkpoint is the moment judges will remember, so give it the most polish:

1. The scene dims and blurs.
2. A card slides up with a soft chime: "Checkpoint".
3. The question types itself out word by word.
4. A circular 15-second ring counts down, then turns into the answer timer.
5. On submit, the card shrinks into a dot on the progress map.

| # | Screen | Role | Must-have elements |
| --- | --- | --- | --- |
| 1 | Landing page | Public | One-line promise, 3-step explainer, "Try the demo" and "For employers" buttons |
| 2 | Role picker (demo only) | All | Switch between Candidate, Recruiter, Admin, Witness |
| 3 | Candidate intro (3 screens) | Candidate | What happens, checkpoints explained, answer modes, accommodations |
| 4 | Device check | Candidate | Camera preview, mic meter, text fallback |
| 5 | Game scene | Candidate | Scene art, narration, choices, resource bar, progress map |
| 6 | Turning-point takeover | Candidate | Full-screen event card, resource drop animation |
| 7 | Checkpoint | Candidate | Question, think ring, recorder or textarea, retake |
| 8 | Real-life checkpoint + follow-up | Candidate | Longer timer, title field, witness tag form |
| 9 | Results and share | Candidate | Own card preview, hide clip toggles, share list, delete button |
| 10 | Witness confirm | Witness | Story title, yes/no, skill chips, one sentence |
| 11 | Challenge builder (4 steps) | Admin | Skill cards, template cards, inline editor, preview |
| 12 | Candidate inbox | Recruiter | Table, filters, badges, keyboard shortcuts |
| 13 | Capability Card | Recruiter | Skill strip, decision path, clips, real story, actions |
| 14 | Compare view | Recruiter | 2 or 3 cards side by side |
| 15 | Fairness dashboard | Admin | Funnel, rates by mode, four-fifths warning |

**Polish checklist for the pitch:** empty states with an illustration and one helpful line, skeleton loaders everywhere data loads, toast messages for every action, a favicon and page titles, light and dark themes, no console errors, and every screen tested at 375 px and 1440 px.

## Privacy, accessibility and fairness

These are product requirements, not slide claims. Each one maps to a rule from the research brief, so judges can test it live.

**Privacy**

- PV1 Candidates own their card: they choose each share, can revoke it, and can delete everything.
- PV2 Clear consent screen before recording, with a separate opt-in (off by default) for using answers to improve the product.
- PV3 Recordings are private, served only by signed URLs that expire in 1 hour.
- PV4 AI providers get transcripts only, with names removed, and no video frames.
- PV5 A plain-language "How we use AI" page linked from every screen (meets Ontario's AI disclosure rule for job postings and Quebec Law 25's explanation duty).

**Accessibility (target WCAG 2.2 AA)**

- A1 Every checkpoint can be answered by video, voice or text; nothing requires a camera.
- A2 Timer extensions of 1.5x or 2x, set once in the profile.
- A3 Full keyboard play, visible focus rings, screen-reader labels, captions on any audio, and a reduced-motion setting that turns off animations.
- A4 Low-bandwidth mode: art loads as small images, video falls back to voice.
- A5 Colour contrast checked with axe; no information carried by colour alone.

**Fairness**

- F1 No scoring of face, emotion, voice tone, accent, grammar or fluency.
- F2 No overall score and no auto-reject. A human picks every outcome and gives a reason for a pass.
- F3 Anonymous first review on by default.
- F4 The name and dialect bias test (AI pipeline section) runs in CI.
- F5 The fairness dashboard flags any group or answer mode below 80% of the top shortlist rate.
- F6 Equal access: the game and practice mode are free for every candidate, with no paid boosts.

## Build plan

Build in six milestones. Each one ends with something you can demo, so if time runs out you still have a working product. Do not start a milestone until the previous one's definition of done passes.

1. **M0. Foundations:** repo, Next.js app, Supabase project, auth, seed data, CI, deploy to Vercel.
   - Done when: a fresh clone runs with `pnpm i && pnpm dev`, CI is green, and the deployed URL shows the landing page and role picker.
2. **M1. Playable game:** scenario schema, engine, Launch Week content, resource bar, choice logging, turning point, save and resume.
   - Done when: a Playwright test plays Launch Week start to end on desktop and phone viewports, and every choice is in the database.
3. **M2. Checkpoints:** seeded checkpoint selection, AI question generation, recorder (video, voice, text), upload with retry, transcription, real-life checkpoint and follow-up.
   - Done when: a test run records 3 checkpoints in each mode (the test uses a fake media stream), and transcripts appear within 30 seconds.
4. **M3. Capability Card:** evidence extraction, quote verification, card UI, decision path, clip jump-to-second, inbox, review actions, anonymous review.
   - Done when: finishing a run produces a card where every AI sentence links to a real timestamp, and a recruiter can shortlist from the inbox.
5. **M4. Employer side and portability:** challenge builder with AI tailoring, preview, publish, sharing and reuse, witness flow, mock ATS export.
   - Done when: the full five-step loop from the Summary works end to end on the deployed site.
6. **M5. Polish and proof:** fairness dashboard with seeded data, compare view, practice mode, accessibility pass, bias test in CI, animations, empty states, demo seed script.
   - Done when: axe reports zero serious issues, Lighthouse performance is 85+ on the game page, the bias test passes, and the demo script runs twice in a row without a bug.

### Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Framer Motion | Fast to build, looks polished, one codebase for every role |
| Backend | Supabase (Postgres, Auth, Storage, Row Level Security, Edge Functions) | Auth, database and file storage in one free tier |
| AI | Anthropic Claude via the Vercel AI SDK, structured output with Zod | Streams checkpoint questions; reliable JSON |
| Transcription | OpenAI Whisper API or Deepgram (word timestamps) | Needed for clip jump-to-second |
| Recording | Browser MediaRecorder API | No extra service |
| Email | Resend | Witness links and magic links |
| Tests | Vitest (unit), Playwright (end to end), axe-core (accessibility) | The loop below depends on these |
| Hosting | Vercel | One-click deploys and preview URLs per pull request |

### The iterate-until-done loop

Use a coding agent (Claude Code) with this PRD saved in the repo as `docs/PRD.md`. Every acceptance criterion becomes a test. The agent keeps going until every P0 and P1 criterion has a passing test. The loop lives in `CLAUDE.md`.

**Repo layout:** `app/` (routes per role), `components/game`, `components/card`, `lib/engine` (pure TypeScript, fully unit tested), `lib/ai` (prompts and schemas), `content/scenarios/*.json`, `supabase/migrations`, `tests/e2e`, `docs/`.

## Team split

Split by side of the product, not by layer, so each person owns screens they can demo. Div owns the candidate experience and the AI pipeline, the hardest engineering. The partner owns the employer and recruiter side, the content and the pitch, which is where judges spend most of their attention.

| Area | Div | Partner |
| --- | --- | --- |
| M0 foundations | Repo, Supabase, auth, CI, deploy | Design system tokens, landing page, role picker |
| Scenario | Engine, schema, validation, seeding | Write Launch Week and Client Rescue (all text, choices, effects), generate the art |
| Candidate side | Game screens, checkpoints, recorder, upload, real-life checkpoint | Intro screens, device check UI, results page layout |
| AI | Question generation, transcription, evidence extraction, quote check, bias test | Write the checkpoint fallback questions and rubric examples; test outputs by hand |
| Recruiter side | Data APIs for inbox and card | Inbox, Capability Card UI, compare view, review actions |
| Employer side | AI tailoring endpoint, publish logic | Challenge builder wizard, preview, fairness dashboard |
| Portability and witness | Share and revoke logic, witness tokens and email | Share list UI, witness confirm page |
| Quality | Unit and e2e tests, the agent loop | Accessibility pass, phone testing, seed data for 200 fake candidates |
| Pitch | Live demo driver | Deck, demo script, Q&A prep, timing |

**How to work in parallel from day one:**

- Agree the scenario JSON schema and the database types in the first session. Commit them before anyone builds screens.
- The partner builds recruiter screens against a `fixtures/attempt.json` mock card, so they do not wait for the AI pipeline.
- One branch per feature, one pull request each, the other person reviews. Vercel gives each PR a preview link to click through.
- Daily 15-minute check: what shipped, what is blocked, which acceptance criteria were ticked.

**If the partner does not code:** they keep scenario writing, art, design (Figma or v0 mockups the agent then builds), seed data, testing on real phones, the fairness narrative, the deck and the demo script. Div runs the coding agent for both sides using their mockups. This still splits the work about evenly, because the content and pitch are large jobs.

## Demo script

The live demo takes 4 minutes. Pre-record a backup video of the same flow in case the venue wifi fails.

1. **(0:00) The problem in one line.** "Every resume now looks the same. Here is what a recruiter sees instead." Open a finished Capability Card for "Maya" from seed data.
2. **(0:30) Employer setup.** Switch to Admin. Create a challenge for a fictional Calgary energy company: pick Adaptability, Resilience, Prioritization, Collaboration, choose Launch Week, set flavour to Energy. Show the AI rewriting the scenario. Publish. About 60 seconds.
3. **(1:30) Candidate play.** Switch to Candidate on a phone mirrored to the screen. Play two quick choices. The turning point fires (sponsor pulls out). A checkpoint interrupts and quotes the choice just made. Answer live by voice in about 20 seconds. Skip ahead with a demo shortcut to the real-life checkpoint.
4. **(2:45) Witness.** Open the witness email on a second phone and confirm in one tap.
5. **(3:05) Recruiter.** Switch to Recruiter. Open the new card. Click a skill's evidence and the clip jumps to the exact second. Show anonymous review and that there is no score. Shortlist.
6. **(3:35) Portability and fairness.** Share the card with a second employer in one click. Flash the fairness dashboard with the four-fifths check.
7. **(3:55) Close.** "McKinsey tests you on its scenario. Turning Point tests how you handle it when the plan breaks."

**Demo shortcuts (hidden, demo mode only):** skip to the turning point, skip to the real-life checkpoint, reset all demo data. Hide them behind a keyboard combination so they never show on screen.

## Risks, out of scope, open questions

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Checkpoint question arrives late | The surprise moment feels broken | Pre-generate on the prior choice; fall back to the pre-written question after 4 seconds |
| Recording or upload fails at the venue | Demo stalls | Background upload with local save; voice and text modes; backup video |
| AI quotes something the candidate did not say | Credibility loss in Q&A | Exact substring check in code; unmatched quotes are dropped |
| Scope too big for two people | Nothing finished | Ship by milestone; P2 items are cut first; M3 alone is already a strong demo |
| API costs or rate limits | Demo errors | Cache demo outputs; set a spend cap; seed finished cards for the opening |
| Judges ask "how is this different from HireVue?" | Weak answer | Prepared line: scenario-based, decision-specific questions, real-life story with witnesses, evidence not scores, portable across employers |

**Out of scope for the prototype:** real ATS integrations, real identity verification, payments and billing, native apps, languages other than English (state as a roadmap item), employer-authored scenarios from scratch.

**Open questions:**

- What is the submission deadline and the finals date? The milestone plan assumes about two weeks of build time.
- Does the partner code? That decides which version of the team split to use.
- Do the competition rules allow a live AI demo, or should the core flow also work fully offline from cached outputs?
- Which real Calgary employer, if any, can we name as a pilot partner on the slides?

---

# Upgrade v2 (Nov 4, Div): game map, AI Engine, integration layer

This section adds three upgrades on top of everything above. Where it conflicts with earlier sections, this section wins.

**How it fits the demo scope (CLAUDE.md, Demo scope decisions).** The demo stays local-first with no required API keys:
- Data: the Part F tables are implemented as typed collections in the local store (browser) and an in-process demo store on the server for the integration layer (webhooks, mock ATS, public API). A Supabase migration for the full product is out of scope for the demo.
- AI: every service runs behind one provider interface. `AI_MODE=off` (default) uses deterministic local implementations and template fallbacks. `AI_MODE=cached` replays stored outputs. `AI_MODE=live` uses Claude only if `ANTHROPIC_API_KEY` is set in the environment. Keys never live in code.
- Email: simulated (links shown and logged), not sent.

## Where this comes from (the team's whiteboard)

- Existing inputs: resume and cover letter go into the employer's ATS. The game goes into our scoring system. The two are linked by "similar values" (employer competencies mapped to our skills) and both feed a final recruiter view.
- Company inputs: the company enters the skills it wants (e.g. leadership). These drive a job-related scenario.
- The game tests job skills with in-game metrics and KPIs. Video pop-ups let students prove real experiences. Answers become transcripts, an AI scan turns them into scores, and the AI engine keeps improving.
- Open question: "How can we limit candidates being booted out?" (answered by Second Look, C3).
- AI requirements: avoid bias, avoid hallucinations, accurate algorithm.
- Key success factors: students can distinguish themselves; recruiters can handle volume; capabilities are represented truthfully. Secondary: internal fulfilment for students.
- Role example: Tech Consulting wants communicating tech to business, analytical thinking, making new discoveries.
- Choice-triggered video: picking certain options (A to D) triggers a video explanation.
- Resume vs evidence: resume analysis gives signals of basic capability; the game gives evidence. Side by side. "My resume has this, but let me show you how I can back that up."

## Non-negotiables (additions)

Never score face, emotion, voice tone, accent, grammar, fluency, typing speed, movement speed or reflexes. No auto-reject. Models never receive name, email, university, photos or video frames. Every quote is an exact transcript substring, checked in code. Every part of the game is playable without a camera, without a mouse, and without real-time pressure (accessibility mode). Candidates own their data. No API keys in code.

## Part A. The game: top-down map plus live clock

### A0. It must look and feel like a real game (P0)

Judges must see it and say "this is an actual game." Reference feel: a cozy top-down 2D game (Stardew Valley, classic Pokémon overworlds) with the time pressure of a management game. Pixel art at a consistent scale (16x16 tiles at 3x or 4x, `pixelArt: true`, `roundPixels: true`).

Must-have elements:
- Title screen: animated map background, logo, "Press Enter / Tap to start", music toggle, settings. Not a web landing page.
- Avatar creator: body, skin tone, hair, outfit from inclusive options, plus a display name (never shown to recruiters). 30 seconds, skippable.
- Animated characters: 4-direction walk cycles, idle animations, NPCs walking short routes.
- A living world: ambient crowd NPCs, animated tiles, birds or particles, shadows, day-to-evening lighting via a tinted overlay.
- Game dialogue: bottom box with speaker portrait (neutral, worried, happy, angry), typewriter text with skip and a voice blip, choices A to D as game buttons navigable by arrow keys, NPC emote bubbles and expression changes in reaction.
- Juice: floating numbers, tweened and flashing bars, small screen shake on bad events, particle bursts on resolve, sound effects (footsteps, clicks, notifications, success, failure), a music loop that changes after the turning point.
- HUD: pixel panels, minimap with issue markers, quest-log issue tracker with countdowns, clock with a day ring, notification toasts.
- Turning point as a cutscene: letterbox bars, phone-call animation, camera pan, music change, Sponsor Office lights out.
- End-of-week results screen: animated KPI counters, "week in review" timeline, "Continue" into the real-life checkpoint.
- Pause menu: Resume, Settings (volume, text speed, reduced motion, turn-based mode, list view), How to play.
- Loading screen with tips.

Assets: CC0 packs from Kenney.nl as the base. Portraits: 6 to 8 NPC sets with 4 expressions in one pixel style (partner), in `public/assets/portraits/`. Every asset's source and licence in `public/assets/LICENSES.md`. Missing assets use a clearly temporary placeholder logged in `docs/ASSETS_TODO.md`; never a grey box in the demo build.

The "quiz test" (gate for M1.5): no gameplay screen shows choices without a character, a scene and an animation; every decision happens through an in-world interaction; Playwright captures the title, map, dialogue, cutscene, checkpoint and results into `docs/screens/` and `docs/CHANGELOG.md` records which items are met; 60 fps desktop, 30+ fps mid-range phone, no asset pop-in after loading.

### A1. Concept

Launch Week: the candidate is the student lead running a 5-day pop-up community market with a local non-profit. The map is the market site. Problems appear as people with "!" bubbles. A clock runs. The candidate walks to people, talks, decides, and can't fix everything in time. Midweek the main sponsor pulls out. Movement becomes a prioritization signal (who first, what deferred, what expired), measured in game time and outcomes, never real-time reflexes.

### A2. Tech

Phaser 3 map in a client-only component (`next/dynamic`, `ssr: false`) at `components/game/MapCanvas.tsx`. React renders all text UI (HUD, dialogue, issues, checkpoints) over the canvas. Zustand store (`lib/game/store.ts`) plus a typed event bus (mitt). The pure TypeScript engine (`lib/engine`, `lib/game`) is the single source of truth; Phaser only renders and sends input. Map authored in Tiled JSON at `public/maps/launch-week.json` with CC0 tiles and sprites. EasyStar.js pathfinding for click and tap. CC0 UI sounds; mute persisted with a try/catch fallback.

### A3. The map

40x30 tiles, camera follows the player, zoom fit for phones. Zones with signs:

| Zone | Who | What happens |
| --- | --- | --- |
| HQ Tent | Desk, laptop | Inbox, budget overview, end-of-day plan |
| Volunteer Station | Priya (volunteer lead), 2 volunteers | Staffing, schedule conflicts, morale |
| Vendor Row | 3 vendors | Fees, stall placement, a vendor threatening to leave |
| Sponsor Office | Mr. Okafor (sponsor rep) | Sponsorship terms; goes dark at the turning point |
| Storage Shed | Logistics volunteer | Missing supplies, permits, deliveries |
| Main Stage | Dana (non-profit lead) | Programming, community partner, critical feedback |
| Entrance Gate | Visitors (Day 5) | Market-day outcome |

NPCs with an open issue show a bouncing "!" coloured by urgency, plus an icon and label (never colour only).

### A4. Controls

Desktop: WASD or arrows to walk, E or Enter to talk, click to walk, Tab cycles NPCs with open issues. Phone: tap to walk, tap an NPC to talk. Fast travel from the issue list. Every route costs the same game time regardless of movement skill.

### A5. The clock

Monday to Friday 09:00 to 18:00, market day Saturday. HUD clock "Wed 14:20" with a day ring; lighting tints morning to evening. Time advances by action costs (walking 10 game minutes per 10 tiles of path, talking 30 to 90 minutes per issue, decisions per their effects) and ambient drift (2 game minutes per real second on the map, outside dialogue and checkpoints). Constants in `lib/game/config.ts`. The clock pauses in dialogue, checkpoints, pause menu and when the tab loses focus. Turn-based mode: no drift, only actions cost time; offered on the intro screen and on automatically with extra-time accommodations; shown in the HUD; no outcome may depend on drift. End of day: a 10-second evening recap with the day's KPIs and a one-line reflection prompt. Target run 12 to 16 minutes, tuned by a Playwright timing test.

### A6. Issues

Scenario JSON gains `map`, `npcs` and `issues`:

```json
{ "issues": [ { "id": "vendor-fee-dispute", "npc": "vendor-2", "zone": "vendor-row",
  "spawnAt": "Mon 11:00", "deadline": "Tue 12:00", "severity": "medium", "talkCost": 45,
  "choiceNode": "n6", "onExpire": { "effects": { "reputation": -10 }, "spawn": "vendor-2-leaves" },
  "skillSignals": ["prioritization", "communication"], "checkpointEligible": true } ] }
```

14 to 18 issues per week, at most 3 or 4 open at once. Actions: Talk (choice dialogue), Delegate (pick a volunteer; costs morale; success depends on their state), Defer (one-tap reason from a short list), Ignore (expires). Expiry applies `onExpire` effects and may spawn an escalated issue. HUD tracker shows deadline countdown in game time, severity and a "Go" button. HUD resources: Budget, Team morale, Community trust, Days left, animated on change.

### A7. The turning point

Wednesday 09:00 or the seeded variant. Screen dims, phone rings, full-screen call card from Mr. Okafor, budget drains 60%, Sponsor Office goes dark, three new issues spawn, camera pans across them. A "Recovery plan" choice unlocks at HQ.

### A8. In-game KPIs

Deterministic, explainable in one sentence on the card, inputs to scoring (Part D):

| KPI | Definition | Skill |
| --- | --- | --- |
| Critical issues handled before deadline | % of high-severity issues resolved in time | Prioritization |
| Deliberate deferrals | Deferred with a reason vs left to expire | Prioritization, decision-making under ambiguity |
| Recovery speed | Game hours from the turning point to a committed recovery plan | Resilience, adaptability |
| Budget protected for core goal | Share of remaining budget kept for the core purpose after the cut | Creativity with limited resources |
| Team morale trajectory | End morale vs the low point after the turning point | Collaboration, empathy |
| Delegation quality | Successful vs failed delegations, relative to the volunteer's state | Collaboration |
| Stakeholder balance | No stakeholder trust below 30 at the end | Empathy, communication |
| Feedback response | Choice after Dana's Day 4 critical feedback | Responding to feedback |

Never compute or display anything based on real-time speed, path efficiency, clicks or keystrokes.

### A9. Checkpoints inside the map

Same rules as C4 and C5. Triggers are decision-based: after a Talk, Delegate or Defer on a `checkpointEligible` issue, chosen by seed. The takeover freezes and blurs the map and quotes the action ("You deferred the permit problem to fix the vendor dispute first. Why that order?"). Choice-triggered video: options flagged `explainOnPick: true` (bold or unconventional options, and at least one in each turning-point dialogue) open a checkpoint immediately, quoting the option; cap of 4 video checkpoints per run; seeded ones still guarantee at least 2. The order question fires once: "You've got three open problems. Which first, and why?"; the next moves are logged against the answer.

### A10. Accessibility mode: list view

A toggle replaces the map with an accessible list of zones and issues; same actions, clock and outcomes. List view and map view produce identical engine state for identical inputs (unit test replaying one input log in both). Reduced motion turns off pans, shake and drains. Every NPC and issue has a text label; live regions announce new issues and clock milestones.

### A11. Testing the game

With `NEXT_PUBLIC_TEST_HOOKS=1`, `window.__tp` exposes `moveTo(zone)`, `talk(npc)`, `act(issueId, action)`, `setClock(time)`, `getState()`. Playwright plays a full run in map view on desktop and phone, and in list view keyboard-only.

### A12. Role-specific scenario: Tech Consulting, "The Client Pivot"

Junior analyst at a small tech consultancy, 5 days to recommend an inventory system to a regional grocery chain. Zones: your desk (data dashboards), team pod (developer, data analyst), partner's office (boss pushing clarity), client site via bus stop (non-technical store manager, CFO), whiteboard room, café (former employee with insider information). Target skills: Communicating tech to business, Analytical thinking, Curiosity and discovery, Adaptability. Mechanics: a mini data view with 3 charts where you pick the finding that matters (a wrong read costs credibility); optional hidden discoveries (café chat, store employee, dusty report) that unlock a better option later, never signposted, tracked as a KPI; explaining the same recommendation to the CFO and store manager, with reactions based on fit. Turning point Day 3: the CFO halves the budget and asks for a phased plan by Friday. KPIs: discoveries found, correct data insight, stakeholder understanding (CFO and manager trust), recovery speed.

Skill framework grows from 10 to 12: add Analytical thinking and Curiosity and discovery. Employers can type custom skill names; the Value Mapper maps them to framework skills and the admin confirms.

## Part B. The AI layer (AI Engine)

### B1. Structure

All AI code in `lib/ai/`: `providers/` (interface, Claude via the Vercel AI SDK, mock), `prompts/` (versioned registry: id, version, Zod schema, fixtures), `services/` (one per service), `guards/` (quote verification, PII stripping, protected-attribute filter), `evals/`, and telemetry of every call (model, prompt version, latency, cost, validation) into `ai_calls`. Kill switch `AI_MODE=live|cached|off`.

### B2. Services

| Service | What | When | Guardrails |
| --- | --- | --- | --- |
| Scenario Tailor | Rewrites names, setting, NPC lines, issue text for the industry | Publish | Schema validation; structure (issues, costs, effects) locked; wording only |
| Dialogue Variants | 3 wording variants per NPC line | Publish, cached | Meaning fixed; picked by seed, never live |
| Checkpoint Interviewer | Checkpoint question from last actions and state; real-life follow-up | Pre-generated on the triggering action | Quotes the action; 30 words; template fallback after 4 s |
| Transcriber | Speech to text with word timestamps | After each answer | Retry, then "Transcript pending" |
| Evidence Scanner | Per-skill level plus quotes and timestamps | Run end | Quote substring check; no PII; blind inputs; temperature 0 |
| Consistency Checker | Said vs did: explanation vs choice, order plan vs next moves, real story vs follow-up | Run end | Context for the recruiter, never a penalty |
| Value Mapper | Maps employer competency names and job text to the framework | Setup and ATS import | Mapping with confidence; admin confirms |
| Recruiter Copilot | Answers questions about one candidate's evidence | On demand | Cites evidence rows and transcripts only; refuses protected traits and "should I hire"; every answer cites |
| Candidate Coach | Feedback on specificity and clarity | On demand | Never a hiring score |
| Fairness Monitor | Adverse impact by opt-in group and answer mode; drift by model version | On demand and nightly | Aggregates only; minimum group size 10 |

### B3. The three AI requirements as code

- Avoid bias: blind inputs (`guards/pii.ts`), protected-attribute output filter, counterfactual CI test (6 names × 3 dialects, identical levels), Fairness Monitor.
- Avoid hallucinations: grounded inputs only, exact substring quotes (unverified dropped, skill drops a level), every Copilot answer cites, hallucination eval (20 "Not observed" fixtures, 19+ correct).
- Accurate algorithm: gold set of 40+ hand-scored answers in `lib/ai/evals/gold/`; Evidence Scanner matches human level on 80%+ with no item off by two levels; Cohen's kappa in `docs/EVALS.md`; prompt or model changes re-run evals and cannot merge if accuracy drops.

## Part C. Integration layer

### C1. Purpose

Plug in next to the employer's ATS: pull candidates and requisitions in, push evidence back, and rescue strong candidates the resume screen would have rejected.

### C2. Components (`lib/integrations/`)

- ATS adapter interface: `listJobs`, `getJob`, `listApplicants`, `postResult`, `postNote`, `getStatus`, `subscribeWebhooks`. Two adapters against our own mock servers: mock-greenhouse (Harvest-shaped) and mock-workday, marked as mocks in the UI.
- Inbound webhooks: `application.created` auto-invites the applicant to the linked challenge (simulated email with a unique link); `application.status_changed` to rejected triggers Second Look.
- Outbound: on attempt finish, post a scorecard-style result (per-skill levels, card link, Final score with breakdown, short summary), retry with exponential backoff, log every call.
- Webhook security: HMAC-SHA256 with a per-company secret, 5-minute timestamp window, idempotency keys in `webhook_events`.
- Public REST API `/api/v1/...` with per-company hashed API keys, rate limiting, OpenAPI generated from Zod and served at `/developers`.
- Resume intake from the ATS or a candidate upload, with consent, into the Resume Analyzer.
- Portable credential: Open Badges 3.0 / W3C VC (JSON-LD, Ed25519-signed); public `/verify` checks the signature.
- Integration console `/admin/integrations`: connect the mock ATS, map requisitions to challenges, live webhook log with payloads, re-send failed deliveries, rotate keys.

### C3. Second Look

If the ATS rejects an applicant at the resume stage (or never reviews them) and their evidence shows Strong in 2+ of the employer's target skills, they enter a Second Look queue with the reason ("Rejected at resume screen; Strong evidence in Resilience and Prioritization"). The recruiter must open the card and choose Restore or Confirm pass with a reason. Analytics shows "Candidates rescued by Second Look this season." Turning Point never removes anyone from consideration.

### C4. Resume Analyzer

Before any AI call, strip identity and prestige: name, contact, photo, address, graduation years; school and company names become "University" or "Company A". Extract structured achievements (role, action, result, skills claimed, has a number). Resume items are "Claimed"; game items are "Observed". Claim-to-evidence links: "Backed by game evidence" (link to clip or KPI) or "Not yet shown", never "false". Card shows two columns: "Resume: basic capabilities" and "Game: evidence", with lines for backed claims. A private real-life suggestion ("You might talk about your community garden project") is shown only to the candidate.

## Part D. Scoring

- Game score per skill (0 to 100) with level and confidence: KPI part (50%) plus Evidence Scanner part (Strong 90, Some 60, Not observed contributes nothing; 50%). No transcript evidence means KPI-only with Low confidence.
- Resume score per skill (0 to 100): backed claims count fully, unbacked claims at half.
- Final score (0 to 100): employer-weighted average over target skills of game × game weight + resume × resume weight. Game 75% / resume 25% by default; resume weight adjustable 0% to 40%, never higher. No resume means game only, no penalty.
- Guardrails: the Final score sorts but never filters; no threshold, hide-below or auto-reject setting exists anywhere; every Final score shows its breakdown on hover; Second Look still applies; formula and weights in `lib/scoring/config.ts`, versioned, shown on a public "How scores work" page. The card leads with evidence; the Final score sits in a box at the top right.

## Part E. Architecture

See `docs/ARCHITECTURE.md` (Mermaid): Experience, Game, AI, Integration and Data layers.

## Part F. Data model additions

`map_sessions`, `issue_events`, `kpis`, `skill_scores`, `consistency_notes`, `ai_calls`, `integrations`, `webhook_events`, `api_keys`, `second_look`, `credentials`, `resume_imports`, `resume_claims`, `claim_links`, `final_scores`, `custom_skills` (fields as listed in the v2 prompt). In the demo build these are typed local collections; "delete everything" covers every one.

## Part G. Impact dashboard (`/admin/impact`)

Seeded with 200 candidates and 3 employers, live data when present:

| Success factor | Metric |
| --- | --- |
| Students distinguish themselves | % with at least one Strong skill; spread of skill profiles |
| Recruiters handle volume | Median recruiter minutes per candidate, % reviewed, Second Look rescues |
| Truthful representation | AI vs human agreement on the gold set, % stories witness-confirmed, said-vs-did consistency, % resume claims backed |
| Internal fulfilment | Post-game survey "I learned something about how I work" (1 to 5), Coach usage |
| Fairness | Shortlist rate by answer mode and opt-in group with the four-fifths warning |

## Part H. Build order

Finish M0 to M1, then M1.5 (Part A: engine and clock in pure TypeScript with tests, then Phaser, then HUD, then list view), M2 (checkpoints from map actions), M3 (card with KPIs, Final score, Resume vs Evidence, said vs did), M3.5 (Part B), M4 (Part C plus employer side and portability), M5 (polish, Part G, accessibility, demo seed, cached AI mode). Keep it demo-able after every milestone.

## Part I. Demo additions

1. Open on the title screen; the camera sweeps the map and music comes in.
2. Admin, 45 s: type "Communicate tech and business, Analytical thinking, Make new discoveries"; the Value Mapper maps them; publish "The Client Pivot".
3. Walk the map to the vendor with a red "!" while two other issues count down. Pick B; the video checkpoint fires instantly.
4. Defer with a reason, then the checkpoint about that exact choice.
5. Turning point: phone call, budget drain, map goes dark.
6. Integration console: a mock ATS rejection arrives and the candidate appears in Second Look with Strong evidence. Restore them.
7. Card: Resume vs Evidence ("Led a team of 50 volunteers" Claimed, linked to Collaboration Observed). Hover the Final score to show the breakdown and the 25% resume cap.
8. Ask the Copilot "Where did they show prioritization?" and click the citation to jump to the clip.
9. Close on the impact dashboard: Second Look rescues, recruiter minutes per candidate, fairness check.

## Part J. Working rules

This section wins over earlier PRD sections. Commit PROGRESS.md after every ticked criterion. Stuck after 3 attempts: write it in PROGRESS.md and move on. After each milestone: screenshots of new screens in `docs/screens/` and a 5-line summary in `docs/CHANGELOG.md`. A criterion is done only when its test exists and passes in CI.
