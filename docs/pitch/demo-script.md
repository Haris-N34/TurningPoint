# Demo script v2 (PRD Part I) (P.3 / I.1 draft)

Length: **4 minutes**, from the PRD "Demo script" section ("The live demo takes 4 minutes"). Part I does not set a new length.
Driver: Div. Talker: Haris (or whoever is not driving).
Automated check: `tests/e2e/demo-script.spec.ts` runs these steps. Run it with `--repeat-each=2` before every rehearsal.

This replaces `docs/demo/V2_SCRIPT.md` once Haris accepts it.

## What is and is not in main today (Nov 5)

| Part I step | Status |
| --- | --- |
| 1. Title screen | In main |
| 2. Value Mapper, publish | In main. Publishes **Launch Week**, not The Client Pivot (the builder offers Launch Week, Client Rescue and a sample; The Client Pivot is a map game at `/game/client-pivot`, not a builder template). |
| 3. Explain-on-pick checkpoint | In main |
| 4. Defer with a reason | In main. The follow-up checkpoint about the deferral is seeded, so it may or may not fire. |
| 5. Turning point | In main. Jumping straight to it needs the demo panel (P.2, `claude/v2-m5`). **Confirm once merged.** |
| 6. Second Look | **Not in main.** On `claude/v2-integrations`. Skip unless merged. |
| 7. Resume vs Evidence, Final score | **Not in main.** On `claude/v2-integrations`. The Final score conflicts with "no overall score"; do not show it until the team decides. |
| 8. Copilot with citation | In main |
| 9. Impact dashboard | In main. Second Look rescues and recruiter minutes show "awaiting data". |

## Setup (T minus 15 minutes)

1. Laptop on power. Wifi off is fine: the demo makes no model calls (`AI_MODE` off).
2. Fresh Chrome profile. Zoom 110%. Sound on, low.
3. Open `/` and reset (see "Reset"). Then open `/demo/seed`. You should see "Demo data loaded" with Prairie Grid Energy and Bow River Credit Union.
4. Pre-open tabs in this order:
   - Tab 1: `/game/launch-week` (title screen)
   - Tab 2: `/admin/new`
   - Tab 3: `/game/launch-week` paused just before Wednesday (see "Prepared turning-point tab")
   - Tab 4: `/recruiter`
   - Tab 5: `/admin/impact`
5. Backup video open in a separate window, paused at 0:00.

### Reset

- **Ctrl+Shift+D demo panel** has a reset button and jumps. **Confirm once merged** (`claude/v2-m5`, P.2).
- Until then: DevTools console on any page, run `localStorage.clear()`, close DevTools, then open `/demo/seed`. Recordings live in IndexedDB; clear them with the candidate's "Delete all my data" button on any results page if needed.

### Prepared turning-point tab

Until the demo panel lands: in tab 3, start Launch Week in turn-based mode, play through Monday and Tuesday (press Wait for news, answer any checkpoint in text) until the clock reads Tue evening. Press Pause. The game saves after every action, so a refresh shows "Continue" on the title screen. Note: the turning point is picked by seed. It may be "sponsor pulls out", "venue cancels" or "lead volunteer leaves". Check which one this tab gets and adjust the line in step 5. This prepared-tab path is not covered by the spec (the spec uses a test hook to set the clock); rehearse it by hand twice.

## The script

| Time | Tab | Exact clicks | Say |
| --- | --- | --- | --- |
| 0:00 to 0:15 | 1 | Nothing. Let the title map animate. | "Every resume now looks the same. So instead of reading one more, we watch what someone does when the plan breaks." |
| 0:15 to 0:50 | 2 | Company name "Northwind Labs". Role "Junior Tech Consultant". **Next**. In the Value Mapper box type `Communicate tech and business, Analytical thinking, Make new discoveries`. Click **Map to framework**. Click **Accept** on all three rows. **Next**. Leave Launch Week selected. **Next**. **Publish**. | "An employer types the skills it cares about in its own words. The Value Mapper maps them to our shared framework with a confidence level, and a person confirms each one. Publish gives a link, a job code and a QR." |
| 0:50 to 1:40 | 1 | Press **Settings**, tick **Turn-based**. **Start**. **Done** on the avatar. On the map, in the issue tracker, click **Go** next to Priya's roles issue. Press Enter to skip the text. Click **C** ("Take logistics myself so the team stays happy"). The checkpoint opens. Pick **Text**. **I'm ready, start answering**. Type one sentence. **Done**. **Submit**. | "You run a student food market for a week. People with problems show a marker with an icon and a label. I pick C. The checkpoint fires right away and quotes that exact choice. Fifteen seconds to think, sixty to answer. Video, voice or text. Only the words count. The clock is paused." |
| 1:40 to 2:00 | 1 | Press **Wait for news** until Rosa's vendor-mix issue appears. Click **Defer**, then **Something more urgent first**. If a checkpoint opens, answer it in text in one line. | "You cannot fix everything. Deferring with a reason is a decision, and we log it. Letting it expire is different, and we log that too. All measured in game time, never reflexes." |
| 2:00 to 2:30 | 3 | **Continue** on the title screen. Close the evening recap if it shows, then **Wait for news** until the phone call cutscene plays. **Hang up**, watch the budget drain, **Face it**. Point at the new Recovery plan issue at HQ. (After P.2 merges: in tab 1, **Ctrl+Shift+D**, "Jump to turning point". **Confirm once merged.**) | "Wednesday morning. The sponsor pulls out. Sixty percent of the budget is gone and three new problems appear. This is the part a resume cannot show: what do you protect, and how do you bring people along?" |
| (skip) | - | **Second Look. Only if `claude/v2-integrations` is merged.** | - |
| 2:30 to 3:10 | 4 | Point at the row "Candidate 4F7K" (no name). Click the row link. On the card click the Prioritization quote. Click **Said vs did**. Click **Shortlist**. The name changes to Maya Chen. | "This is a finished candidate from our demo data. The recruiter sees an ID, not a name. Each skill is Strong, Some or Not observed, never one overall score. Every AI sentence links to the exact quote, and the clip jumps to that second. Said vs did is context, not a penalty. A human shortlists, and only then sees the name." |
| 3:10 to 3:35 | 4 | **Ask about this candidate** (bottom right). Type `Where did they show prioritization?`. **Ask**. Click the first citation. Then type `Should I hire her?`. **Ask**. | "The Copilot only answers with citations. Ask it to make the decision and it refuses. That is the recruiter's job." |
| 3:35 to 3:55 | 5 | **Load 200 fictional candidates**. Scroll to the fairness table and the "Review: below four-fifths" flag. Point at an "Awaiting data" tile. | "These 200 candidates are fictional and labelled that way. When a group falls below four-fifths of the top shortlist rate, the dashboard flags it for review. It never decides about a person. Where we cannot measure yet, it says so." |
| 3:55 to 4:00 | - | Back to slides. | "McKinsey tests you on its scenario. Turning Point tests how you handle it when the plan breaks." |

## If something breaks

| Problem | Do this |
| --- | --- |
| Game canvas does not load | Reload once. If still blank, open Settings and tick List view; same actions, same outcome. |
| Checkpoint does not open after C | Say "the checkpoint is seeded per candidate" and move to step 4. Slide 6 covers it. |
| Turning-point tab lost its run | Skip to the recruiter tab. Use the cutscene screenshot on slide 6. |
| Copilot shows no answer | Click the Prioritization quote on the card instead; same point. |
| Anything worse | Switch to the backup video at the matching timestamp (see `timing.md`). |
