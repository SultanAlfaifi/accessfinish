# Review AccessFinish

For developers and accessibility QA engineers evaluating an AI-generated UI patch, AccessFinish follows the intended keyboard booking into storage and a fresh browser session.

## A three-minute review

1. Open the [browser workbench](https://sultalfaifi.com/accessfinish/). It needs no account or installation and explicitly reviews recorded evidence.
2. Choose **Review the source repair**. Inspect the five model-authored edits and the recorded Token Factory request. The operator supplied the diagnosis and repair direction.
3. Choose **Inspect this proposal's recorded execution**. The receipt shows November 2, 2026, 09:00–09:30 Asia/Riyadh, independent storage and fresh-reopen checks, and fixed regression controls. Opening it performs no new verification.
4. Read all five evaluation rows: two complete passes, two compilation failures, and one calendar-navigation failure. All failed artifacts remain available.

The featured proposal is `8e7b485a36a94e2ac5ea3d6e7f43d5a8c180748e233349494d8515e5f563aca5`; its recorded run is `run-049e3e26b5b6444794d6a04b04f089b3`. [Independent execution of the published source](https://github.com/SultanAlfaifi/accessfinish/actions/runs/39637182406) reproduced all five expected outcomes and the original negative control without calling a model.

## Execute it yourself

Use Node.js 22+ and a local Docker Linux engine. From the repository or v0.2 test build:

```sh
npm test
npm run check:records
npm run demo:setup
npm run demo:check
node scripts/demo-check.cjs --original
```

The two demo-check commands explicitly approve their fixed packaged proposals. The original control must remain blocked; that command succeeds only when the expected failure is observed. Stop the UI server before using the CLI against the same runtime. See [testing instructions](testing-instructions.md) for interactive approval, runtime locations and new inference using your own server-side configuration.

## Assess the evidence precisely

| Question | Evidence and limit |
| --- | --- |
| Where is NVIDIA used? | Nemotron 3 Super generates structured source edits through Token Factory. Raw requests, responses, token usage and proposals are retained. |
| What earns verified status? | Exact proposal/source/run binding, approval, trusted build, native keyboard task, SELECT-only read, fresh reopen, preservation and fixed regression controls. |
| What does 2/5 mean? | Five repeated requests on one exposed, guided case; no general accuracy or five distinct task families is claimed. |
| What is the impact evidence? | A specific blocked task and preserved expected business outcome. Browser usefulness reviews remain pending. |
| What was created here? | The workbench, proposal-bound orchestration, isolated fixture, independent verification and evidence pipeline. Easy!Appointments remains separately attributed upstream software. |

New generation makes a runtime Token Factory call when configured. Public inspection and replaying a packaged proposal make no new model request. AI Cloud deployment and Tavily integration are not claimed.
