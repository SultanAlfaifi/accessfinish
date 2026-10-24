# AccessFinish

## Elevator pitch

The AI says "fixed". AccessFinish checks the user can finish — and keeps repairing until they can.

## Inspiration

Ask an AI to fix a broken form and it will tell you it's fixed. The page loads, maybe a confirmation appears. But a keyboard user still can't reach the date picker, or the booking is saved with the wrong phone number. For people who rely on a keyboard or assistive technology, "it renders" is not the same as "I can finish". We wanted an agent that only stops when the real outcome is right.

## What it does

AccessFinish is a repair agent for broken user journeys. Given a goal like "a keyboard-only customer books the 09:00 slot and it's saved for that date", it:

1. **Observes** the journey in a real browser using only the keyboard, recording where focus goes and where it gets stuck.
2. **Diagnoses and repairs** with NVIDIA Nemotron 3 Super: the model gets the goal, the verifier's evidence and the source files — no hints — and proposes exact code edits.
3. **Verifies for real** in a fresh offline sandbox: build, keyboard booking, database read-back through a read-only account, reopen in a fresh browser, plus regression checks (mouse booking with different data, clearing the date, reserved slots, untouched records, sandbox isolation).
4. **Feeds the evidence back** when anything fails — a compile error, a stuck key, a wrong saved value, a page request that silently changed the date — and tries again, up to eight attempts. The agent can also open any other source file with a read-only `read_file` tool, like a developer following the code.

The web page replays each run as a timeline: the stuck keyboard trail, Nemotron's diagnosis and diff, each verifier verdict, and the final proof with a downloadable patch.

## How we built it

- **Model:** `nvidia/nemotron-3-super-120b-a12b` on **Nebius Token Factory**, with two tools: `read_file` (read-only, any app source file) and `propose_repair`. Edits must match the original source exactly once or they are rejected before execution. Token usage and cost are recorded for every request.
- **Verifier:** Node.js orchestration of Docker containers for the app (PHP), MariaDB, a trusted Babel compiler, Playwright browsers and a read-only SQL reader. Candidate code runs with no network, no model key, read-only roots, dropped capabilities and resource limits.
- **Target app:** a pinned copy of open-source Easy!Appointments with synthetic data. Two journeys: a real upstream keyboard bug in the date picker, and a seeded fault where confirmation hides a wrong saved phone number.
- **Page:** plain HTML, CSS and JavaScript, no dependencies.

## Results

All runs were made live on fresh GitHub Actions runners with Nemotron 3 Super on Nebius Token Factory, 14 runs for $0.41 in total:

- **Saved phone:** fixed and verified on the first attempt in **7 of 7** runs, about 100 seconds and half a cent each.
- **Keyboard date:** not fixed yet — 0 of 7. Nemotron made the date reachable with Tab, but **15 attempts showed a "booked" confirmation while the database held the wrong day**. AccessFinish rejected every one. Its recorded timeline pinpoints the cause: right after the date is typed, the page requests `get_unavailable_dates` and, with no key pressed, the field jumps from 02/11 to 01/11, because a helper selects the first available day of the month.

## Challenges

Single-shot fixes weren't enough. In an earlier frozen test, five guided Nemotron attempts on the keyboard case gave 2/5 full passes: two didn't compile and one fixed the keyboard but broke the mouse calendar. One earlier repair even saved the *wrong date* while showing success. Those are exactly the failures a confirmation-page check misses — so we built the loop around the verifier's evidence instead of the model's confidence.

## Accomplishments

- A verifier that refused 15 AI fixes whose confirmation page said "booked" while the wrong date was saved.
- Evidence a developer can act on: the keyboard focus trail, typed vs saved values, and a timeline of the page's own requests showing the moment the date changed by itself.
- Proof that's hard to fake: the database row, the fresh-browser reopen, and a second customer that defeats hardcoded fixes.
- Every run, including failures, is kept with its raw evidence.

## What's next

More journey types (sign-up, checkout, settings), screen-reader-driven verification, and a GitHub app that opens a pull request with the verified patch and its proof attached.

## Built with

NVIDIA Nemotron 3 Super · Nebius Token Factory · Node.js · Docker · Playwright · PHP · MariaDB · Easy!Appointments (GPL-3.0)
