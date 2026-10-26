# AccessFinish

**The AI says "fixed". AccessFinish checks the user can finish.**

AccessFinish is a repair agent built on **NVIDIA Nemotron 3 Super** (served by **Nebius Token Factory**). It doesn't trust a green confirmation page. It drives the real user journey with a keyboard, reads what was actually saved in the database, reopens it in a fresh browser, feeds every failure back to Nemotron — and **accepts no fix until that saved outcome is correct**.

*Access:* can a keyboard user get through? *Finish:* is what they typed actually saved?

▶ **Live page:** https://sultalfaifi.com/accessfinish/ · **Film (2 min):** https://youtu.be/ZHSP0GYMM20 · Track: **Coding and Agentic Engineering**

**In 54 live runs:** a seeded data fault fixed and verified 27/27 times · a real upstream keyboard bug fixed by Nemotron, with no diagnosis supplied, in 2 of 10 runs of agents v4–v5 · **77 false "booked" confirmations caught, none accepted**.

![AccessFinish agent timeline](media/workbench-preview.png)

## The loop

```
Observe ──► Diagnose & repair ──► Verify for real ──► verified? ── yes ──► patch + proof
   ▲              (Nemotron)        (fresh sandbox)        │
   └──────────── verifier evidence fed back ◄──── no ──────┘
```

1. **Observe.** A headless browser books an appointment with the keyboard only, recording where focus goes and where it gets stuck.
2. **Diagnose & repair.** Nemotron receives the user goal, the verifier's evidence and the complete source files — it is never told the cause or the fix. It investigates with read-only `search_code` and `read_file` tools, then returns exact code edits plus the piece of evidence its diagnosis accounts for.
3. **Verify for real.** Every proposal whose edits apply is built and run in a fresh, offline Docker sandbox. The verifier books with the keyboard, reads the saved row through a read-only database account, reopens the booking in a new browser, then runs regression checks (a mouse booking with different data through month navigation, clearing the date, a reserved slot, unchanged existing records, sandbox isolation).
4. **Feed back.** A build error, a stuck key, a wrong saved value or a broken mouse path goes back to Nemotron as evidence, with a ledger of every earlier attempt and which explanations did not change the outcome, and it tries again (up to twelve attempts since agent version 4, eight before). Nothing is accepted unless every check passes.

## Two broken journeys

| Journey | What the user sees | What's really wrong |
| --- | --- | --- |
| **Keyboard date** (real upstream bug) | The calendar looks fine | Tab can't reach it, so a keyboard user can never book |
| **Saved phone** (seeded fault) | "Booking confirmed" | The database stored `0000000000`, not the phone they typed |

The phone case shows why outcome checks matter: a patch that hardcodes the sample number passes once, then fails when a second customer types `0000000073`.

## Why it matters

