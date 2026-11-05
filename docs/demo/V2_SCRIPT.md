# V2 demo script and rehearsal record (#47)

Target: four minutes. This is a script for the integrated build, not evidence that the full v2 flow is available or rehearsed. Deployment remains with Div and requires Haris's authorization.

| Time | Action | Spoken point | Dependency |
| --- | --- | --- | --- |
| 0:00–0:20 | Open title screen and select the prepared avatar | A resume describes what someone claims. Here, we watch choices when the plan breaks. | Map/title integration |
| 0:20–0:55 | Employer selects tech-to-business communication, analytical thinking and discovery; confirm Value Mapper mappings | Employers choose the capabilities they need and confirm how their language maps to the shared framework. | Builder and Value Mapper |
| 0:55–1:35 | In Launch Week, visit a vendor with an urgent issue. Pick an explain-on-pick option, answer in text, defer another issue with a reason | The checkpoint asks about the exact choice. Camera use is optional. The clock pauses while answering. | Map, checkpoint and deferral integration |
| 1:35–2:00 | Trigger the prepared turning point and commit a recovery plan | The plan breaks. We observe how the candidate protects the core goal and brings people along. | Demo shortcut, turning-point cutscene |
| 2:00–2:35 | Open a prepared finished card; inspect a source quote, KPI and said-vs-did context | Every summary needs evidence. Nothing scores faces, accent or tone. Context is not an automatic penalty. | Map card, consistency service |
| 2:35–3:05 | Show Resume vs Evidence, score breakdown and Second Look restore | Claimed experience is distinct from observed evidence. No score threshold can hide or reject a candidate. A human decides. | Resume, scoring and Second Look integrations |
| 3:05–3:25 | Ask Copilot where prioritization appeared and follow the citation | Reviewers can ask where evidence appears, with a link to the source. | Grounded Copilot |
| 3:25–4:00 | Open `/admin/impact`, select Fictional demo cohort, show a fairness flag and an Awaiting data tile | These 200 candidates are fictional. The dashboard demonstrates what we can measure and makes missing measurements visible. Fairness flags trigger investigation, never decisions about an individual. | Dashboard in this PR |

## Preparation

Use a disposable browser profile. Load the fictional cohort explicitly on the impact page. Keep its banner visible. Pre-open the candidate and recruiter tabs. Check camera permissions if demonstrating video, and prepare text mode as the equivalent fallback. Do not show witness emails or production credentials. Choose one coherent scenario per live run; the employer setup can use The Client Pivot, but label the Launch Week segment as a separate prepared example if switching.

## Rehearsals

| Run | Status | Reason |
| --- | --- | --- |
| 1 | Blocked | Current main does not contain the integrated map UI, Value Mapper, Copilot, Resume vs Evidence or Second Look flow. |
| 2 | Blocked | Same integration dependencies. No full-flow rehearsal or timing is claimed. |

Div's agents: post the integrated preview and demo shortcut contract after Parts A to D land. Then run this script twice, record actual elapsed time and issues, and only tick I.1 when both finish without a bug. Keep awaiting-data tiles until their measured contracts are available.
