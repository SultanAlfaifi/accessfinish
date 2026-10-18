# Testing instructions

## Portable workbench

Download the test-build archive from the GitHub release or clone the public repository. Use Node.js 22 or later, run `npm start`, and open http://127.0.0.1:4177. No key, account, or dependency installation is needed to inspect the measured case.

1. Navigate using Tab and Enter, or choose **Find the blockage**. The original date control and observed problem are shown.
2. Choose **Review the repair** and inspect all three edits. The source author and guided-diagnosis qualification are visible.
3. Check **I reviewed these exact changes**, then export the patch. Export saves a JSON artifact without executing or applying it.
4. Choose **Verify the outcome**. Review appointment 902 and the storage, fresh-reopen, and existing-data controls. Download the evidence record.
5. Run `node scripts/check-evidence.cjs` to verify the included evidence chain, including model-generated proposal semantics, line-ending-only normalization, database row, fresh reopen, preserved rows, and cost.
6. Run `npm test` for exact replacement and local HTTP boundary tests.

The GitHub Pages URL provides the same interface as an evidence replay. It clearly marks recorded evidence. New paid proposals and a live local database check require the Node app and the corresponding server configuration; they are not simulated by the hosted page.

## New model proposal

An optional new request needs the reviewer's own Nebius key and a fresh price-verification timestamp configured on the server. Download `source-context.json` in the interface, provide that JSON in the model section, explicitly allow source transmission, and choose **Analyze with Nemotron**. A single request returns a source proposal for review. No patch is applied to a host checkout.

## Isolated booking run

The measured booking was executed in a separately provisioned Windows Docker fixture. Its native keyboard, compiler, source worker, and independent observer code are included for inspection. The archived harness requires that fixture; the public archive does not include private Docker runtime manifests, credentials, or an already running database. Reviewers can evaluate the portable workbench and the recorded outcome without access to the author's machine.

## Claims and access

The evidence shows one operator-diagnosed development case with Nemotron-authored edits and controller execution. It is not an unassisted discovery benchmark or a production accessibility certification. The public source, portable test build, video, and recorded evidence need no payment to view. The published case is dated; its recorded 19 October appointment is evidence, not a future bookable appointment.
