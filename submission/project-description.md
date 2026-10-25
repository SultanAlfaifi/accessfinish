# AccessFinish

## Elevator pitch

The AI says "fixed". AccessFinish checks the user can finish — and accepts no fix until they can.

*Access:* can a keyboard user get through? *Finish:* is what they typed actually saved?

## Inspiration

Ask an AI to fix a broken form and it will tell you it's fixed. The page loads, maybe a confirmation appears. But a keyboard user still can't reach the date picker, or the booking is saved with the wrong phone number. For people who rely on a keyboard or assistive technology, "it renders" is not the same as "I can finish". We wanted an agent that only stops when the real outcome is right.

It matters at scale: about 1.3 billion people (16%) live with a significant disability (WHO), 95.9% of the top million home pages have detectable WCAG failures (WebAIM Million 2026), and since 28 June 2025 the European Accessibility Act requires in-scope services such as e-commerce to be accessible. Meanwhile coding agents write more and more UI fixes, judged by green builds and success pages — exactly the signals that can lie.

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
- **Keyboard date (real upstream bug):** not fixed by the agent yet — 0 of 7. Of 43 proposals, 7 were rejected before running, 21 left the keyboard user stuck, and **15 were false successes: "booked" on screen, the wrong day in the database**. Every run produced at least one, so a confirmation-page check would have shipped a wrong patch in **7 of 7 runs**. AccessFinish accepted none.
- The recorded timeline pinpoints why: right after the date is typed, the month-change callback requests `get_unavailable_dates` and, with no key pressed, the field jumps from 02/11 to 01/11. The bug is fixable inside the files the agent may edit — Nemotron's own operator-guided fix from 21 October passes this verifier and is re-verified on every run — so the gap is diagnosis, not an impossible task.
- **Verifier calibration:** the original keyboard source stays blocked; a phone patch that hard-codes the test number is rejected when a second customer types a different one; the reference fixes verify; five archived single-shot proposals replay to their recorded outcomes on a fresh runner.

## Challenges

Single-shot fixes weren't enough. In an earlier frozen test, five Nemotron attempts with an operator-supplied diagnosis gave 2/5 full passes on the keyboard case: two didn't compile and one fixed the keyboard but broke the mouse calendar. One earlier repair even saved the *wrong date* while showing success. Those are exactly the failures a confirmation-page check misses — so we built the loop around the verifier's evidence instead of the model's confidence. The hardest part was making that evidence precise enough for a model to reason from: we went from "saved the wrong day" to a second-by-second timeline of the page's own requests and the moment the date changed by itself.

## Accomplishments

- A verifier that refused all 15 false successes — fixes whose confirmation page said "booked" while the wrong date was saved — and that would have let a wrong patch ship in 7 of 7 runs had it trusted the confirmation page.
- Evidence a developer can act on: the keyboard focus trail, typed vs saved values, and a timeline of the page's own requests showing the moment the date changed by itself.
- Proof that's hard to fake: the database row, the fresh-browser reopen, and a second customer that defeats hardcoded fixes.
- Every run, including failures, is kept with its raw evidence.

## What's next

More journey types (sign-up, checkout, settings), screen-reader-driven verification, and a GitHub app that opens a pull request with the verified patch and its proof attached.

## Built with

NVIDIA Nemotron 3 Super · Nebius Token Factory · Node.js · Docker · Playwright · PHP · MariaDB · Easy!Appointments (GPL-3.0)
