# Demo script v2 (PRD Part I) (P.3 / I.1 draft)

Length: **4 minutes**, from the PRD "Demo script" section ("The live demo takes 4 minutes"). Part I does not set a new length.
Driver: Div. Talker: Haris (or whoever is not driving).
Automated check: `tests/e2e/demo-script.spec.ts` runs these steps. Run it with `--repeat-each=2` before every rehearsal.

This replaces `docs/demo/V2_SCRIPT.md` once Haris accepts it.

## Notes on Part I (Nov 5, checked on a production build)

| Part I step | Status |
| --- | --- |
| 1. Title screen | As written |
| 2. Value Mapper, publish | Publishes **Launch Week**, not The Client Pivot (the builder offers Launch Week, Client Rescue and a sample; The Client Pivot is a map game at `/game/client-pivot`, not a builder template). |
| 3. Explain-on-pick checkpoint | Plays in the full week (tab 1 ticks **Full week**). The checkpoint is a live interview: Priya asks for the hiring panel, and the first one in a run doubles as the camera check. Pick **Text** for the stage. |
| 4. Defer with a reason | The follow-up checkpoint about the deferral is seeded, so it may or may not fire. |
| 5. Turning point | The Ctrl+Shift+D demo panel's **Turning point** link jumps straight to Tuesday 09:00 in Quick mode (the sponsor pulls out). The prepared full-week tab (Wednesday morning) is the backup. |
| 6. Second Look | Needs a fresh demo tenant in setup (the mock ATS keeps state on the server). |
| 7. Resume vs Evidence, Final score | Needs the resume added in setup (the seed has none). The Final score shows its breakdown inline, top right (four skills at 25% each, "Sorts only, never filters"). Say it never hides or rejects anyone. |
| 8. Copilot with citation | As written |
| 9. Impact dashboard | Second Look rescues and recruiter minutes show "awaiting data". |

## Setup (T minus 15 minutes)

1. Laptop on power. Wifi off is fine: the demo makes no model calls (`AI_MODE` off).
2. Fresh Chrome profile. Zoom 110%. Sound on, low. Open the game once and click **Allow** for camera and microphone (checkpoints are live video interviews; you still answer in text on stage).
3. Open `/` and reset (see "Reset"). The seed reloads with Prairie Grid Energy and Bow River Credit Union.
4. Resume: open `/results/att_demo_maya`, paste the demo resume (end of this file) into the resume box, tick consent, **Compare with my evidence**. It should say it added 3 claims.
5. Second Look: open `/admin/integrations`, click **Start a fresh demo tenant**. Leave this tab open.
6. Pre-open tabs in this order:
   - Tab 1: `/game/launch-week?week=full` (title screen; or tick **Full week** in Settings)
   - Tab 2: `/admin/new`
   - Tab 3: `/game/launch-week?week=full` paused just before Wednesday (see "Prepared turning-point tab"). The long script plays the full week; Quick mode, the default, breaks on Tuesday.
   - Tab 4: `/admin/integrations` (fresh tenant from step 5)
   - Tab 5: `/recruiter?challenge=ch_demo_energy`
   - Tab 6: `/admin/impact`
7. Backup video open in a separate window, paused at 0:00.

### Reset

- Press **Ctrl+Shift+D** (Cmd+Shift+D on Mac) on any page. The demo panel opens. Click **Reset everything**. It clears all local data and recordings and reloads the seed. Press Ctrl+Shift+D again to close it.
- Or open `/demo/reset`.
- The panel also switches roles and jumps to Game, Results, Recruiter card and Admin impact. Use it if a tab is lost mid-demo.
- Reset does not clear the mock ATS on the server. Start a fresh demo tenant instead (setup step 5).

### Prepared turning-point tab

The demo panel's **Turning point** link jumps straight to Tuesday 09:00 in Quick mode (the one-minute demo). The long script shows the full week, so prepare tab 3 by hand: start Launch Week with **Full week** and **Turn-based** ticked, play through Monday and Tuesday (press Wait for news, answer any checkpoint in text) until the clock reads Tue evening. Press Pause. The game saves after every action, so a refresh shows "Continue" on the title screen. Note: the turning point is picked by seed. It may be "sponsor pulls out", "venue cancels" or "lead volunteer leaves". Check which one this tab gets and adjust the line in step 5. This prepared-tab path is not covered by the spec (the spec uses a test hook to set the clock); rehearse it by hand twice.

## The script

