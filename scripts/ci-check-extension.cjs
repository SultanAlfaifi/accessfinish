'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {runCase} = require('./run-case.cjs');
const {caseDefinition} = require('../lib/cases.cjs');
const {createRunStore, runtimeRoot} = require('../lib/runs.cjs');
const fixture = require('../lib/fixture.cjs');
async function main() {
  const out = path.join(__dirname, '../artifacts/extension-ci'); fs.mkdirSync(out, {recursive: true});
  for (const variant of ['repaired', 'hardcoded']) {
    const run = await runCase({case_id: 'customer-phone', variant});
    fs.writeFileSync(path.join(out, variant + '.json'), JSON.stringify(run, null, 2) + '\n');
    if (variant === 'repaired') assert.equal(run.state, 'verified');
    else {
      assert.equal(run.state, 'failed'); assert.equal(run.result.keyboard_booking_verified, true);
      assert.ok(run.result.controls.evaluation.reasons.includes('wrong_customer_fields'));
    }
  }
  const retained = require('../web/cases/customer-phone.json'), selected = caseDefinition('customer-phone');
  const store = createRunStore({root: runtimeRoot(), execute: fixture.execute});
  try {
    const proposal = store.register({case_id: selected.id, files: selected.files, proposal: retained.featured.proposal,
      origin: 'recorded', model: retained.featured.model});
    assert.equal(proposal.proposal_sha256, retained.featured.proposal_sha256);
    const started = store.start({proposal_id: proposal.id, reviewed: true, approved_proposal_sha256: proposal.proposal_sha256});
    let complete = false;
    for (let i = 0; i < 900; i++) {
      const run = store.getRun(started.id);
      if (['verified', 'failed', 'interrupted'].includes(run.state)) {
        fs.writeFileSync(path.join(out, 'retained-nemotron-phone.json'), JSON.stringify(run, null, 2) + '\n');
        assert.equal(run.state, 'verified'); assert.equal(run.result.controls.pass, true);
        assert.equal(run.result.controls.pointer_customer.phone_number, '0000000073'); complete = true; break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.equal(complete, true, 'Retained model replay exceeded the observation bound.');
  } finally { store.close(); }
  console.log(JSON.stringify({state: 'FRESH_PHONE_REFERENCE_NEGATIVE_CONTROL_AND_MODEL_REPLAY_PASS', new_model_calls: 0}));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
