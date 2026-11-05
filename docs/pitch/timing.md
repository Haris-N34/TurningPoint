# Timing and backup plan (P.3 draft)

The PRD sets the live demo at 4 minutes. It does not state the total slot. This plan assumes a **10-minute presentation plus Q&A**. Haris: confirm the slot from the DICC rules and scale the slide minutes, not the demo.

## Minute by minute

| Clock | Slide or step | Who | Length |
| --- | --- | --- | --- |
| 0:00 | 1. Title | Haris | 0:15 |
| 0:15 | 2. The problem | Haris | 0:45 |
| 1:00 | 3. What predicts performance | Haris | 0:45 |
| 1:45 | 4. Our idea + pitch line | Haris | 0:45 |
| 2:30 | 5. It is a real game | Div | 0:15 |
| 2:45 | Live demo (`demo-script.md`) | Div drives, Haris talks | 4:00 |
| 6:45 | 6. Checkpoint (short if demo went well) | Haris | 0:20 |
| 7:05 | 7. Recruiter card | Haris | 0:40 |
| 7:45 | 8. AI with guardrails | Div | 0:45 |
| 8:30 | 9. Employers and candidates | Haris | 0:40 |
| 9:10 | 10. Impact and fairness | Haris | 0:30 |
| 9:40 | 11. Close | Haris | 0:20 |
| 10:00 | Q&A (`qa-prep.md`) | Both | |

Hard cuts if running late: drop slide 6 (the demo showed it), then shorten slide 9 to its first two lines.

## Backup plan

Switch to the video when: the app does not load in 10 seconds, the laptop or projector fails, or two steps in a row break. Say: "Let's show you the recording of the same flow." No apologies beyond that.

The video follows `demo-script.md` exactly, so the talker keeps the same lines. Record it at 1440x900, 2x, with system sound, no voiceover (the talker speaks live). Keep a captioned copy with voiceover for online submission.

### Shot list

| # | Video time | Route | Shot |
| --- | --- | --- | --- |
| 1 | 0:00 | `/game/launch-week` | Title screen (still map, slow pan), 10 s |
| 2 | 0:15 | `/admin/new` | Type company and role, Next, type the three skills, Map to framework, accept all three, Next, Next, Publish. Hold on link, job code and QR |
| 3 | 0:50 | `/game/launch-week` | Settings, Turn-based, Start, avatar Done, map with the issue tracker |
| 4 | 1:05 | same | Go to Priya, dialogue with portrait, pick C, checkpoint quotes the choice. Hold 3 s on the question |
| 5 | 1:20 | same | Answer in text, Done, Submit |
| 6 | 1:40 | same | Wait for news, Rosa's issue, Defer, "Something more urgent first" |
| 7 | 2:00 | same | Phone call cutscene, Hang up, budget drain, Face it, the new recovery issue |
| 8 | 2:25 | `/admin/integrations` | Reject at resume screen on Maya's application, webhook log shows the Second Look line |
| 9 | 2:45 | `/recruiter?challenge=ch_demo_energy` | Second Look queue, Open card, Restore |
| 10 | 3:00 | `/recruiter/card/att_demo_maya?challenge=ch_demo_energy` | Click the Prioritization quote, Resume vs Evidence, Final score breakdown, Shortlist, name appears |
| 10b | 3:25 | same | Ask about this candidate: "Where did they show prioritization?", click citation, then "Should I hire her?" refused |
| 11 | 3:40 | `/admin/impact` | Load 200 fictional candidates, fairness flag, an Awaiting data tile |
| 12 | 3:55 | - | Black card with the pitch line, 5 s |

Before shot 1: reset with Ctrl+Shift+D, Reset everything; add the demo resume; start a fresh demo tenant (`demo-script.md`, Setup).

### Before recording

1. Setup steps 3 to 5 in `demo-script.md` (reset, resume, fresh tenant).
2. Run `pnpm e2e tests/e2e/demo-script.spec.ts --project=desktop --repeat-each=2`. Record only when it is green.
3. Hide the Next.js dev indicator: record from a production build (`pnpm build && pnpm start`).
4. Check the disruption in the turning-point shot matches what the talker says.

### Files to bring

- Video on the laptop desktop and on a USB stick.
- Deck as PDF on the USB stick.
- `qa-prep.md` printed, one copy each.
