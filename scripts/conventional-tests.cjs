'use strict';
// Test-only baseline. The exact same isolated fixture, browser drivers, storage
// reader and regression evaluator are used by both comparison workflows.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const fixture = require('../lib/fixture.cjs');
const {caseDefinition, phoneReference} = require('../lib/cases.cjs');
const {digest, runtimeRoot} = require('../lib/runs.cjs');
function candidate(case_id, variant) {
  const selected = caseDefinition(case_id);
  let proposal, origin, original = variant === 'original';
  if (case_id === 'keyboard-date') {
    proposal = variant === 'regression' ? require('../evidence/competition-20261021/evaluation-1/proposal.json').proposal : require('../web/featured-case.json').proposal;
    origin = 'recorded';
    if (!['original', 'repaired', 'regression'].includes(variant)) throw Error('Unknown date-case variant.');
  } else {
    proposal = phoneReference(); origin = 'operator_reference';
    if (variant === 'hardcoded') proposal = {reason: 'Negative control: a hardcoded phone may match one example but must fail the different-phone regression control.',
      edits: proposal.edits.map(edit => ({...edit, new: "phone_number: '0000000042',"}))};
    else if (!['original', 'repaired'].includes(variant)) throw Error('Unknown phone-case variant.');
  }
  return {files: selected.files, proposal, origin, original, case_id};
}
async function runConventional({case_id, variant, root = runtimeRoot(), progress = console.log}) {
  const item = candidate(case_id, variant), id = 'run-' + crypto.randomBytes(16).toString('hex');
  const run = {id, case_id, source_sha256: digest(item.files), proposal_sha256: digest(item.proposal)};
  const result = await fixture.execute({run, proposal: item, original: item.original, root,
    update: state => progress(JSON.stringify({mode: 'conventional', case_id, variant, state}))});
  const record = {workflow: 'conventional', case_id, variant, id, source_sha256: run.source_sha256,
    proposal_sha256: run.proposal_sha256, state: result.booking_verified ? 'verified' : 'failed', result,
    approval_gate: false, note: 'A deliberately explicit test-only CLI; conventional CI can implement approval and artifact binding with additional integration.'};
  const dir = path.join(root, 'conventional'); fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}
if (require.main === module) {
  const value = flag => process.argv[process.argv.indexOf(flag) + 1];
  runConventional({case_id: value('--case'), variant: value('--variant')}).then(record => {
    console.log(JSON.stringify({state: record.state, run_id: record.id}));
    if (record.state !== 'verified') process.exitCode = 1;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = {candidate, runConventional};
