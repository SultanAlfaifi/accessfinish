'use strict';
// Whitelisted publication only. Never recursively copy a runtime directory.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {runtimeRoot, digest} = require('../lib/runs.cjs'), {sha} = require('../lib/repair.cjs');
const {contextForCase} = require('../lib/case-source.cjs');
const project = path.resolve(__dirname, '..'), runtime = runtimeRoot(), prefix = 'evidence/competition-20261021';
const read = relative => JSON.parse(fs.readFileSync(path.join(runtime, relative), 'utf8'));
const hashes = {};
function publish(relative, value) {
  const file = path.join(project, relative), bytes = JSON.stringify(value, null, 2) + '\n';
  fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, bytes); hashes[relative] = sha(bytes);
}
const ledger = read('model-spend.json'), protocol = read('trials/frozen-protocol.json'), rows = [];
assert.equal(ledger.attempts.length, 8, 'The approved 3 + 5 request set must be terminal before final export.');
assert.equal(ledger.attempts.filter(row => row.phase === 'evaluation').length, 5);
publish(prefix + '/frozen-protocol.json', protocol);
for (const phase of ['development', 'evaluation']) {
  const attempts = ledger.attempts.filter(row => row.phase === phase), count = phase === 'development' ? 3 : 5;
  for (let index = 1; index <= count; index++) {
    const claim = read('trials/' + phase + '-' + index + '.json'), attempt = attempts[index - 1];
    assert.ok(['verified', 'failed', 'generation_failed', 'interrupted'].includes(claim.state), 'An unfinished trial cannot enter the final report.');
    assert.ok(attempt.finished_at_utc && attempt.usage && Number.isFinite(attempt.estimated_cost_usd_excluding_tax));
    if (claim.attempt_id) assert.equal(claim.attempt_id, attempt.id);
    const inference = read('model-responses/' + attempt.id + '.json');
    assert.equal(digest(inference.request), attempt.request_sha256);
    const base = prefix + '/' + phase + '-' + index;
    publish(base + '/claim.json', claim); publish(base + '/inference.json', inference);
    let run = null, execution = null, proposal = null;
    if (claim.proposal_id) {
      proposal = read('proposals/' + claim.proposal_id + '.json');
      assert.equal(digest(proposal.proposal), claim.proposal_sha256);
      assert.equal(digest(JSON.parse(inference.response.choices[0].message.tool_calls[0].function.arguments)), claim.proposal_sha256);
      publish(base + '/proposal.json', proposal);
    }
    if (claim.run_id) {
      run = read('runs/' + claim.run_id + '.json'); execution = read('execution/' + claim.run_id + '/evidence.json');
      assert.equal(run.id, execution.run_id); assert.equal(run.proposal_sha256, execution.proposal_sha256);
      assert.equal(run.booking_verified, claim.booking_verified);
      publish(base + '/run.json', run); publish(base + '/execution.json', execution);
      if (phase === 'evaluation') publish('web/records/evaluation-' + index + '.json', {claim, run, execution});
    }
    rows.push({phase, index, state: claim.state, overall_pass: claim.booking_verified === true,
      generation_pass: attempt.status === 'proposal_validated', build_pass: execution?.build?.status === 'TRUSTED_BUILD_PASS',
      keyboard_booking_pass: execution?.keyboard_booking_verified === true, regression_controls_pass: execution?.controls?.pass === true,
      boundaries_pass: execution?.boundaries_verified === true, proposal_id: claim.proposal_id || null, proposal_sha256: claim.proposal_sha256 || null,
      run_id: claim.run_id || null, error: claim.error || execution?.error || null, attempt_id: attempt.id,
      estimated_cost_usd_excluding_tax: attempt.estimated_cost_usd_excluding_tax,
      generation_duration_ms: Date.parse(attempt.finished_at_utc) - Date.parse(attempt.at_utc), execution_duration_ms: run?.duration_ms || null,
      public_evidence_directory: base, ...(claim.booking_verified ? {_run: run, _proposal: proposal} : {})});
  }
}
const evaluated = rows.filter(row => row.phase === 'evaluation'), passed = evaluated.filter(row => row.overall_pass);
assert.ok(passed.length, 'No model proposal passed the full protocol. Do not package an operator reference as model success.');
// Prefer a passing proposal whose month guard precedes the opacity change.
const featuredRow = passed.find(row => row._proposal.proposal.edits.some(edit => edit.new.includes("$selectDate.is(':focus')") && edit.new.indexOf("$selectDate.is(':focus')") < edit.new.indexOf('.fadeTo('))) || passed[0];
publish('web/records/featured-run.json', featuredRow._run);
publish('web/featured-case.json', {schema_version: 1, authorship: 'model', model: featuredRow._proposal.model,
  generated_at_utc: featuredRow._proposal.created_at_utc, proposal: featuredRow._proposal.proposal, proposal_sha256: featuredRow.proposal_sha256,
  source_sha256: featuredRow._proposal.source_sha256, recording: 'records/featured-run.json', evaluation_index: featuredRow.index,
  selection: 'A passing demonstration example. Prefer a month guard before the opacity change. All five evaluation outcomes remain in the report.'});
const report = {schema_version: 1, generated_at_utc: new Date().toISOString(), scope: 'Repeated guided generation on one exposed source-repair case; not hidden cases or independent task families.',
  diagnosis_and_repair_direction: 'operator supplied', automatic_retries: 0, semantic_model_edits_changed_by_operator: false,
  development_requests: 3, evaluation_requests: 5, evaluation_passed: passed.length, evaluation_failed: 5 - passed.length,
  distinct_evaluation_cases: 1, featured_evaluation_index: featuredRow.index, request_limit: 8, additional_budget_usd: 5,
  estimated_additional_model_cost_usd_excluding_tax: ledger.attempts.reduce((sum, attempt) => sum + attempt.estimated_cost_usd_excluding_tax, 0),
  reserved_usd_with_100_percent_buffer: ledger.reserved_usd, unknown_usage_responses: ledger.attempts.filter(attempt => !attempt.usage).length,
  pricing_usd_per_million: {input: .3, output: .9},
  limitations: ['Human review time is excluded from generation and execution durations.', 'No baseline-assistant, hidden-case, screen-reader, user-time-saved, or general autonomous-repair claim.', 'The observed task crosses a month boundary; year-boundary behavior is not independently measured.', 'Browser-only usability sessions and clean-environment execution are separate evidence and are not included in these five trials.'],
  trials: rows.map(({_run, _proposal, ...row}) => row), artifact_sha256: hashes};
publish('web/trial-report.json', report);
console.log(JSON.stringify({evaluation_passed: report.evaluation_passed, evaluation_requests: 5, featured_evaluation_index: featuredRow.index,
  estimated_additional_model_cost_usd_excluding_tax: report.estimated_additional_model_cost_usd_excluding_tax, private_files_exported: false}));
