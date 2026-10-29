# AccessFinish — project story

The text submitted to Devpost (Nebius × NVIDIA Global AI Hackathon, track: Coding and Agentic Engineering).

**Elevator pitch:** The AI says "fixed." We check the user can finish: a Nemotron repair agent that drives the real journey by keyboard, reads what was saved, and rejects every fix until it is proven.

*Access:* can a keyboard user get through? *Finish:* is what they typed actually saved?

▶ [Watch the 2-minute film](https://youtu.be/XztxzjYYlO0) · [Replay the agent's runs](https://sultalfaifi.com/accessfinish/) · [Every run with its raw evidence](https://sultalfaifi.com/accessfinish/evidence.html) · [Source on GitHub](https://github.com/SultanAlfaifi/accessfinish)

## Inspiration

Ask an AI to fix a broken form and it will tell you it's fixed. The page loads, maybe a confirmation appears. But a keyboard user still can't reach the date picker, or the booking is saved with the wrong phone number. For people who rely on a keyboard or assistive technology, "it renders" is not the same as "I can finish". We wanted an agent that only stops when the real outcome is right.

It matters at scale: about 1.3 billion people (16%) live with a significant disability (WHO), 95.9% of the top million home pages have detectable WCAG failures (WebAIM Million 2026), and since 28 June 2025 the European Accessibility Act requires in-scope services such as e-commerce to be accessible. Meanwhile coding agents write more and more UI fixes, judged by green builds and success pages — exactly the signals that can lie. Rule scanners such as axe or Lighthouse inspect one rendered page and never type a date or read the database; the pinned app's own tests are two PHP unit-test files that never touch the booking page; and a check that reads the confirmation page passes the wrong patch, every time in our runs.

## What it does

AccessFinish is a repair agent for broken user journeys. Given a goal like "a keyboard-only customer books the 09:00 slot and it's saved for that date", it:

1. **Observes** the journey in a real browser using only the keyboard, recording where focus goes, where it gets stuck, and which page code changes what the user typed.
2. **Diagnoses and repairs** with NVIDIA Nemotron 3 Super: the model gets the goal, the verifier's evidence and the source files, but no root cause and no fix (the acceptance checks do name the date field and how the verifier types into it); it investigates with read-only `search_code` and `read_file` tools, and proposes exact code edits plus the evidence its diagnosis accounts for.
3. **Verifies for real** in a fresh offline sandbox: build, keyboard booking, database read-back through a read-only account, reopen in a fresh browser, plus regression checks (mouse booking with different data through month navigation, clearing the date, reserved slots, untouched records, sandbox isolation).
4. **Feeds the evidence back** when anything fails — a compile error with its code frame, a stuck key, a wrong saved value, the call chain that silently overwrote the date — with a ledger of every earlier attempt and which one got furthest, and tries again, up to twelve attempts.

The web page replays each run as a timeline: the stuck keyboard trail, Nemotron's searches, diagnosis and diff, each verifier verdict with its evidence, and the final proof with a downloadable patch. An evidence page lists all 54 live runs with their raw traces and the results of every agent version.

## How we built it

- **Model:** `nvidia/nemotron-3-super-120b-a12b` on **Nebius Token Factory**, with three tools: `search_code` (a regular expression over the app source), `read_file` and `propose_repair`. Edits must match the source exactly once; the harness tolerates whitespace slips like `git apply --ignore-whitespace` and records every adjustment next to the model's own text. Token usage, cost and Nemotron's reasoning are recorded for every request.
- **Causal provenance:** the verifier hooks the date field's value setter before the app loads and attaches DevTools async stack traces, so evidence names the exact call chain that overwrote what the user typed.
- **Verifier:** Node.js orchestration of Docker containers for the app (PHP), MariaDB, a trusted Babel compiler, Playwright browsers and a read-only SQL reader. Candidate code runs with no network, no model key, read-only roots, dropped capabilities and resource limits.
- **Target app:** a pinned copy of open-source Easy!Appointments with synthetic data. Two journeys: a real upstream keyboard bug in the date picker, and a seeded fault where confirmation hides a wrong saved phone number.
- **Page:** plain HTML, CSS and JavaScript, no dependencies, keyboard and screen-reader accessible.

## Results

All 54 runs were made live on fresh GitHub Actions runners with Nemotron 3 Super on Nebius Token Factory, $6.38 in total (estimated at list price). After each batch we read the failed traces, improved the loop and bumped the agent version; from v2 on, results are never mixed across versions.

- **Every false success was caught:** across 27 keyboard runs, **77 attempts reached a "booked" page while the date was saved wrong (67) or reopened wrong (10).** In all 27 runs the first patch that reached a "booked" page was wrong, so a confirmation-page check would have shipped a wrong patch every time. AccessFinish accepted none.
- **Keyboard date (real upstream bug): fixed by Nemotron, with no root cause supplied, in 2 of 10 runs of agents v4–v5** (0 of 17 before; 2 of 27 overall). It is two bugs: typing a date in a later month fires the date picker's month-change handler, which overwrites the typed date with the first free day; and reopening a booking resets the date to today. In the first verified run Nemotron made the date reachable, was rejected for saving 1 Nov instead of 2 Nov, traced the reset through the recorded call chain `setDate ← applyUnavailableDates ← getUnavailableDates ← onMonthChange`, saved the right date, then — after the harness noted that attempt had got furthest — fixed the reopen bug on top: verified on attempt 6, with four edits at the same code sites as our earlier guided fix but guard logic of its own.
- **Why 2 of 10, while the phone control verifies 27 of 27:** the keyboard case is three layers, each hidden until the one before is fixed. The date field can't be reached by keyboard; once it can, the month-change handler overwrites the typed date half a second later; once that is fixed, reopening the booking resets it to today. One patch has to fix all three, with no root cause supplied, in two editable files, with edits that match the source exactly, within 12 attempts, and without breaking a regression check. The second layer stopped more of the attempts that ran than any other: 67 reached a "booked" page that saved the wrong date, and 10 more saved it right but reopened wrong. Every one was rejected. The phone fault is a single bug in one line of the booking payload. The keyboard rate rose with the harness, with the same model: 0 of 17 runs in agents v1–v3, 2 of 10 in v4–v5.
- **Saved phone (seeded fault, our calibration control):** verified in **27 of 27** runs, 26 on the first attempt (3 of them after the harness's recorded whitespace re-anchoring), about a cent each.
- **Nemotron on Token Factory, by the numbers:** 645 proposals and code lookups with per-step usage (258 and 387); 78% of prompt tokens served from the prompt cache; 80% of output tokens were reasoning; a median of 19 s from the start of an attempt to a proposal; about $1.70 per verified keyboard fix in agents v4–v5 and about $0.01 per phone run.
- **Agent versions, keyboard runs that saved the right date:** v1 0/7 → v2 1/5 → v3 2/5 → v4 2/5 → v5 2/5; verified: v4 1/5, v5 1/5.
- **Verifier calibration:** the original keyboard source stays blocked; a phone patch that hard-codes the test number is rejected when a second customer types a different one; the reference fixes verify; five archived single-shot proposals keep their accept/reject decision in every fresh-runner replay.

## Challenges we ran into

Single-shot fixes weren't enough: in an earlier frozen test, five Nemotron attempts with an operator-supplied diagnosis gave 2/5 full passes on the keyboard case. With no root cause supplied, the first agent version never fixed it: none of its 43 diagnoses named the month-change handler, and 11 blamed time zones. The turning point was agent v2, which recorded which code wrote the date field (the month-change handler's call chain) and fed it back, together with code search, an attempt ledger and sampling at temperature 0.6, so the jump cannot be credited to the evidence alone: 20 of its 39 diagnoses named the real cause. The rest was harness engineering we measured run by run: whole-line mismatch reports, whitespace-tolerant anchors, tracking "saved correctly but reopened wrong" as progress, naming read-only code, returning the file's own lines and compiler code frames. Each change was reviewed adversarially and replayed against every recorded trace before a new live run.

## Accomplishments that we're proud of

- Nemotron fixed a real upstream accessibility bug — two bugs, in fact — with no root cause supplied, verified end to end.
- A verifier that refused all 77 false successes, and that would have let a wrong patch ship in 27 of 27 keyboard runs had it trusted the confirmation page.
- Evidence a developer can act on: the keyboard focus trail, typed vs saved values, and the call chain of the page code that changed the date.
- Every run, including failures, is public with its raw evidence and the agent version that produced it.

## What we learned

- **Causal evidence changed the diagnoses.** The same model went from never naming the month-change handler (0 of 43 diagnoses in v1) to naming it in 20 of 39 (v2), once v2 recorded the call chain that overwrote the typed date (v2 also added code search, an attempt ledger and sampling, so we don't credit the evidence alone).
- **A success page is a weak oracle.** In all 27 keyboard runs the first patch that reached a "booked" page was wrong; only reading back the saved row and reopening the booking told the truth.
- **Many wasted attempts were mechanical.** 85 of 258 proposals were rejected before execution because an edit did not apply; returning the file's own lines with a failed edit, and tolerating whitespace, helped the model recover.
- **Cheap inference makes honest iteration possible.** All 54 live runs cost $6.38, so every agent version could be measured live instead of argued about.

## What's next

A merge gate in CI: a coding agent or a person opens a pull request, AccessFinish runs the journey in its sandbox and blocks the merge unless the outcome is proven. [Here is the comment it would post](https://github.com/SultanAlfaifi/accessfinish/blob/main/examples/pr-comment.md), rendered from a recorded run. Then more journey types (sign-up, checkout, settings), an arrow-key calendar check, and screen-reader-driven verification.

**What "verified" doesn't prove yet:** that the calendar grid works with arrow keys (the verifier types the date into the field its acceptance checks name), anything a screen-reader user study would show, generality beyond one app and two journeys, or which days the calendar disables after a typed month change.