| Time | Tab | Exact clicks | Say |
| --- | --- | --- | --- |
| 0:00 to 0:15 | 1 | Nothing. The title shows a still of the market with a slow pan; the live map starts after Enter. | "Every resume now looks the same. So instead of reading one more, we watch what someone does when the plan breaks." |
| 0:15 to 0:50 | 2 | Company name "Northwind Labs". Role "Junior Tech Consultant". **Next**. In the Value Mapper box type `Communicate tech and business, Analytical thinking, Make new discoveries`. Click **Map to framework**. Click **Accept** on all three rows. **Next**. Leave Launch Week selected. **Next**. **Publish**. | "An employer types the skills it cares about in its own words. The Value Mapper maps them to our shared framework with a confidence level, and a person confirms each one. Publish gives a link, a job code and a QR." |
| 0:50 to 1:40 | 1 | Press **Settings**, tick **Turn-based** and **Full week**. **Start**. **Let's go** on the avatar. The coach hint says "Press Go to walk to your first problem". In the issue tracker, click **Go** next to Priya's roles issue. Press Enter until the choices show (about three times). Click **C** ("Take logistics myself so the team stays happy"). The live interview opens (camera check). Pick **Text**. **I'm ready, start answering**. Type one sentence. **Done**. **Submit** (or show **Retake (1 left)** first). | "You run a student food market for a week. People with problems show a marker with an icon and a label. I pick C. The checkpoint fires right away and quotes that exact choice. Fifteen seconds to think, sixty to answer. Video, voice or text. Only the words count. The clock is paused." |
| 1:40 to 2:00 | 1 | Press **Wait for news** until Rosa's vendor-mix issue appears. Click **Defer**, then **Something more urgent first**. If a checkpoint opens, answer it in text in one line. | "You cannot fix everything. Deferring with a reason is a decision, and we log it. Letting it expire is different, and we log that too. All measured in game time, never reflexes." |
| 2:00 to 2:25 | 3 | **Continue** on the title screen. Close the evening recap if it shows, then **Wait for news** until the phone call cutscene plays. **Hang up**, watch the budget drain, **Face it**. Point at the new recovery issue. | "Wednesday morning. The sponsor pulls out. Sixty percent of the budget is gone and new problems appear. (Match this line to the disruption the tab got.) This is the part a resume cannot show: what do you protect, and how do you bring people along?" |
| 2:25 to 2:45 | 4 | Next to Maya's Greenhouse application, click **Reject at resume screen**. Point at the webhook log line "Second Look: Rejected at resume screen; Strong evidence in Prioritization and Collaboration". | "The employer's ATS rejects her at the resume screen. Her game evidence is Strong in two of their skills, so she goes to Second Look. We never remove anyone." |
| 2:45 to 3:00 | 5 | Reload. In the Second Look queue click **Open card**. Click **Restore**. (The other rows are labelled SYNTHETIC with fictional names; long inboxes show 20 rows at a time with **Show more**.) | "A person has to look and choose: restore, or confirm the pass with a reason. We restore her." |
| 3:00 to 3:25 | 5 | On the card: click the Prioritization quote; the answer plays as captions from 0:09. Point at the "second take" tag on Checkpoint 2 (the card says "Answered on the second take": a retake is shown, never hidden). Point at Resume vs Evidence ("Led a team of 50 volunteers" next to Collaboration). Point at the Final score breakdown, top right. Click **Shortlist**. The name changes to Maya Chen. | "Skills are Strong, Some or Not observed, each linked to the exact quote and second. On the left, what the resume claims. On the right, what she showed. The Final score only sorts. Here is its breakdown: the resume counts for 25%. It never hides or rejects anyone. A human shortlists, and only then sees the name." |
| 3:25 to 3:40 | 5 | **Ask about this candidate** (bottom right). Type `Where did they show prioritization?`. **Ask**. Click the first citation. Then type `Should I hire her?`. **Ask**. | "The Copilot only answers with citations. Ask it to make the decision and it refuses. That is the recruiter's job." |
| 3:40 to 3:55 | 6 | **Load 200 fictional candidates**. Scroll to the fairness table and the "Review: below four-fifths" flag. Point at an "Awaiting data" tile. | "These 200 candidates are fictional and labelled that way. When a group falls below four-fifths of the top shortlist rate, the dashboard flags it for review. It never decides about a person. Where we cannot measure yet, it says so." |
| 3:55 to 4:00 | - | Back to slides. | "McKinsey tests you on its scenario. Turning Point tests how you handle it when the plan breaks." |

## If something breaks

| Problem | Do this |
| --- | --- |
| Game canvas does not load | Reload once. If still blank, open Settings and tick List view; same actions, same outcome. |
| Checkpoint does not open after C | Say "the checkpoint is seeded per candidate" and move to step 4. Slide 6 covers it. |
| Turning-point tab lost its run | Skip to the recruiter tab. Use the cutscene screenshot on slide 6. |
| Second Look queue is empty | The tenant was reused. Skip to the card and say what Second Look does.
| Copilot shows no answer | Click the Prioritization quote on the card instead; same point. |
| Anything worse | Switch to the backup video at the matching timestamp (see `timing.md`). |

## Demo resume (setup step 4)

```
Maya Chen
maya.chen@example.com | (403) 555-0182

Experience
Volunteer Coordinator at Bow Valley Food Bank (May 2025 - Aug 2025)
- Led a team of 50 volunteers and kept every volunteer informed when funding was cut
- Negotiated donated supplies from a local store, saving $2,000
- Tracked weekly sign-up data in a spreadsheet to spot no-shows
```

Name, contact and employer names are stripped before analysis. The card shows the claims with no identity.
