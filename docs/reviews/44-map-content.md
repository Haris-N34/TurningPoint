# Launch Week map content review (#44)

Reviewed all 16 scheduled/turning-point issues and both escalations against the v2 schema. Source: `scripts/build-launch-week-map.py`; regenerated `content/maps/launch-week.json`.

- Priya talks about shift coverage and handover; Theo names practical constraints; Rosa explains supplier commitments; Kenji negotiates a concrete fee; Dana advocates for families.
- The five weekdays prepare a Saturday/Sunday market. Recovery options now state which dates or programme elements change.
- Recovery dialogue works with all three seeded disruptions. Venue cancellation is a booking problem distinct from the food permit. Venue and volunteer calls explain the existing budget reductions.
- Kenji's initial request and escalation use $400/$200 consistently.
- Vendor reassurance asks for operational details rather than judging appearance. Feedback wording now distinguishes making a change from defending an unchanged plan, matching the existing KPI tags.
- Options name commitments and risks without promising future attendance or implying that volunteer promotion costs no effort.

A recursive comparison against the base JSON verified every non-wording field unchanged, including ids, effects, times, flags, KPI hooks and issue structure. Existing engine tests cover schema, concurrency and outcomes. No game component or engine changes.

Remaining integration considerations for Div: all recovery alternatives still share the same three follow-up issues; the venue and volunteer variants would benefit from distinct follow-up mechanics later. This wording review does not change those mechanics or claim a timed user rehearsal.

Validation: lint, typecheck and all 168 unit tests passed. E2E rerun outside the sandbox with two workers: 67 passed, one laptop-only check skipped on phone. The initial sandbox run failed all 68 browser launches and logged EMFILE watcher errors. No acceptance criteria were newly ticked.
