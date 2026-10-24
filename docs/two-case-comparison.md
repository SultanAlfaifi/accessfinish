# Two cases, one acceptance workflow

AccessFinish helps a developer decide whether to accept an AI repair. Its practical distinction is the connected sequence: inspect the proposed code, approve that exact proposal, execute it in an isolated fixture, and retain the outcome with the source, proposal and run identities. A stale approval or an earlier green result cannot stand in for a new repair.

Good conventional tests can detect the same defects. This experiment compares a test-only CLI with an integrated workbench, using the same checks. It does not establish a detection advantage over a well-engineered conventional CI system.

## Cases and authorship

| Case | Source and fault | Candidate used in paired comparison |
| --- | --- | --- |
| Keyboard date | Original upstream Easy!Appointments source, pinned at `4bc7ecd51f3dade8e041558f2c23dda65bd6c43e`; date control is not keyboard focusable | Existing evaluation-4 Nemotron repair; existing evaluation-1 regression failure |
| Saved phone | The same app with the recorded working date repair applied, then a **deliberately seeded** serialization fault: the phone becomes `0000000000` | Operator reference restoring the entered string; hardcoded `0000000042` negative control |

The phone fault is an exposed development case. It was deliberately constructed to test stored business data and a different-input regression; it was not discovered autonomously in upstream software. All customer contacts are synthetic, with `.invalid` email addresses. Leading zeroes are intentional.

## Fairness and procedure

The protocol was frozen before the twelve completed runs in `evidence/extension-20261023-r2/comparison-protocol.json`. Both workflows use the exact same pinned fixture, trusted compiler, browser and native keyboard driver, SELECT-only database reader, fresh reopen, preservation checks and pointer/date regression controls. Each variant receives a fresh source/database fixture. The ordering alternates across pairs.

The baseline CLI records source, proposal and run hashes. Its deliberate scope is executing tests; it has no integrated review/approval UI. AccessFinish additionally checks that missing approval and approval for a different patch are rejected, then executes the approved patch. A conventional pipeline can implement these approval and evidence links too.

An earlier comparison was interrupted during the date regression worker and is retained at `evidence/extension-20261023/`. After repairing failed-manifest retention, the entire comparison was frozen again and rerun. Only the complete `-r2` report supports the table below. An infrastructure error is not automatically classified as an expected defect.

## Completed comparison

| Variant | Conventional CLI | AccessFinish |
| --- | --- | --- |
| Phone / original seeded fault | Wrong customer fields | Wrong customer fields |
| Phone / operator reference repair | Passed | Passed |
| Phone / hardcoded phone | Regression failed | Regression failed |
| Date / original | Keyboard task incomplete | Keyboard task incomplete |
| Date / recorded evaluation-4 repair | Passed | Passed |
| Date / recorded evaluation-1 proposal | Regression failed | Regression failed |

**Six paired variants, twelve isolated executions, identical correctness outcomes.** The phone original reaches a success page but saves the wrong phone. The hardcoded control saves the first phone correctly, then fails when a second customer supplies `0000000073`. Both test workflows catch these errors. AccessFinish attaches the approval decision to the exact repair and retains rejected outcomes alongside successes.

Full records: [completed experiment](../evidence/extension-20261023-r2/comparison.json), [browser summary and record links](../web/comparison.json). Verify with `npm run check:comparison`.

## Separate fresh Nemotron repair

After the reference comparison, one new request to `nvidia/nemotron-3-super-120b-a12b` through Nebius Token Factory proposed restoring `phone_number: $phoneNumber.val(),`. The operator supplied the diagnosis, repair direction and full case source. The returned semantic edit was not changed.

The exact response was reviewed before testing. Local operator approval here means assistant-operated testing within the user's authorized synthetic fixture; it is not an independent human review. The proposal passed a fresh AccessFinish execution and a fresh conventional execution, including saved/reopened `0000000042` and the different-phone control `0000000073`.

- Generation: **1**; automatic retries: **0**; execution replays: **2**.
- Provider usage: **12,658 input + 387 completion tokens**.
- Estimated cost: **$0.0041457 excluding tax** at the public prices checked on October 23, 2026.
- Attempt: `d6abe2f9-ac34-446c-ac18-e64f629a4fa0`.
- AccessFinish run: `run-cdc03648724c4e20997aa8f90a2fe56f`.
- Conventional run: `run-5c5a90282ec00b83ed7ce1220e4c97c8`.

The user approved at most two new requests with a combined $0.50 reservation ceiling. Only one was needed. Raw request/response, pricing, frozen protocol and execution evidence are in [phone-model-20261023](../evidence/phone-model-20261023/). Verify with `npm run check:phone-model`.

The original October 21 evaluation remains **2/5 full passes on one guided upstream case**. These counts are not pooled. Two execution replays of the phone proposal do not constitute two model generations.

## Independent automated reproduction

[GitHub CI at source commit 4df4923](https://github.com/SultanAlfaifi/accessfinish/actions/runs/40004155891) passed Node 22/24 checks on Windows/Linux. A fresh Linux runner rebuilt the pinned fixture, reproduced all five original expected outcomes and the original negative control, then verified the phone reference and retained new Nemotron repair while rejecting the hardcoded-phone control. [Sanitized records, hashes and a summary](../evidence/extension-ci-20261023/summary.json) are retained. This makes no new model requests and is separate from the twelve-run paired comparison; it does not count as a human review.

Two October 24 replays showed a different rejection stage for the same known-bad evaluation-1 proposal. Both complete positive repairs still passed. [The retained mismatches and reporting contract](replay-validation.md) keep exact-stage reproduction separate from the accept/reject decision; no paired-comparison row or frozen generation record is rewritten.

## Reproduce without new model usage

Use Node.js 22+ and a local Docker Linux engine. Run `npm run demo:setup` first. Use separate runtime directories for a running UI and CLI experiments.

```sh
npm test
npm run check:records
npm run check:comparison
npm run check:phone-model
npm run test:repair -- --case customer-phone --variant repaired
node scripts/ci-check-extension.cjs
```

The conventional CLI returns a nonzero exit code for a rejected candidate. To create an entirely new paired experiment without overwriting retained evidence, use a new output directory:

```sh
node scripts/compare-workflows.cjs --output evidence/my-new-comparison --prepare
node scripts/compare-workflows.cjs --output evidence/my-new-comparison
```

These commands replay fixed candidates and make no model requests. Creating a new model proposal is separately consented and budgeted.

## Limits and delivery state

The evidence covers **two exposed cases in one application**, including one seeded fault. It does not establish general repair accuracy, autonomous diagnosis, hidden-case performance, measured time saved, production readiness, or screen-reader usability. Independent browser feedback is still 0/2.

The new workbench and English Aiden v04 film are prepared for review. The existing public demo and private v03 upload remain older revisions until separately approved publication. Frame/decode/loudness checks do not count as full entrant playback or a human usability session.
