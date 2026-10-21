'use strict';
const fs = require('node:fs'), path = require('node:path');
const {createRunStore, runtimeRoot} = require('../lib/runs.cjs');
const fixture = require('../lib/fixture.cjs');
async function main() {
  const original = process.argv.includes('--original'), root = runtimeRoot();
  const store = createRunStore({root, execute: args => fixture.execute({...args, original})});
  try {
    const files = JSON.parse(fs.readFileSync(path.join(__dirname, '../web/source-context.json'), 'utf8'));
    const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, '../web/evidence.json'), 'utf8'));
    const reference = process.argv.includes('--operator-reference');
    const featuredFile = path.join(__dirname, '../web/featured-case.json');
    if (!reference && !original && !fs.existsSync(featuredFile)) throw Error('No featured evaluated proposal is packaged. Use --operator-reference for the explicitly mixed diagnostic control.');
    const sourceProposal = reference ? require('../integration/portable/operator-reference-proposal.json') : original ? evidence.proposal : JSON.parse(fs.readFileSync(featuredFile, 'utf8')).proposal;
    const proposal = store.register({files,
      proposal: sourceProposal, origin: reference ? 'operator_reference' : 'recorded', model: reference ? null : 'nvidia/nemotron-3-super-120b-a12b'});
    const started = store.start({proposal_id: proposal.id, reviewed: true, approved_proposal_sha256: proposal.proposal_sha256});
    console.log(JSON.stringify({run_id: started.id, proposal_origin: reference ? 'mixed_operator_reference_control' : 'recorded', original_source_control: original, new_model_calls: 0}));
    let previous = '';
    for (;;) {
      const run = store.getRun(started.id);
      if (run.state !== previous) { console.log(JSON.stringify({run_id: run.id, state: run.state, error: run.error || null})); previous = run.state; }
      if (['verified', 'failed', 'interrupted'].includes(run.state)) {
        const expected = original ? run.state === 'failed' && run.result?.keyboard?.workflow?.status === 'unresolved' : run.state === 'verified';
        console.log(JSON.stringify({expected_outcome_observed: expected, run_id: run.id, evidence: path.join(root, 'runs', run.id + '.json'), booking_verified: run.booking_verified, new_model_calls: 0}));
        if (original || reference) {
          fs.mkdirSync(path.join(root, 'controls'), {recursive: true});
          fs.writeFileSync(path.join(root, 'controls', (original ? 'original-source' : 'operator-reference') + '.json'), JSON.stringify({run_id: run.id,
            original_source_control: original, operator_reference_control: reference, new_model_calls: 0, expected_outcome_observed: expected,
            source_commit: run.result?.source_commit, source_sha256: run.source_sha256, fixture_fingerprint: run.result?.fixture_fingerprint}, null, 2) + '\n');
        }
        if (!expected) process.exitCode = 1;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally { store.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
