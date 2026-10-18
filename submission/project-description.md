# AccessFinish

## Elevator pitch

Connect keyboard accessibility repairs to evidence that a real task finished: review the source change, then verify the saved outcome and a fresh reopen.

## Inspiration

A page can load, a test can turn green, and a model can say “fixed” while a keyboard user still cannot book an appointment. We wanted a developer workflow that follows the user's intended outcome all the way to storage and a fresh session.

## What it does

AccessFinish is a local review workbench for a bounded keyboard booking case. It presents the blocked interaction, the exact source proposal, and the independent outcome evidence in one workflow. Developers can request a new NVIDIA Nemotron proposal through Nebius Token Factory, inspect source differences, approve and export a patch, and connect a trusted local verification adapter. Published evidence replay is clearly separated from new live checks.

## How we built it

The portable app uses Node.js and browser-native HTML, CSS, and JavaScript with no runtime package dependencies. The model integration uses NVIDIA Nemotron 3 Super through Nebius Token Factory. Proposals are structured tool calls, constrained to two booking source paths. The patch preview requires a unique literal anchor and preserves source line endings. It never turns model text into a shell command.

For the measured Easy!Appointments case, source, build, browser, application, and read-only evaluator ran in separate Docker roles. The controller compiled the modified code, completed the booking with native keyboard actions, read the stored appointment, and reopened it in a fresh browser to check the date and customer fields. Existing rows were compared to the original fixture.

## What we measured

Nemotron authored three edits after an operator supplied the defect diagnosis. A mixed-line-ending anchor was rejected during the first application. The controller normalized line terminators without changing the proposal's meaning and replayed the edits. The build passed for 83 JavaScript files. Appointment 902 was saved for 19 October 2026, 09:00–09:30 Asia/Riyadh, then reopened with the same date and customer data. Existing business rows were preserved; reopening did not modify the database.

Failed runs remain documented. The evidence supports one guided development case, not general autonomous repair, hidden-case performance, or a screen-reader user study. The earlier operator-authored booking is not counted as a Nemotron-authored repair.

## Challenges

The hard part was the boundary between a plausible model answer and an actual outcome. A UI success page did not prove persistence, and source anchors that looked identical could differ in CRLF/LF encoding. We kept those failures visible and gave outcome verification its own trusted reader and fresh browser context.

## What is next

Add independent task families, portable isolated application adapters, and evaluations with keyboard and screen-reader users. Broader repair claims require those measurements.

## Track

Coding and Agentic Engineering.

## Built with

NVIDIA Nemotron 3 Super, Nebius Token Factory, Node.js, JavaScript, HTML, CSS, Docker, Playwright, PHP, MariaDB, FFmpeg.

## New work during the submission period

AccessFinish's review workbench, model and tool integration, exact-edit guard, independent outcome checks, and the recorded guided development experiments were created during September–October 2026. Easy!Appointments is a separately attributed upstream open-source application, not our original application.
