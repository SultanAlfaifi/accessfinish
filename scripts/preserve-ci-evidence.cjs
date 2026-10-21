'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {digest} = require('../lib/runs.cjs'), {sha} = require('../lib/repair.cjs');
const root = path.resolve(__dirname, '..'), input = path.join(root, 'artifacts/ci-39623819548'), output = path.join(root, 'evidence/clean-execution-20261021');
const read = name => JSON.parse(fs.readFileSync(path.join(input, name), 'utf8'));
const replays = read('recorded-proposal-replays.json');
assert.equal(replays.replayed_proposals, 5); assert.equal(replays.expected_outcomes_matched, 5); assert.equal(replays.verified_repair_outcomes, 2); assert.equal(replays.new_model_requests, 0);
const runNames = fs.readdirSync(input).filter(name => /^run-[a-f0-9]{32}\.json$/.test(name)), runs = runNames.map(read);
assert.equal(runs.length, 6);
const replayIds = new Set(replays.observations.map(row => row.replay_run_id)), controls = runs.filter(run => !replayIds.has(run.id));
assert.equal(controls.length, 1); const original = controls[0];
assert.equal(original.state, 'failed'); assert.equal(original.booking_verified, false);
assert.equal(original.result.keyboard.workflow.status, 'unresolved'); assert.equal(original.result.applied_source, undefined);
assert.equal(digest(original.result.before), digest(original.result.after));
const hashes = {}; fs.mkdirSync(output, {recursive: true});
for (const name of fs.readdirSync(input).filter(name => /^(?:run-|execution-run-|recorded-proposal-replays)/.test(name) && name.endsWith('.json'))) {
  const bytes = fs.readFileSync(path.join(input, name)); JSON.parse(bytes.toString('utf8'));
  fs.writeFileSync(path.join(output, name), bytes); hashes[name] = sha(bytes);
}
const result = {schema_version: 1, source_commit: 'fbd4a5d92d18cf961f102b5cbbbc3e7dd96e7c77',
  workflow_run_id: 39623819548, workflow_url: 'https://github.com/SultanAlfaifi/accessfinish/actions/runs/39623819548', workflow_conclusion: 'success',
  github_reported_artifact_digest: 'sha256:a65e7fed6d03fe90ac92bcc4ec114f15543d4524e8256b60cc8ad86bc75a9475',
  unit_matrix: {operating_systems: ['Windows', 'Linux'], node_versions: [22, 24], all_passed: true},
  original_source_control: {run_id: original.id, blocked_as_expected: true, database_unchanged: true},
  recorded_proposals_replayed: 5, expected_outcomes_matched: 5, verified_repair_outcomes: 2, new_model_requests: 0,
  scope: 'Independent automated clean public checkout and reproduction of recorded proposals. Not new model generation or an independent human usability session.', artifact_sha256: hashes};
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({state: 'INDEPENDENT_CLEAN_REPRODUCTION_PASS', matched: 5, verified: 2, original_control_blocked: true, new_model_requests: 0}));
