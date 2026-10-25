# AccessFinish

**The AI says "fixed". AccessFinish checks the user can finish.**

AccessFinish is a repair agent built on **NVIDIA Nemotron 3 Super** (served by **Nebius Token Factory**). It doesn't trust a green confirmation page. It drives the real user journey with a keyboard, reads what was actually saved in the database, reopens it in a fresh browser, feeds every failure back to Nemotron — and **accepts no fix until that saved outcome is correct**.

*Access:* can a keyboard user get through? *Finish:* is what they typed actually saved?

▶ **Live page:** https://sultalfaifi.com/accessfinish/ · Track: **Coding and Agentic Engineering**

![AccessFinish agent timeline](media/workbench-preview.png)

## The loop

```
Observe ──► Diagnose & repair ──► Verify for real ──► verified? ── yes ──► patch + proof
   ▲              (Nemotron)        (fresh sandbox)        │
   └──────────── verifier evidence fed back ◄──── no ──────┘
```

1. **Observe.** A headless browser books an appointment with the keyboard only, recording where focus goes and where it gets stuck.
2. **Diagnose & repair.** Nemotron receives the user goal, the verifier's evidence and the complete source files — no diagnosis, no hints — can open any other source file with a read-only `read_file` tool, and returns exact code edits.
3. **Verify for real.** Every proposal is built and run in a fresh, offline Docker sandbox. The verifier books with the keyboard, reads the saved row through a read-only database account, reopens the booking in a new browser, then runs regression checks (a mouse booking with different data through month navigation, clearing the date, a reserved slot, unchanged existing records, sandbox isolation).
4. **Feed back.** A build error, a stuck key, a wrong saved value or a broken mouse path goes back to Nemotron as evidence, and it tries again (up to eight attempts). Nothing is accepted unless every check passes.

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

## Results (live, 24 October 2026)

Every run below was made live on a fresh GitHub Actions runner with Nemotron 3 Super on Nebius Token Factory. Traces, patches and raw evidence for all of them are in [`evidence/agent-runs/`](evidence/agent-runs/); totals are in [`web/agent-runs/summary.json`](web/agent-runs/summary.json). These first 14 runs span the agent's development: between keyboard runs we added richer evidence, raised the attempt limit from 4 to 8 and, in the last run, the `read_file` tool.

| Journey | Runs | Verified | Attempts | Typical time | Nemotron cost |
| --- | --- | --- | --- | --- | --- |
| **Saved phone** | 7 | **7 / 7, all on the first attempt** | 7 | ~100 s | $0.0313 total |
| **Keyboard date** | 7 | 0 / 7 | 43 | 3–12 min | $0.3773 total |

- **Phone:** in every run Nemotron traced the wrong saved value to the hardcoded `phone_number` in the booking payload, and the fix passed all nine checks, including a second customer with a different number.
- **Keyboard date:** not fixed by the agent yet. Of its 43 proposals, 7 were rejected before running, 21 left the keyboard user stuck, and **15 were false successes: the page said "booked" while the database held the wrong day** (1 Nov instead of 2 Nov). Every one of the 7 runs produced at least one false success (first at attempt 2–6), so a confirmation-page check would have shipped a wrong patch in **7 of 7 runs**. AccessFinish accepted none.
- **Why the date was wrong:** the recorded timeline shows that right after the date is typed, the month-change callback in `booking.js` (`onMonthChange`, line 118) requests `get_unavailable_dates`, and with no key pressed the field jumps from `02/11` to `01/11`, because `booking_http_client.js` then selects the first available day of the month. Nemotron kept proposing time-zone and format changes instead.
- **It is fixable inside the editable files:** with an operator-supplied diagnosis, Nemotron wrote a fix on 21 October that guards those callbacks while the date input has focus ([`web/featured-case.json`](web/featured-case.json)). It passes this verifier, and every agent run re-verifies it in CI before calling the model. So the gap is diagnosis, not an impossible task.

That keyboard result is the point of AccessFinish: a model, a confirmation page and a green build all said "done", and the saved outcome said otherwise.

## Verifier calibration

| Control | Expected | Result |
| --- | --- | --- |
| Original keyboard source (no fix) | blocked | blocked |
| Phone patch that hardcodes the test number `0000000042` | rejected | rejected by the second customer typing `0000000073` |
| Reference phone fix | verified | verified |
| Nemotron's guided keyboard fix (21 Oct) | verified | verified on every agent run |
| Five frozen single-shot proposals replayed on a fresh runner | 2 pass, 3 fail at their recorded stage | 5 / 5 matched |

Sources: [`evidence/extension-ci-20261023/summary.json`](evidence/extension-ci-20261023/summary.json), [`evidence/clean-execution-20261021/summary.json`](evidence/clean-execution-20261021/summary.json) and the `Pipeline check` step of [`agent-run.yml`](.github/workflows/agent-run.yml).

## Run it

Requires **Node.js 22+** and **Docker** (Linux engine). No npm dependencies on the host.

```sh
npm run demo:setup                     # build the pinned sandbox images (several GB, once)
export NEBIUS_API_KEY=...              # your Token Factory key
node scripts/agent.cjs --case keyboard-date
node scripts/agent.cjs --case customer-phone
```

Or start the page with `npm start`, open http://127.0.0.1:4177 and press **Run live**. Without a key, `npm run replay` serves the recorded runs at http://127.0.0.1:4178.

`--publish` saves a finished run (trace, verified patch and evidence) to `web/agent-runs/` and `evidence/agent-runs/`.

## Under the hood

- **Model:** `nvidia/nemotron-3-super-120b-a12b` via `https://api.tokenfactory.nebius.com/v1/chat/completions`, with two tools: `read_file` (read-only, any app source file) and `propose_repair`. Edits must match the original source exactly once, or they are rejected before anything runs. Each request's tokens and cost are recorded.
- **Sandbox:** separate containers for the app, database, compiler, browser and verifier; no network, no model key, read-only roots, all capabilities dropped, CPU/memory/PID limits. Model output never becomes a shell command.
- **App:** a pinned copy of the open-source [Easy!Appointments](https://github.com/alextselegidis/easyappointments) (GPL-3.0) with synthetic data.
- **Code:** `lib/agent.cjs` (the loop), `lib/fixture.cjs` (sandbox and verifier), `integration/portable/` (browser workers and outcome evaluator), `web/` (the page).

```sh
npm test                      # unit tests, including the agent loop
npm run check:records         # earlier recorded evaluation is intact
```

## Earlier evidence

Before the agent, we measured single-shot, operator-guided repairs: on 21 October five frozen Nemotron requests on the keyboard case gave **2/5** full passes (two compile errors, one broken calendar navigation). There the operator supplied the diagnosis; the agent runs above supply none. All raw requests, responses and executions are kept in [`evidence/`](evidence/) and browsable on the [evidence page](web/workbench.html).

## Limits

Two journeys in one application; the phone fault was seeded on purpose. The data is synthetic. This is not a screen-reader user study.

## License

AccessFinish is MIT licensed. The bundled Easy!Appointments source and patches to it remain GPL-3.0 — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
