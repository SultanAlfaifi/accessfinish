'use strict';
// Replays retained proposals only. Does not load the model client or make inference requests.
const fs = require('node:fs'), path = require('node:path');
const {createRunStore, runtimeRoot} = require('../lib/runs.cjs'), fixture = require('../lib/fixture.cjs');
const {contextForCase} = require('../lib/case-source.cjs');
const project = path.resolve(__dirname, '..'), read = relative => JSON.parse(fs.readFileSync(path.join(project, relative), 'utf8'));
async function main() {
  const root = runtimeRoot(), store = createRunStore({root, execute: fixture.execute}), report = read('web/trial-report.json'), observations = [];
  try {
    for (const row of report.trials.filter(row => row.phase === 'evaluation')) {
      const recorded = read(row.public_evidence_directory + '/proposal.json');
      const proposal = store.register({files: contextForCase(), proposal: recorded.proposal, origin: 'recorded', model: recorded.model});
      if (proposal.proposal_sha256 !== row.proposal_sha256) throw Error('Recorded proposal identity mismatch.');
      const started = store.start({proposal_id: proposal.id, reviewed: true, approved_proposal_sha256: proposal.proposal_sha256});
      console.log(JSON.stringify({replay_evaluation_index: row.index, run_id: started.id, new_model_calls: 0}));
      let run;
      for (;;) {
        run = store.getRun(started.id);
        if (['verified', 'failed', 'interrupted'].includes(run.state)) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const execution = JSON.parse(fs.readFileSync(path.join(root, 'execution', run.id, 'evidence.json'), 'utf8'));
      const observed = {build_pass: execution.build?.status === 'TRUSTED_BUILD_PASS', keyboard_booking_pass: execution.keyboard_booking_verified === true,
        regression_controls_pass: execution.controls?.pass === true, overall_pass: run.booking_verified === true};
      const expectedStage = row.overall_pass || row.keyboard_booking_pass ? 'verifying' : row.build_pass ? 'booking' : 'building';
      const matched = Object.entries(observed).every(([key, value]) => value === row[key]) && run.stages.at(-1)?.state === expectedStage;
      observations.push({evaluation_index: row.index, recorded_proposal_sha256: row.proposal_sha256, replay_run_id: run.id, expected: {
        build_pass: row.build_pass, keyboard_booking_pass: row.keyboard_booking_pass, regression_controls_pass: row.regression_controls_pass, overall_pass: row.overall_pass},
        observed, expected_last_stage: expectedStage, observed_last_stage: run.stages.at(-1)?.state, expected_outcome_observed: matched, error: run.error || null});
      console.log(JSON.stringify(observations.at(-1)));
    }
    const result = {schema_version: 1, kind: 'recorded_proposal_reproduction', new_model_requests: 0, generated_at_utc: new Date().toISOString(),
      replayed_proposals: 5, expected_outcomes_matched: observations.filter(row => row.expected_outcome_observed).length,
      verified_repair_outcomes: observations.filter(row => row.observed.overall_pass).length, observations};
    fs.writeFileSync(path.join(root, 'recorded-proposal-replays.json'), JSON.stringify(result, null, 2) + '\n');
    if (result.expected_outcomes_matched !== 5 || result.verified_repair_outcomes !== report.evaluation_passed) process.exitCode = 1;
  } finally { store.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
