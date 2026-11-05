# Turning Point: pitch deck outline (P.3 draft)

Draft for Haris to review. 11 slides. Live demo sits between slides 5 and 6.
Screenshots are in `docs/screens/`. Numbers come from the research brief in `CONTEXT.md`; check each source before the slide goes final.

Rules for every slide: no overall score, no auto-reject, no feature that is not in `main` on pitch day. Items marked **[unmerged]** are on a branch today and come off the slide if they are not merged.

---

## 1. Title

**On slide**
- Turning Point
- The plan breaks. Your capability shows.
- DICC 2026 · Div and Haris

**Screenshot:** `game-title-desktop.png` (full bleed, dimmed)

**Notes:** One breath. "We are Div and Haris. We built Turning Point, a way to see how someone handles it when the plan breaks."

---

## 2. The problem

**On slide**
- 244 applications per role. Up 111% since 2022. (Greenhouse 2026)
- Applications per recruiter: up 412%.
- 1 in 3 employers trust resumes to show real skills.
- AI made the resume free to write. So it stopped meaning much.

**Screenshot:** none. Big numbers only.

**Notes:** The case asks how people stand out when AI makes every application look the same. Recruiters cannot read harder. They need a different signal.

---

## 3. What actually predicts performance

**On slide**
- Structured interviews: .42
- Work samples: .33
- Years of experience: .07
- Live, custom tasks are hard to fake: AI-assisted cheaters passed 73% of standard coding questions, 25% of custom ones.

**Screenshot:** none.

**Notes:** Two findings drive the design. Observed, structured evidence beats claims. And a question about your own specific choice is much harder to outsource than a generic one. We did not try to detect AI. We made it less useful.

---

## 4. Our idea

**On slide**
- A short story-based challenge.
- Midway, the plan breaks.
- Surprise checkpoints ask you to explain the exact choice you just made.
- A last checkpoint links it to something you really did, optionally confirmed by a witness.
- Recruiters get a one-minute Capability Card.

**Screenshot:** `landing-desktop-light.png`

**Notes:** McKinsey research: people who had a setback and recovered are more likely to make partner. So the core of the game is the setback. Pitch line, said once here: "McKinsey tests you on its scenario. Turning Point tests how you handle it when the plan breaks."

---

## 5. It is a real game

**On slide**
- Top-down map, a live clock, people with problems.
- Talk, delegate, defer with a reason, or let it expire.
- Turn-based mode and a list view: no reflexes, no mouse, no camera needed.

**Screenshots:** `game-map-desktop.png` (large), `game-dialogue-desktop.png` (small inset)

**Notes:** Movement is a prioritization signal measured in game time, never real-time speed. Then: "Let us show you." Go to the live demo (`demo-script.md`).

---

## [Live demo, about 4 minutes]

See `demo-script.md`. Return to slide 6 after the close line.

---

## 6. The signature moment: the checkpoint

**On slide**
- "You chose C, to take logistics myself so the team stays happy. Walk us through why."
- 15 seconds to think. 60 to answer. Video, voice or text.
- Only your words count. Never your face, voice tone, accent or grammar.

**Screenshot:** `game-checkpoint-desktop.png`

**Notes:** If the demo checkpoint went well, keep this slide short. If the demo failed, this slide carries the story. The question is built from the candidate's own last choice, so a pre-written AI answer does not fit it.

---

## 7. What the recruiter sees

**On slide**
- Skill evidence: Strong, Some or Not observed.
- Every AI sentence links to the exact quote and second.
- Decision path with the turning point marked.
- Real story, witness line, integrity notes "for context, not scored".
- No overall score. Shortlist, Hold or Pass. A pass needs a reason.

**Screenshot:** `results-desktop.png` (crop to the card: skill evidence, decision path, answers)

**Notes:** Anonymous first review is on by default. The name shows only after shortlisting. Any quote the AI returns that is not an exact match to the transcript is dropped in code, and the skill drops a level.

---

## 8. AI with guardrails

**On slide**
- Copilot answers only with citations. Refuses "should I hire" and protected-trait questions.
- Said vs did: what they explained vs what they did. Context, never a penalty.
- Models never see name, email, university or video.
- Bias test in CI: same answer, 6 names and dialect variants, levels must match or the build fails.
- Runs offline in the demo. No model calls.

**Screenshots:** `m35-copilot.png`, `m35-said-vs-did.png`, `m35-ai-health.png` (small)

**Notes:** The case penalises "AI with no original thought". Our AI organises evidence. A human decides. Be honest: the demo uses local deterministic rules behind the same interface a live model would use.

---

## 9. Built for employers and candidates

**On slide**
- Employers: type your own competencies. The Value Mapper maps them to a shared 12-skill framework. You confirm each one.
- Publish a link, job code and QR in minutes.
- Candidates: one card, shared with any employer, no replay. Revoke any share. Delete everything.
- Mock ATS export with a link back to the card.
- **[unmerged]** Second Look: a candidate the resume screen rejected, with Strong evidence, comes back for a human look.

**Screenshots:** `m35-value-mapper.png`, `witness-desktop.png` (small)

**Notes:** Portability is the network effect. The shared framework is what lets a card mean the same thing at two employers. Drop the Second Look line if `claude/v2-integrations` is not merged.

---

## 10. Impact and fairness

**On slide**
- Who got a chance to show capability, where review happens, what needs a closer look.
- Completion and shortlist rate by answer mode and accommodation.
- Four-fifths check flags a group below 80% of the top rate. It triggers a review, never a decision.
- Shown with 200 fictional candidates, clearly labelled.

**Screenshot:** `impact-desktop.png`

**Notes:** Say "fictional" out loud. We do not have outcome data. The dashboard shows "awaiting data" where we cannot measure yet. That is on purpose.

---

## 11. Close

**On slide**
- McKinsey tests you on its scenario.
- Turning Point tests how you handle it when the plan breaks.
- Next: one pilot employer, one campus career centre, a validation study against hiring-manager ratings.

**Screenshot:** `game-cutscene-desktop.png` (dimmed)

**Notes:** Stop on the pitch line. Then: "Happy to take questions." See `qa-prep.md`.

---

## Open items for Haris

- Confirm every number on slides 2 and 3 against its original source and add a footnote.
- Pick light or dark for the recruiter screenshots.
- No full Capability Card screenshot from the recruiter view exists in `docs/screens`. `results-desktop.png` is the candidate view of the same card. A fresh recruiter capture would be better for slide 7.
- The `claude/v2-integrations` branch adds a "Final score" box. That conflicts with "no overall score" in CLAUDE.md. The deck does not mention it. Decide with Div before it merges.