- About **1.3 billion people (16%)** live with a significant disability ([WHO](https://www.who.int/news-room/fact-sheets/detail/disability-and-health)); many rely on a keyboard or assistive technology instead of a mouse.
- **95.9%** of the top million home pages have automatically detectable WCAG failures ([WebAIM Million 2026](https://webaim.org/projects/million/)).
- Since **28 June 2025** the [European Accessibility Act](https://eur-lex.europa.eu/eli/dir/2019/882/oj) requires in-scope services, including e-commerce, to be accessible.
- Coding agents now write a growing share of UI fixes. A green build or a confirmation page is exactly what they optimise for — and exactly what can be wrong. AccessFinish checks the outcome a person actually needs.

## Results (live, 24–26 October 2026)

Every run below was made live on a fresh GitHub Actions runner with Nemotron 3 Super on Nebius Token Factory: **54 runs, $6.38 of Nemotron in total**. Traces, patches and raw evidence for all of them are in [`evidence/agent-runs/`](evidence/agent-runs/) and on the [evidence page](web/evidence.html); totals are in [`web/agent-runs/summary.json`](web/agent-runs/summary.json). After each batch we read the failed traces, changed the loop and bumped the agent version; from v2 on, results are never mixed across versions. "No diagnosis supplied" means Nemotron gets the goal, the acceptance checks (which name the date field and how the verifier types into it), the verifier's evidence and the harness's notes on its own earlier attempts, but never the cause or the fix.

| Agent | What changed | Keyboard: saved correctly | Keyboard: **verified** | Phone: verified (1st attempt) |
| --- | --- | --- | --- | --- |
| v1 | Pre-versioning runs from seven successive loop commits: observe → propose → verify → feed back; caps of 4, 6, then 8 attempts; `read_file` in the last run only | 0 / 7 | 0 / 7 | 7 / 7 (7) |
| v2 | `search_code`, call-chain provenance of the date field, attempt ledger, reopen evidence | 1 / 5 | 0 / 5 | 5 / 5 (5) |
| v3 | Whitespace-tolerant anchors, whole-line mismatch reports | 2 / 5 | 0 / 5 | 5 / 5 (5) |
| v4 | Reopen progress tracked, wrong-path edits moved, read-only code named, 12 attempts | 2 / 5 | **1 / 5** | 5 / 5 (5) |
| v5 | The file's own lines with a failed anchor; a code frame with a compile error | 2 / 5 | **1 / 5** | 5 / 5 (4) |

- **Phone (seeded fault):** 27 of 27 runs verified, 26 on the first attempt (in the other, Nemotron's first answer named an earlier attempt that did not exist yet; in 3 of the 26, its edit applied only after the harness's whitespace re-anchoring, recorded in the trace). Nemotron traces the wrong saved value to the hardcoded `phone_number` in the booking payload, and the fix passes all nine checks, including a second customer with a different number. About a cent per run.
- **Keyboard date (real upstream bug): fixed by Nemotron, with no diagnosis supplied, in 2 of 10 runs of agents v4–v5.** It is two bugs. Typing a date in a later month fires the date picker's month-change handler, which requests `get_unavailable_dates` and overwrites the typed date with the first free day; and reopening a saved booking resets the date to today when **Next** is pressed. In run [`2c87e16a`](evidence/agent-runs/agent-2c87e16a520f678b45cbbbeb.json) (v4) Nemotron made the date reachable (attempt 2, rejected: saved for 1 Nov instead of 2 Nov), traced the reset through the recorded call chain `setDate ← applyUnavailableDates ← getUnavailableDates ← onMonthChange` (attempt 4: saved correctly, but reopening showed today), then — after the harness noted that attempt 4 had got furthest — built on it to keep the date on **Next** (attempt 6: **verified**). Its four edits touch the same code sites as our earlier guided reference fix, with guard logic of its own; it passed the keyboard booking, the read-only database check, the fresh-browser reopen, a mouse booking through month navigation, clearing the date, a reserved slot and sandbox isolation. The second verified run, [`2367fdf7`](evidence/agent-runs/agent-2367fdf762b0a63d26ee048b.json) (v5), got there on attempt 11.
- **Every false success was caught.** Across 27 keyboard runs, **77 attempts reached a "booked" page while the booking was saved, or reopened, with the wrong date**. In all 27 runs the first patch that reached a "booked" page was wrong, so a confirmation-page check would have shipped a wrong patch every time. AccessFinish accepted none of them.
- **Where attempts still go:** of 234 unverified keyboard attempts, 85 were edits that did not apply (an anchor copied inexactly, overlapping or ambiguous, or empty), 77 reached a wrong "booked" page, 51 left the keyboard user stuck, 13 did not compile and 8 were malformed or repeated; the harness now returns the file's own lines and compiler code frames, and every failure is in [the traces](web/evidence.html).

That keyboard result is the point of AccessFinish: a model, a confirmation page and a green build all said "done" 77 times while the date was saved wrong (67) or reopened wrong (10) — until the fix was real.

## Verifier calibration

| Control | Expected | Result |
| --- | --- | --- |
| Original keyboard source (no fix) | blocked | blocked |
| Phone patch that hardcodes the test number `0000000042` | rejected | rejected by the second customer typing `0000000073` |
| Reference phone fix | verified | verified |
| Nemotron's guided keyboard fix (21 Oct) | verified | verified on every agent run |
| Five frozen single-shot proposals replayed on fresh runners (four replays) | 2 pass, 3 fail | accept/reject matched 5 / 5 every time; failure stage 5 / 5 on 21 and 23 Oct, 4 / 5 on 24 Oct |

Sources: [`evidence/extension-ci-20261023/summary.json`](evidence/extension-ci-20261023/summary.json), [`evidence/clean-execution-20261021/summary.json`](evidence/clean-execution-20261021/summary.json) and the `Pipeline check` step of [`agent-run.yml`](.github/workflows/agent-run.yml).

## Run it

Requires **Node.js 22+** and **Docker** (Linux engine). No npm dependencies on the host.

```sh
npm run demo:setup                     # build the pinned sandbox images (several GB, once)
export NEBIUS_API_KEY=...              # your Token Factory key
node scripts/agent.cjs --case keyboard-date
node scripts/agent.cjs --case customer-phone
```

Or start the page with `npm start`, open http://127.0.0.1:4177 and press **Run live**. Without a key, `npm run replay` serves the recorded runs at http://127.0.0.1:4178; `evidence.html` lists every live run, and `?case=keyboard-date&run=<id>` replays any of them.

`--publish` saves a finished run (trace, verified patch and evidence) to `web/agent-runs/` and `evidence/agent-runs/`.

## Under the hood

- **Model:** `nvidia/nemotron-3-super-120b-a12b` via `https://api.tokenfactory.nebius.com/v1/chat/completions` (temperature 0.6, top-p 0.95 since agent version 2), with three tools: `search_code` (a regular expression over the whole app source), `read_file` and `propose_repair` (diagnosis, `evidence_explained`, optional `build_on_attempt`, exact edits). Each request's tokens and cost are recorded, and Nemotron's reasoning is kept in the trace for audit only.
- **Causal provenance:** the keyboard verifier hooks the date field's value setter before the app loads and attaches a DevTools async call stack, so evidence names the code that silently changed what the user typed — e.g. `setDate ← setDateTimePickerValue ← applyUnavailableDates ← (XMLHttpRequest) ← getUnavailableDates ← (setTimeout) ← onMonthChange`. A smoke test proves the debugger session never pauses the page.
- **Edits:** each edit's `old` text must match the file exactly once. Since agent version 3, an anchor that occurs nowhere but exactly once when indentation, trailing spaces and blank lines are ignored is pinned to that code and re-indented (like `git apply --ignore-whitespace`); ambiguous anchors are never guessed, and every adjustment is recorded next to the model's own text.
- **Comparable runs:** every trace since agent v2 (40 of 54) records the agent version, commit, fixture fingerprint, temperature and booking date; one booking date (a Monday in a later month, so the date picker must change month) is pinned per CI job.
- **Sandbox:** separate containers for the app, database, compiler, browser and verifier; no network, no model key, read-only roots, all capabilities dropped, CPU/memory/PID limits. Model output never becomes a shell command.
- **App:** a pinned copy of the open-source [Easy!Appointments](https://github.com/alextselegidis/easyappointments) (GPL-3.0) with synthetic data.
- **Code:** `lib/agent.cjs` (the loop), `lib/fixture.cjs` (sandbox and verifier), `integration/portable/` (browser workers and outcome evaluator), `web/` (the page).

```sh
npm test                      # unit tests, including the agent loop
npm run check:records         # earlier recorded evaluation is intact
```

## Earlier evidence

Before the agent, we measured single-shot, operator-guided repairs: on 21 October five frozen Nemotron requests on the keyboard case gave **2/5** full passes (two compile errors, one broken calendar navigation). There the operator supplied the diagnosis; the agent runs above supply none. All raw requests, responses and executions are kept in [`evidence/`](evidence/) and browsable on the [earlier trials page](web/workbench.html).

## Limits

Two journeys in one application; the phone fault was seeded on purpose. The keyboard bug is fixed in 2 of 10 runs, not reliably, and the agent may edit only two files (`booking.js` and the time-step view). The data is synthetic. This is not a screen-reader user study.

## License

AccessFinish is MIT licensed. The bundled Easy!Appointments source and patches to it remain GPL-3.0 — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
