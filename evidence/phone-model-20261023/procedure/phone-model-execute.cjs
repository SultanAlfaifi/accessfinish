'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {caseDefinition} = require('../lib/cases.cjs');
const {digest, createRunStore} = require('../lib/runs.cjs');
const {sha} = require('../lib/repair.cjs');
const fixture = require('../lib/fixture.cjs');
const project = path.resolve(__dirname, '..'), out = path.join(project, 'evidence/phone-model-20261023');
const value = flag => process.argv[process.argv.indexOf(flag) + 1];
async function main() {
  const attemptName = value('--attempt'), workflow = value('--workflow');
  if (!/^attempt-[a-f0-9-]{36}\.json$/.test(attemptName || '') || !['conventional', 'accessfinish'].includes(workflow)) throw Error('Select one retained attempt and workflow.');
  const attempt = JSON.parse(fs.readFileSync(path.join(out, attemptName))), protocol = JSON.parse(fs.readFileSync(path.join(out, 'model-protocol.json')));
  const selected = caseDefinition('customer-phone');
  if (digest(selected.files) !== protocol.source_sha256 || attempt.source_sha256 !== protocol.source_sha256) throw Error('The reviewed model source changed.');
  for (const [name, expected] of Object.entries(protocol.procedure_sha256)) if (sha(fs.readFileSync(path.join(project, name))) !== expected) throw Error('The model procedure changed.');
  const hash = digest(attempt.proposal);
  if (value('--approve-sha') !== hash) throw Error('Review and approve the exact returned proposal before execution.');
  const resultFile = path.join(out, 'execution-' + workflow + '.json');
  if (fs.existsSync(resultFile)) throw Error('Preserve the prior model execution.');
  const root = path.join(process.env.LOCALAPPDATA, 'AccessFinish/phone-model-20261023');
  fs.mkdirSync(path.join(root, 'fixture'), {recursive: true});
  const prepared = path.join(root, 'fixture/prepared.json');
  if (!fs.existsSync(prepared)) fs.copyFileSync(path.join(process.env.LOCALAPPDATA, 'AccessFinish/v0.2/fixture/prepared.json'), prepared);
  const input = {files: selected.files, proposal: attempt.proposal, case_id: selected.id, origin: 'nebius',
    model: attempt.model, usage: attempt.usage, estimated_cost_usd_excluding_tax: attempt.estimated_cost_usd_excluding_tax};
  let record;
  if (workflow === 'conventional') {
    const run = {id: 'run-' + crypto.randomBytes(16).toString('hex'), case_id: selected.id,
      proposal_sha256: hash, source_sha256: digest(selected.files)};
    const result = await fixture.execute({run, proposal: input, root, update: state => console.log(JSON.stringify({workflow, state}))});
    record = {...run, workflow, state: result.booking_verified ? 'verified' : 'failed', result, approval_gate: false};
  } else {
    const store = createRunStore({root, execute: fixture.execute});
    try {
      const proposal = store.register(input), started = store.start({proposal_id: proposal.id, reviewed: true, approved_proposal_sha256: hash});
      let previous = '';
      for (let i = 0; i < 900; i++) {
        const run = store.getRun(started.id);
        if (run.state !== previous) { console.log(JSON.stringify({workflow, state: run.state})); previous = run.state; }
        if (['verified', 'failed', 'interrupted'].includes(run.state)) { record = {...run, workflow, approval_gate: true}; break; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!record) throw Error('The observed execution is still unresolved; inspect the retained run before continuing.');
    } finally { store.close(); }
  }
  record.model_attempt_id = attempt.attempt_id;
  record.review_context = 'Assistant operator inspected the single returned phone-serialization edit within the user-authorized isolated implementation and testing task; no entrant playback or independent human review is claimed.';
  record.new_model_calls_during_execution = 0;
  fs.writeFileSync(resultFile, JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({workflow, state: record.state, run_id: record.id, new_model_calls: 0}));
  if (record.state !== 'verified') process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
