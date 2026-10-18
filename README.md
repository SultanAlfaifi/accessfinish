# AccessFinish

A keyboard-task repair workbench that connects a source proposal to evidence of a saved outcome.

[Open the evidence replay](https://sultalfaifi.com/accessfinish/) · [Download the portable test build](https://github.com/SultanAlfaifi/accessfinish/releases/download/v0.1.0/accessfinish-test-build.zip) · [View the 91-second demo video](https://github.com/SultanAlfaifi/accessfinish/releases/download/v0.1.0/accessfinish-demo.mp4)

![AccessFinish review workbench](media/workbench-preview.png)

The development example is an Easy!Appointments booking: a non-focusable date control blocks keyboard entry, clearing a date needs a guard, and reopening an appointment must preserve its date. AccessFinish shows the source changes separately from the build, native keyboard interaction, database check, and fresh-browser reopen.

## Run the workbench

Requires Node.js 22 or later. There are no package dependencies.

```sh
npm start
```

Open **http://127.0.0.1:4177**. The workbench loads the included measured case without an API key. Navigate through the blockage, review each source change, approve and export a patch, and inspect the saved appointment evidence. The hosted GitHub Pages version is an **evidence replay**; it does not claim to start a new model run or database check.

```sh
npm test
```

## Request a new Nemotron proposal

Set `NEBIUS_API_KEY` in the server process environment, then restart the app. Keep the key out of browser code, source control, screenshots, and uploaded files. An optional `NEBIUS_PRICE_VERIFIED_AT` UTC timestamp enables paid requests for 24 hours after the operator checks current account pricing.

The **Review a new proposal** section accepts a JSON array with `path` and `content` for the two supported booking files. Download the included original development context as an example. Read the source-sharing checkbox and choose **Analyze with Nemotron**. This transmits that source to Nebius.

The backend uses `nvidia/nemotron-3-super-120b-a12b` through the Nebius Token Factory chat-completions endpoint. One click permits one request with a maximum 2,048 output tokens, a conservative input reservation, a local total reservation of $0.25, and no automatic retry. Reservations remain charged locally when an outcome is unknown. The implementation uses the account prices observed on 18 October 2026 ($0.30/M input and $0.90/M output) and a 100% buffer. These are local guards, not a provider billing limit; recheck prices before enabling a new paid run.

The result is a **proposal**. Exact-anchor and line-ending checks produce a preview. A human reviews the changes before export. Export does not apply a patch to a host repository or execute candidate code.

## Connect an independent local verifier

Set `AF_LOCAL_VERIFY_SCRIPT` to an absolute path to a trusted Node adapter. The app executes that fixed file without a shell, with model API keys removed from the child environment. The adapter must print one JSON object with `booking_verified`, `date`, `start`, `end`, and `timezone`. An adapter can check an isolated database and reopen the same booking in a fresh browser; it must not return success from a page-load check alone.

The recorded Easy!Appointments integration used Docker containers with no external network, read-only application roots, fixed editable source paths, separate source/build/browser roles, and a read-only database evaluator. Review the relevant orchestration and worker sources in `integration/windows-harness/`. This archived harness targets an operator-provisioned Windows Docker fixture; it is **reference code, not the clean-start command for the portable workbench**. The portable app and a new source-proposal request run independently of that fixture.

## Measured result and limits

On 18 October 2026, Nemotron generated three source edits after receiving an operator-provided diagnosis. The first application attempt rejected a mixed-line-ending anchor. The controller normalized only the line terminators, applied the same semantic edits, built 83 JavaScript files, completed the synthetic booking through native keyboard actions, and verified appointment **902**, **19 October 2026, 09:00–09:30 Asia/Riyadh**, in storage and after a fresh browser reopen. Existing appointments, customers, services, and providers were preserved. The reopen did not change the database.

The successful normalized replay made no additional model calls. Failed attempts remain in the evidence. The cumulative measured model cost across the preceding preparation and these experiments was approximately **$0.111143 before tax**, with no unknown-usage responses in that total.

This is one exposed development case with a supplied diagnosis. It does not establish general autonomous defect discovery, a hidden-case benchmark, screen-reader usability, production readiness, or superiority over another coding assistant. The earlier operator-authored booking and the later model-authored source proposal are distinct records.

## Project structure

| Path | Purpose |
| --- | --- |
| `server.cjs` | Local HTTP app, server-side Nebius call, reservation guard, verifier adapter |
| `lib/repair.cjs` | Exact-anchor checks, CRLF normalization, non-executing patch preview |
| `web/` | Keyboard-operable review interface and measured case |
| `evidence/` | Model proposal, usage, failed runs, normalized replay, independent outcome |
| `integration/windows-harness/` | Reviewed source/build/browser integration reference |
| `media/` | Demo video, captions, and editable recording/composition scripts |
| `submission/` | English project description, setup and technology feedback |

## Safety and privacy

The local server binds to `127.0.0.1`, rejects unexpected hosts and cross-origin writes, serves only `web/`, and keeps keys server-side. User-provided source is rendered as text. No model response becomes a shell command. Runtime reservations live in ignored `.runtime/`. The demo customer is synthetic and uses an `.invalid` email domain.

## License and attribution

The AccessFinish workbench and original orchestration code are MIT licensed. Easy!Appointments source excerpts and derivative source patches remain under **GPL-3.0**, with the full upstream license in `third_party/EasyAppointments-LICENSE`; see `THIRD_PARTY_NOTICES.md`. The upstream application is not claimed as our original work. The development source was pinned to commit `4bc7ecd51f3dade8e041558f2c23dda65bd6c43e`.

Built during the Nebius × NVIDIA Global AI Hackathon submission period. Track: **Coding and Agentic Engineering**. The main contribution is the workflow connecting a reviewable model proposal to independent task-outcome evidence.
