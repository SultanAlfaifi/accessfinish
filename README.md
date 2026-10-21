# AccessFinish

**AI repair, checked against the task that matters.**

AccessFinish connects a reviewable NVIDIA Nemotron source proposal to an isolated build, native keyboard booking, read-only database checks, and a fresh-browser reopen. A plausible patch or a confirmation page alone cannot produce a verified result.

This branch prepares **v0.2.0**. Its evaluated source and evidence are available in [draft PR #1](https://github.com/SultanAlfaifi/accessfinish/pull/1); the [currently published replay](https://sultalfaifi.com/accessfinish/) and v0.1.0 release remain historical until the publication gate is completed. Track: **Coding and Agentic Engineering**.

## Review in a browser

The published experience is a **recorded evidence review**. Inspect the blocked date control, review the exact patch, open its matching execution, and inspect all five evaluation outcomes. Opening a recording starts no model request, build, booking, or fresh verification.

For a local preview without Docker or an API key:

```sh
npm run replay
```

Open **http://127.0.0.1:4178**. The optional browser-only developer review is at `/review.html`; it exports answers locally and does not upload them. Two independent participant sessions are planned, not yet completed. They will not count as independent installation or execution evidence.

## Run a new execution

Requires **Node.js 22+** and a **local Docker Linux engine**. The app has no host npm dependencies. Setup downloads pinned official images and locked application dependencies; allow several GB of disk space. Linux amd64 execution has passed through Windows Docker Desktop and an independent fresh GitHub Linux runner.

```sh
npm run demo:setup
npm start
```

Open **http://127.0.0.1:4177**. Review the packaged Nemotron proposal, approve its exact hash, and choose **Run approved repair**. Execution creates a fresh synthetic source/database fixture, applies the approved edits only inside it, builds the application, and runs the checks. It makes **no model call**. The CLI equivalent is `npm run demo:check`; issuing that command explicitly approves execution of the packaged recorded proposal.

The original-source negative control is `node scripts/demo-check.cjs --original`. Its expected outcome is a blocked task and an unverified booking. The optional `--operator-reference` control combines three archived model edits with two operator-authored guards; it is never counted as fresh model-authored success.

Runs use persistent, separate IDs and source/proposal hashes. Changing the proposal clears the displayed result. Failed and interrupted runs remain failed; a second process cannot take over a live runtime. Runtime data defaults to `%LOCALAPPDATA%/AccessFinish/v0.2` on Windows or `$XDG_STATE_HOME/AccessFinish/v0.2` / `~/.local/state/AccessFinish/v0.2` on Linux. `AF_RUNTIME_DIR` selects another evidence directory. Owned Docker resources are stopped and retained for diagnosis; private fixture credentials stay outside the repository.

## Request a new proposal

The model is **`nvidia/nemotron-3-super-120b-a12b`**, served through **Nebius Token Factory** at `https://api.tokenfactory.nebius.com/v1/chat/completions`. The operator supplies the diagnosis and repair direction. Nemotron proposes literal edits to two supported Easy!Appointments files; exact-anchor validation rejects absent or ambiguous replacements.

Configure these variables in the server process environment, then restart it:

| Variable | Purpose |
| --- | --- |
| `NEBIUS_API_KEY` | Server-side provider key; never place it in browser code or source control |
| `NEBIUS_PRICE_VERIFIED_AT` | UTC timestamp after checking account pricing; expires after 24 hours |
| `NEBIUS_INPUT_USD_PER_MILLION` | Verified current input price |
| `NEBIUS_OUTPUT_USD_PER_MILLION` | Verified current output price |
| `AF_MODEL_BUDGET_USD` | Total local reservation ceiling; default $0.25, maximum $5 |
| `AF_MAX_MODEL_REQUESTS` | Request limit; default and maximum 8 |

The source-sharing checkbox permits one request containing the supplied source. There are no automatic retries. Each request reserves a conservative input bound plus up to 8,192 output tokens, with a 100% buffer and a $0.25 per-request reservation limit. Failed or unknown-outcome reservations remain consumed. These are local accounting guards, not a provider billing limit. A model response is neither approval nor evidence that the task passed.

## Measured evidence

On **21 October 2026**, three development requests were followed by **five frozen evaluation requests on one exposed case**. The prompt, source context, fixture, model integration, executor, and evaluator procedure were bound by hashes before evaluation.

The [exact frozen procedure](evidence/competition-20261021/procedure/) is archived. A subsequent [Linux compatibility fix](evidence/competition-20261021/post-evaluation-compatibility.json) changes only ownership of private fixture files during trusted import. It changes neither model edits nor outcome acceptance logic. Reproduction with the current executor is tracked separately from the five original model-generation trials.

**2/5 passed the full procedure.** Two proposals failed to compile. One saved and reopened the keyboard booking correctly but failed calendar navigation in the regression check. All failures remain in the [trial report](web/trial-report.json) and [raw evidence](evidence/competition-20261021/). No model-authored semantic edits were changed by the operator.

The featured passing example is evaluation **4**, with five Nemotron edits. It built 83 JavaScript files and verified **2 November 2026, 09:00–09:30 Asia/Riyadh**, then passed a separate pointer booking and reopen, reserved-slot exclusion, clear-date error check, preservation checks, and inspected container boundaries. Both application browsers were deliberately UTC, so the stored Riyadh time also had to match correctly.

Additional estimated model cost across all eight requests was **$0.0394581 before tax**, with zero unknown-usage responses. Generation and execution durations are recorded separately; human review time is excluded. The earlier October 18 case and its approximately $0.111143 cumulative historical cost remain separate evidence.

These measurements do not establish general autonomous repair, hidden-case performance, year-boundary behavior, superiority over another assistant, production readiness, screen-reader usability, or user time saved.

## Checks and boundaries

```sh
npm test
node scripts/check-evidence.cjs
npm run check:records
```

The [independent clean-environment run](https://github.com/SultanAlfaifi/accessfinish/actions/runs/39623819548) passed Node 22/24 checks on Windows/Linux, then built the public fixture and replayed all five retained proposals on a fresh Linux runner. All five expected outcomes matched: two verified repairs and three failures at their expected stages. The original-source control remained blocked and left the selected database snapshots unchanged. It made no model requests. [Sanitized records and checksums](evidence/clean-execution-20261021/summary.json) are retained separately from the original model-generation trials.

Source/app/database/compiler/browser/evaluator roles are separated. Candidate execution has no external network, no model-key environment, read-only roots, dropped capabilities, and CPU/memory/PID limits. The application receives only its synthetic fixture account. The independent reader has SELECT-only fixture access and explicitly checks that writes and system-schema access are denied. The reader never mounts the candidate source. Trusted setup builds official images; candidate npm scripts, Composer hooks, and model-generated shell commands are not run.

Preservation checks cover only the appointment, customer, service, and provider columns selected by the reader's snapshots.

## License and attribution

The workbench and original orchestration are MIT licensed. The bundled Easy!Appointments source archive and derivative patches remain **GPL-3.0**, with full source and license supplied. Upstream is pinned to `4bc7ecd51f3dade8e041558f2c23dda65bd6c43e`. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

AccessFinish was developed during the submission period. Easy!Appointments is separately attributed upstream software. The [competition overview](https://nebiusglobalaihackathon.devpost.com/) identifies the infrastructure, public repository, test-build/demo, and public YouTube requirements; the entrant must review the [official rules](https://nebiusglobalaihackathon.devpost.com/rules) and confirm their declarations before submission.
