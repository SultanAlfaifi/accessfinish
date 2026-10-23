# AccessFinish

## Elevator pitch

Know which AI fix you can accept. AccessFinish connects a proposed repair, approval of its exact version, and independent execution evidence.

## Inspiration

A page can load and a model can say “fixed” while a keyboard user still cannot book an appointment. A success page can also hide the wrong saved phone. We wanted a developer workflow that follows the intended task into storage and a fresh browser session, while keeping the acceptance decision attached to the exact code change.

## What it does

AccessFinish is a repair-review workbench with two exposed development cases in Easy!Appointments: the original upstream keyboard date issue and a deliberately seeded phone serialization fault. A developer reviews exact source edits, approves the proposal hash, and executes it in a fresh isolated fixture. The controller builds the application, performs a native keyboard booking, checks the stored appointment and customer through a separate SELECT-only account, and reopens the same booking in a fresh browser. Existing business records must remain intact. Pointer booking with a different phone, unavailable-slot, clear-date, and runtime-boundary checks provide regression controls.

The published date-case browser experience reviews recorded executions. The new two-case workbench and v04 film are prepared for review on the current development branch; publication is pending. Inspection of past evidence is explicitly distinguished from new inference or execution. The local build performs new execution without a model key; new source generation additionally needs the operator's Nebius configuration and budget.

## Comparison with conventional tests

We ran six paired variants in twelve fresh isolated executions. A conventional test-only CLI and AccessFinish used the identical compiler, keyboard task, database reader, fresh reopen and regression checks. **Both workflows produced the same correctness outcomes.** Both caught the phone fault despite a confirmation screen, and both rejected a hardcoded repair that passed the first example but saved the wrong value for a different phone.

The demonstrated distinction is the integrated acceptance workflow: review the model's actual change, approve that exact patch, and retain the result with the source, proposal and run identities. Missing and stale approvals were rejected before execution. Conventional CI can implement these integrations too. We do not claim more accurate tests or measured time savings.

## How we built it

NVIDIA Nemotron 3 Super (`nvidia/nemotron-3-super-120b-a12b`) is served through Nebius Token Factory. The operator supplies the diagnosis and repair direction; Nemotron returns structured literal source edits to two allowed paths. Anchors must match exactly once. Line endings are normalized for application, with no operator changes to the model's semantic edits.

The Node.js workbench has no host npm dependencies. Docker separates source application, trusted compilation, database, browser, and independent reader roles. Candidate execution has no external network or model keys, read-only roots, dropped capabilities, and resource limits. No model response becomes a shell command. Browser review uses native HTML, CSS, and JavaScript; the synthetic application is PHP/MariaDB.

## What we measured

On October 21, three development requests were followed by five frozen requests on one exposed case. **Two of five passed the complete procedure.** Two failed to compile; another passed keyboard booking and fresh reopen but failed calendar navigation. Every failure and raw model response remains in the repository.

The featured successful proposal contains five model-authored edits. It built 83 JavaScript files and verified a booking for November 2, 2026, 09:00–09:30 Asia/Riyadh in storage and after fresh reopen. A separate pointer booking, reserved-slot exclusion, safe clearing of the date, preservation checks, and inspected runtime boundaries also passed. The browsers were UTC, making timezone consistency part of the check.

Estimated additional model cost across all eight requests was $0.0394581 before tax, with no unknown-usage responses. This is repeated guided generation on one case, not a hidden-case benchmark or a general accuracy claim.

On October 23, a separately approved new Nemotron request repaired the deliberately seeded phone fault. The diagnosis and repair direction were supplied. The exact returned edit passed fresh AccessFinish and conventional executions, preserving the entered `0000000042`, reopening it correctly, and passing the different-phone `0000000073` control. This is **one model generation and two execution replays**, with an estimated generation cost of **$0.0041457 before tax**. It is separate from both the operator reference comparison and the original five-trial evaluation; the counts are not pooled. Full raw requests, protocols and result records are retained.

## Challenges

The archived October 18 repair succeeded on its same-month example but saved the wrong date in a fresh cross-month fixture. Deferred calendar callbacks were overwriting typed input. Passing the keyboard path also did not guarantee that ordinary calendar navigation still worked. Independent outcome and regression checks exposed both problems instead of inheriting an older green result.

## Audience and next steps

The initial audience is developers and accessibility QA engineers reviewing AI-generated UI patches. The demonstrated benefit is a traceable acceptance decision tied to the actual booking outcome. The evidence covers two exposed cases in one app, including one seeded fault. General repair accuracy, autonomous diagnosis, user time saved and adoption have not been established.

Two independent browser-only developer reviews are planned to assess comprehension, navigation, and usefulness. They are not independent setup tests or a screen-reader study. Broader task families, assistive-technology studies, stronger source-generation reliability, and year-boundary tests remain future work.

## Track and new work

Coding and Agentic Engineering. The work adds a public clean-start fixture, proposal-bound execution, explicit recorded review, frozen repeated trials with retained failures, a fair conventional-test comparison, a second phone-data case and browser-only feedback collection. Easy!Appointments is separately attributed upstream GPL-3.0 software. AccessFinish's original workbench and orchestration are MIT licensed.
