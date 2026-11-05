# One-minute demo

The live demo slot is one minute. Two tabs, prepared before you walk on. The full script (`demo-script.md`) stays as the long version for Q&A and the backup video.

Checked on a production build (`pnpm build && pnpm start`) on Nov 5: Enter to the checkpoint takes about 10 seconds of app time when you click straight through.

## Before you go on

1. Run the app, press Ctrl+Shift+D, click **Reset everything**, then **Load demo seed**.
2. Open the game once on the stage laptop and click **Allow** for camera and microphone. The checkpoint is a live video interview, and the first one in a run doubles as the camera check.
3. **Tab 1:** open `/game/launch-week?jump=turning-point` and leave it on the title screen ("On Tuesday, the plan breaks"). The game is in Quick mode (Mon to Wed), and the jump uses a fixed seed, so the sponsor always pulls out on Tuesday at 09:00.
4. **Tab 2:** open `/recruiter/card/att_demo_maya?challenge=ch_demo_energy`.
5. Sound on, zoom 100%, Tab 1 in front.

## The minute

| Time | Do | Say |
|---|---|---|
| 0:00 to 0:08 | Tab 1. Press Enter, then click **Let's go**. | "Every resume looks the same now. So we watch what someone does when the plan breaks." |
| 0:08 to 0:20 | The phone rings (Mr. Okafor). Click **Hang up**, watch the budget drain, then click **Face it**. The clock reads Tue 09:00, 2 days left. | "Tuesday morning, the sponsor pulls out. Sixty percent of the budget, gone." |
| 0:20 to 0:32 | In the issue list, click **Go** on the recovery plan. Press Enter until the A to D choices show (about three times), then pick **B**. | "You pick how to recover." |
| 0:32 to 0:40 | The live interview opens ("Hiring panel", camera check): "You chose B, to keep Saturday and Sunday; cut promotion, decorations and the stage. Walk us through why." | "Then it asks about the exact choice you just made. A generic AI answer doesn't fit that question. Only the words are scored, never the face or voice." |
| 0:40 to 0:55 | Tab 2. Point at the Final score with its inline breakdown (four skills at 25% each, "Sorts only, never filters"). Click the **Prioritization** quote: the answer plays as captions from that second. Click **Shortlist**; the name Maya Chen appears. | "The recruiter gets evidence, not a resume: every skill links to the moment the candidate said it. The score only sorts. A human decides." |
| 0:55 to 1:00 | Stay on the card. | "McKinsey tests you on its scenario. Turning Point tests how you handle it when the plan breaks." |

## If something goes wrong

- Cutscene already gone: press Ctrl+Shift+D, click **Turning point**, then start again. It takes 5 seconds.
- Camera prompt appears on stage: click **Allow**, or point at "Rather not be on camera?" and say every checkpoint works by voice or text.
- Anything else: skip to Tab 2. The card alone carries the last 25 seconds.

`tests/e2e/demo-60s.spec.ts` runs exactly this path.
