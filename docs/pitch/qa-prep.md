# Q&A prep (P.3 draft)

20 likely judge questions. Answers are short and honest. Say "we don't know yet" when that is true.
Numbers come from the research brief in `CONTEXT.md` and `docs/PRD.md`. Haris: confirm each source before the pitch. Do not add new statistics on stage.

## Bias and fairness

**1. How is this not just HireVue again?**
HireVue was criticised for analysing faces. We never score face, emotion, voice tone, accent, grammar or fluency. Questions are about the candidate's own specific choice, evidence comes from their words with an exact quote, there is no overall score, and the card is portable to other employers.

**2. Can the AI be biased against how someone writes or speaks?**
It can, so we test it. A CI test runs the evidence extractor on the same answer with 6 names and dialect variants. If any skill level changes, the build fails. Models never see name, email, university or video.

**3. What about candidates without a camera, with a disability, or with slow reactions?**
Every checkpoint works in text. Timers extend 1.5x or 2x, and extra time switches on turn-based mode automatically. There is a list view instead of the map, full keyboard play, and nothing is measured on real-time speed, clicks or movement.

**4. How do you know the game is fair across groups?**
We don't yet, with real candidates. The dashboard computes completion and shortlist rates by answer mode, accommodation and opt-in group, and flags anything below four-fifths of the top rate for review. In the demo that runs on 200 fictional candidates, labelled as fictional.

## Privacy and compliance

**5. Who owns the data?**
The candidate. They choose each share, can withdraw a share (the employer then sees "Candidate withdrew this card"), hide a recording, and delete everything in one click.

**6. Is this legal in Canada?**
We designed to the rules we know about: Ontario's 2026 requirement to disclose AI use in job postings, and Quebec Law 25's duty to explain automated decisions. We have a plain-language "How we use AI" page, and no decision is automated. We are not lawyers; a real launch needs a legal review and a privacy impact assessment.

**7. What about the EU or emotion recognition?**
The EU bans emotion recognition at work. We don't do it, by design, not by setting.

**8. What is a witness, and is their data safe?**
Someone who saw the candidate's real story confirms it through a one-time link that expires in 14 days. The card shows the relationship ("1 community partner") and their sentence, never their email. A witness email matching the candidate's own address or domain is rejected.

## Cheating and AI

**9. Can't a candidate just use ChatGPT?**
They can try. The question quotes the choice they made seconds ago, with 15 seconds to think and 60 to answer, and paste is disabled in text mode. Research in our brief: AI-assisted cheaters passed 73% of standard coding questions but only 25% of custom ones. We make outside help less useful rather than trying to detect it.

**10. Can someone learn the "right" answers?**
There is no single winning route. Which disruption fires and which checkpoints open are picked by a per-candidate seed. What counts is how well you explain your trade-off, not which path you took.

**11. What if the AI makes up a quote?**
Every quote is checked in code as an exact substring of the transcript. If it does not match, it is dropped and the skill drops a level. Every AI sentence on the card links to its source.

**12. Does focus loss count against people?**
No. Tab switches and retakes are shown as "For context, not scored".

## Validity

**13. Does a game actually predict job performance?**
Not proven for our game yet. It is built on what does predict: structured interviews (.42) and work samples (.33) beat years of experience (.07). Our checkpoints are a structured interview about a work sample. The next step is a validation study comparing card evidence with hiring-manager ratings.

**14. How accurate is the AI scoring?**
We are building a gold set of 40+ answers scored by both of us by hand, with a target of 80% agreement and nothing off by two levels. It is not finished (B.10 is open), so we won't quote a number yet.

**15. Why a turning point?**
McKinsey found candidates who experienced a setback and recovered are more likely to make partner. Resumes show the success; we want to see the recovery.

## Business

**16. Who pays?**
Employers, per active challenge or per seat. Candidates and their practice mode stay free; the PRD rules out paid boosts. Universities get practice and outcome data for free as the candidate channel.

**17. What does it cost to run?**
The demo costs nothing: the AI runs locally with no model calls. In production the expensive parts are transcription and one evidence pass per candidate. We have not priced this at scale yet; the AI health page already tracks calls, latency and cost per service.

**18. Why not use existing tools (HireVue, Pymetrics, case interviews)?**
They test you on their scenario and give a score. We test how you handle it when your own plan breaks, ask about your exact choice, link it to a real story, give evidence instead of a score, and let the candidate reuse the card.

**19. How does it fit an employer's ATS?**
Today: shortlist export to a mock Greenhouse endpoint, with a link back to each card. Webhooks and Second Look (bringing back strong candidates the resume screen rejected) are built on a branch and not in this demo yet. Don't claim them unless merged.

**20. How does it scale to 244 applications per role?**
The card takes about a minute to read. The inbox filters by skill evidence and supports keyboard review. Because cards are portable, a candidate plays once and shares many times, so volume per candidate goes down too. Real recruiter minutes are not measured yet; the dashboard shows "awaiting data".

## Lines to avoid

- "Our AI decides" or "the score". There is no overall score and no auto-reject.
- "Proven", "validated", "predicts". Not yet.
- Any number not in the research brief.
- "Second Look", "Resume vs Evidence", "Final score": not in main. The Final score on `claude/v2-integrations` conflicts with the no-overall-score rule; the team must resolve it before it is shown.
