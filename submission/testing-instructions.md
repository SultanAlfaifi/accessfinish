# Test AccessFinish

## Browser-only review

Open the published review URL supplied with the submission. Review the blockage and source edits, then choose **Inspect this proposal's recorded execution**. The recording label, proposal hash, booking receipt, and all five frozen outcomes are visible. This does not start inference, execution, or a fresh verification. The independent developer session page is `/review.html`; participant results are not yet collected.

## Fresh local execution

1. Obtain the v0.2 repository or its reviewed test build.
2. Install/use Node.js 22+ and a local Docker Linux engine. No Nebius key is needed for replaying the packaged proposal. Container images and locked dependencies require downloads during first setup.
3. Run `npm run demo:setup`, then `npm start`.
4. Open `http://127.0.0.1:4177`, review the patch and exact hash, check the approval box, and choose **Run approved repair**.
5. Inspect the result belonging to that new run ID. It must include the expected stored booking, fresh reopen, preservation checks, pointer control, unavailable-slot check, and runtime boundaries before it is verified.

The CLI equivalent is `npm run demo:check`; that explicit command approves the fixed packaged proposal. Run `node scripts/demo-check.cjs --original` for the original-source negative control: the task must remain blocked and booking verification must remain false.

For UI-only local review, use `npm run replay` and open `http://127.0.0.1:4178`. This needs Node.js but neither Docker nor a provider key.

## New inference and checks

See README for the server-side key, current price verification, input/output prices, and local request budget. The included complete source files are sent to Nebius only after the source-sharing checkbox and a new analysis request. The eight-request competition experiment is already complete; it must not be retried under the same trial IDs.

`npm test` checks approval binding, stale/mismatched evidence rejection, process ownership, exact source edits, server boundaries, and model-budget behavior with mocked requests. `npm run check:records` verifies the public frozen procedure, artifact hashes, counts, and selected recording without making a model call.

The GitHub Actions workflow is intended to verify clean setup separately from the browser-only sessions. Report it as pending until its actual run passes. Candidate artifacts and private fixture credentials are kept in the local runtime; do not upload the private runtime folder.
