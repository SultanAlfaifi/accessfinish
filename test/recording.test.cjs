'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const {digest} = require('../lib/runs.cjs'), recording = require('../web/recording.js');
test('published recording rejects evidence from another proposal, source or execution', async () => {
  const files = [{path: 'example', content: 'original'}], proposal = {edits: [{old: 'original', new: 'changed'}]}, proposalHash = digest(proposal), sourceHash = digest(files);
  const featured = {proposal, proposal_sha256: proposalHash};
  const run = {id: 'run-test', state: 'verified', proposal_sha256: proposalHash, source_sha256: sourceHash, booking_verified: true,
    approval: {reviewed: true, proposal_sha256: proposalHash}, result: {run_id: 'run-test', proposal_sha256: proposalHash, source_sha256: sourceHash, booking_verified: true}};
  assert.equal(await recording.validate({featured, files, run}), true);
  await assert.rejects(recording.validate({featured: {...featured, proposal: {edits: []}}, files, run}), /exact proposal/);
  await assert.rejects(recording.validate({featured, files: [{...files[0], content: 'other'}], run}), /exact proposal/);
  await assert.rejects(recording.validate({featured, files, run: {...run, result: {...run.result, run_id: 'run-other'}}}), /different execution/);
  await assert.rejects(recording.validate({featured, files, run: {...run, result: {...run.result, booking_verified: false}}}), /did not pass/);
});
