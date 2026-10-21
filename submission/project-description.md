# AccessFinish

## Elevator pitch

AI repair, checked against the task that matters.

## Inspiration

A page can load and a model can say “fixed” while a keyboard user still cannot book an appointment. Even a confirmation page can hide a wrong saved date. We wanted a developer workflow that follows the intended task into storage and a fresh browser session.

## What it does

AccessFinish is a review workbench for an Easy!Appointments keyboard booking case. A developer reviews the exact source edits, approves the proposal hash, and executes it in a fresh isolated fixture. The controller builds the application, performs a native keyboard booking, checks the stored appointment through a separate SELECT-only account, and reopens the same booking in a fresh browser. Existing business records must remain intact. Pointer booking, unavailable-slot, clear-date, and runtime-boundary checks provide additional regression controls.

The published browser experience reviews recorded executions. It explicitly distinguishes inspection of past evidence from new inference or execution. The downloadable local build performs new execution without a model key; new source generation additionally needs the operator's Nebius configuration and budget.

## How we built it

NVIDIA Nemotron 3 Super (`nvidia/nemotron-3-super-120b-a12b`) is served through Nebius Token Factory. The operator supplies the diagnosis and repair direction; Nemotron returns structured literal source edits to two allowed paths. Anchors must match exactly once. Line endings are normalized for application, with no operator changes to the model's semantic edits.

The Node.js workbench has no host npm dependencies. Docker separates source application, trusted compilation, database, browser, and independent reader roles. Candidate execution has no external network or model keys, read-only roots, dropped capabilities, and resource limits. No model response becomes a shell command. Browser review uses native HTML, CSS, and JavaScript; the synthetic application is PHP/MariaDB.

## What we measured

On October 21, three development requests were followed by five frozen requests on one exposed case. **Two of five passed the complete procedure.** Two failed to compile; another passed keyboard booking and fresh reopen but failed calendar navigation. Every failure and raw model response remains in the repository.

The featured successful proposal contains five model-authored edits. It built 83 JavaScript files and verified a booking for November 2, 2026, 09:00–09:30 Asia/Riyadh in storage and after fresh reopen. A separate pointer booking, reserved-slot exclusion, safe clearing of the date, preservation checks, and inspected runtime boundaries also passed. The browsers were UTC, making timezone consistency part of the check.

Estimated additional model cost across all eight requests was $0.0394581 before tax, with no unknown-usage responses. This is repeated guided generation on one case, not a hidden-case benchmark or a general accuracy claim.

## Challenges

The archived October 18 repair succeeded on its same-month example but saved the wrong date in a fresh cross-month fixture. Deferred calendar callbacks were overwriting typed input. Passing the keyboard path also did not guarantee that ordinary calendar navigation still worked. Independent outcome and regression checks exposed both problems instead of inheriting an older green result.

## Audience and next steps

The initial audience is developers and accessibility QA engineers reviewing AI-generated UI patches. The demonstrated benefit is a traceable acceptance decision tied to the actual booking outcome. User time saved and adoption have not been measured.

Two independent browser-only developer reviews are planned to assess comprehension, navigation, and usefulness. They are not independent setup tests or a screen-reader study. Broader task families, assistive-technology studies, stronger source-generation reliability, and year-boundary tests remain future work.

## Track and new work

Coding and Agentic Engineering. The v0.2 work adds a public clean-start fixture, proposal-bound execution, explicit recorded review, frozen repeated trials with retained failures, and browser-only feedback collection. Easy!Appointments is separately attributed upstream GPL-3.0 software, not our original application. AccessFinish's original workbench and orchestration are MIT licensed.
