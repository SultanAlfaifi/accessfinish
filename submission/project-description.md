**The AI says "fixed." We check the user can finish.**

AccessFinish is a repair agent on **NVIDIA Nemotron 3 Super**, served by **Nebius Token Factory**, that accepts a fix only when a keyboard-only user can actually complete the task: the booking is made with real keystrokes, the database holds what was typed, and a fresh browser shows it back.

*Access:* can a keyboard user get through? *Finish:* is what they typed actually saved?

▶ [Demo video: a 2-minute screen recording](https://youtu.be/XztxzjYYlO0) · [Replay every run](https://sultalfaifi.com/accessfinish/) · [Raw evidence for all 54 runs](https://sultalfaifi.com/accessfinish/evidence.html) · [Source on GitHub (MIT)](https://github.com/SultanAlfaifi/accessfinish)

## Inspiration

Coding agents write a growing share of UI fixes, and they judge success by the signals that are easiest to fake: a green build, a page that loads, a confirmation message. For people who rely on a keyboard or assistive technology, "it renders" is not the same as "I can finish".

We saw this as soon as we asked an agent to fix a booking form that keyboard users couldn't complete. It soon produced patches that reached the "booked" page while the booking was saved, or reopened, with the wrong date. In our runs this happened **77 times**. In **all 27** keyboard runs, the first patch that reached a "booked" page was wrong, so a check that trusts the confirmation page would have shipped a broken fix every time.

The usual checks miss it. Rule scanners such as axe or Lighthouse inspect one rendered page and never type a date or read the database, and the app's own tests never touch the booking page. Meanwhile, about **1.3 billion people (16%)** live with a significant disability (WHO), **95.9%** of the top million home pages have detectable WCAG failures (WebAIM Million 2026), and since **28 June 2025** the European Accessibility Act requires in-scope services such as e-commerce to be accessible.

## What it does

You give AccessFinish a goal, such as *"a keyboard-only customer books the 09:00 slot, and it is saved and reopens with that exact date"*. It then loops:

1. **Observe.** A real browser runs the journey with the keyboard only. It records where focus goes, where it gets stuck, and which page code changed what the user typed.
2. **Repair.** Nemotron gets the goal, the evidence and the source code, but **never the root cause or the fix** (the acceptance checks do name the date field and how the verifier types into it). It investigates with read-only `search_code` and `read_file`, then proposes exact code edits and explains which evidence its diagnosis accounts for.
3. **Verify.** Each candidate is built and run in a fresh, offline sandbox. A keyboard-only browser makes the booking, a read-only database account reads back what was saved, and a fresh browser reopens the booking. Regression checks follow: a mouse booking with different data through month navigation, a cleared date, a reserved slot, untouched records and sandbox isolation.
4. **Feed back.** Whatever failed goes back to Nemotron: a compile error with its code frame, a stuck key, a wrong saved value, or the call chain that overwrote the date. A ledger of earlier attempts goes with it. Nemotron gets up to 12 attempts, and **nothing is accepted unless every check passes.**

The web page replays any run step by step: the stuck keyboard trail, Nemotron's searches, diagnosis and diff, each verdict with its evidence, and the proof card with a downloadable patch.

## How we built it

- **Model:** `nvidia/nemotron-3-super-120b-a12b` through Nebius Token Factory's OpenAI-compatible API, with three tools: `search_code`, `read_file` and `propose_repair`. Every request's tokens, cost and reasoning are recorded.
- **Causal provenance:** the verifier hooks the date field's value setter before the app loads and records DevTools async stack traces. The evidence then names the exact code that overwrote what the user typed: `setDate ← applyUnavailableDates ← getUnavailableDates ← onMonthChange`.
- **Exact edits:** each edit must match the source exactly once. Whitespace slips are tolerated, like `git apply --ignore-whitespace`, and every adjustment is recorded. Ambiguous anchors are never guessed.
- **Sandbox:** separate Docker containers for the app (PHP), MariaDB, a trusted compiler, Playwright browsers and a read-only SQL reader. They run with no network, no model key, read-only roots, dropped capabilities and resource limits. Model output never becomes a shell command.
- **Target:** a pinned copy of the open-source Easy!Appointments app with synthetic data. It has two journeys: a **real upstream keyboard bug**, and a **seeded phone fault** that we use to calibrate the verifier.
- **Page:** plain HTML, CSS and JavaScript, usable by keyboard and screen reader.

## Results

All **54 runs** were made live on fresh GitHub Actions runners, **$6.38 in total** (estimated at list price). After each batch we read the failed traces, improved the loop and released a new agent version. From v2 on, results are never mixed across versions.

- **0 of 77 false fixes accepted.** 67 saved the wrong date and 10 reopened wrong. The database read-back or the reopen caught every one.
- **Real upstream bug:** fixed by Nemotron, with no root cause supplied, in **2 of 10 runs of agents v4–v5** (0 of 17 before). In the first verified run, Nemotron's final four edits touch the same code sites as our earlier guided fix, with guard logic of its own.
- **Why 2 of 10, while the phone control verifies 27 of 27:** the keyboard bug has three layers, and each stays hidden until the one before is fixed. First the date can't be reached; then it is overwritten half a second after typing; then reopening resets it to today. One patch must fix all three, with no root cause supplied. The phone fault is a single bug in one line.
- **Seeded phone control:** verified in **27 of 27** runs, 26 on the first attempt, at about a cent per run.
- **Nemotron on Token Factory:** 78% of prompt tokens came from the prompt cache and 80% of output tokens were reasoning. A proposal took a median of 19 s, and a verified keyboard fix in agents v4–v5 cost about $1.70.
- **The demo video** records a further live run on 29 October. It rejects a "booked" page that saved 1 Nov instead of 9 Nov, then a booking that reopened as today, and is verified on attempt 5, about six minutes after **Run live**, for about $0.09. It was one of five live takes recorded for the video, and only that one verified; all five traces are in the repository.

## Challenges we ran into

Single-shot fixes weren't enough. Even with the diagnosis supplied, five frozen Nemotron attempts gave 2 full passes on the keyboard case. With no root cause supplied, our first agent version never fixed it: none of its 43 diagnoses named the month-change handler, and 11 blamed time zones.

The turning point was agent v2. It recorded which code wrote the date field and fed that call chain back to Nemotron, together with code search, an attempt ledger and sampling at temperature 0.6. After that, 20 of 39 diagnoses named the real cause. Because v2 changed several things at once, we don't credit the evidence alone.

The rest was harness engineering, measured run by run: whole-line mismatch reports, whitespace-tolerant anchors, tracking "saved right but reopened wrong" as progress, naming read-only code, and returning the file's own lines and compiler code frames. Before each new live batch, we replayed every change against all recorded traces.

## Accomplishments that we're proud of

- Nemotron fixed a **real upstream accessibility bug, all three layers of it**, with no root cause supplied, verified end to end, and on camera.
- A verifier that refused **every one of 77 false successes**.
- Evidence a developer can act on: the keyboard focus trail, typed vs saved values, and the call chain of the code that changed the date.
- **Every run is public**, including the failures, with the agent version that produced it.

## What we learned

- **A success page is a weak oracle.** Only reading back the saved row and reopening the booking told the truth.
- **Causal evidence changes diagnoses.** The same model went from never naming the month-change handler (0 of 43) to naming it in about half its diagnoses (20 of 39) once it could see the call chain, along with code search and an attempt ledger.
- **Many failures are mechanical.** 85 of 258 proposals were rejected before execution because an edit didn't match the file. Returning the file's own lines helped the model recover.
- **Cheap inference makes honest iteration possible.** At $6.38 for 54 live runs, we could measure every agent version live instead of arguing about it.

## What's next

**A merge gate in CI.** A coding agent or a person opens a pull request, AccessFinish runs the journey in its sandbox, and the merge is blocked unless the outcome is proven. [Here is the comment it would post](https://github.com/SultanAlfaifi/accessfinish/blob/main/examples/pr-comment.md), rendered from a recorded run. After that: more journey types (sign-up, checkout, settings), an arrow-key calendar check, and verification driven by a screen reader.

**What "verified" doesn't prove yet:** that the calendar grid works with arrow keys (the verifier types the date into the field), anything a screen-reader user study would show, generality beyond one app and two journeys, or which days the calendar disables after a typed month change.

*Synthetic data in a pinned copy of Easy!Appointments (GPL-3.0). NVIDIA and Nebius names identify the model and service used; no affiliation or endorsement is claimed.*
