'use strict';
// One explicit operation at a time. Generation never applies a proposal.
const fs = require('node:fs'), path = require('node:path');
const {createRunStore, runtimeRoot, digest} = require('../lib/runs.cjs');
const fixture = require('../lib/fixture.cjs'), model = require('../lib/model.cjs');
const {contextForCase} = require('../lib/case-source.cjs');
function protocolInputs() {
  const procedure = ['../lib/model.cjs', '../lib/fixture.cjs', '../lib/docker.cjs', '../lib/runs.cjs', '../lib/repair.cjs', '../lib/case-source.cjs', './trial.cjs'];
  return {model: model.MODEL, context_sha256: digest(contextForCase()), fixture_fingerprint: fixture.fixtureFingerprint(),
    procedure_hashes: Object.fromEntries(procedure.map(file => [file, digest(fs.readFileSync(require.resolve(file), 'utf8'))]))};
}
function requireFrozen(trials) {
  const frozen = JSON.parse(fs.readFileSync(path.join(trials, 'frozen-protocol.json'), 'utf8'));
  if (digest(frozen.inputs) !== digest(protocolInputs())) throw Error('The frozen evaluation protocol changed.');
  return frozen;
}
async function main() {
  const [operation, phase, value] = process.argv.slice(2), root = runtimeRoot();
  if (!['development', 'evaluation'].includes(phase)) throw Error('Choose development or evaluation.');
  const store = createRunStore({root, execute: fixture.execute}), trials = path.join(root, 'trials'); fs.mkdirSync(trials, {recursive: true});
  try {
    if (operation === '--analyze') {
      const index = Number(value), limit = phase === 'development' ? 3 : 5;
      if (!Number.isInteger(index) || index < 1 || index > limit) throw Error('Trial index is outside the approved protocol.');
      fixture.preparation(root);
      const file = path.join(trials, phase + '-' + index + '.json');
      const claim = {phase, index, at_utc: new Date().toISOString(), state: 'claimed_no_retry', context_sha256: digest(contextForCase())};
      if (phase === 'evaluation') {
        requireFrozen(trials);
      }
      fs.writeFileSync(file, JSON.stringify(claim, null, 2) + '\n', {flag: 'wx'});
      process.env.AF_TRIAL_PHASE = phase;
      try {
        const result = await model.analyze({files: contextForCase()}, {root});
        const proposal = store.register({files: contextForCase(), proposal: result.proposal, origin: 'nebius', model: result.model, usage: result.usage, estimated_cost_usd_excluding_tax: result.estimated_cost_usd_excluding_tax});
        Object.assign(claim, {state: 'proposal_awaiting_review', proposal_id: proposal.id, proposal_sha256: proposal.proposal_sha256, attempt_id: result.attempt_id, estimated_cost_usd_excluding_tax: result.estimated_cost_usd_excluding_tax});
        console.log(JSON.stringify({...claim, proposal_file: path.join(root, 'proposals', proposal.id + '.json')}));
      } catch (error) { claim.state = 'generation_failed'; claim.error = error.message; throw error; }
      finally { fs.writeFileSync(file, JSON.stringify(claim, null, 2) + '\n'); }
      return;
    }
    if (operation === '--execute') {
      const file = path.join(trials, phase + '-' + Number(value) + '.json'), claim = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (phase === 'evaluation') requireFrozen(trials);
      if (claim.state !== 'proposal_awaiting_review') throw Error('This trial has no unconsumed proposal awaiting review.');
      const proposal = store.getProposal(claim.proposal_id);
      if (proposal.proposal_sha256 !== claim.proposal_sha256) throw Error('The reviewed proposal changed.');
      claim.state = 'execution_claimed_no_retry'; fs.writeFileSync(file, JSON.stringify(claim, null, 2) + '\n');
      const started = store.start({proposal_id: proposal.id, approved_proposal_sha256: proposal.proposal_sha256, reviewed: true});
      claim.run_id = started.id; fs.writeFileSync(file, JSON.stringify(claim, null, 2) + '\n');
      let state;
      for (;;) {
        const run = store.getRun(started.id);
        if (run.state !== state) { console.log(JSON.stringify({run_id: run.id, state: run.state, error: run.error || null})); state = run.state; }
        if (['verified', 'failed', 'interrupted'].includes(run.state)) {
          claim.state = run.state; claim.booking_verified = run.booking_verified; claim.error = run.error || null;
          fs.writeFileSync(file, JSON.stringify(claim, null, 2) + '\n'); console.log(JSON.stringify(claim)); return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (operation === '--freeze') {
      if (phase !== 'evaluation') throw Error('Only evaluation has a frozen protocol.');
      const protocol = {inputs: protocolInputs(), trials: 5, at_utc: new Date().toISOString(), exposed_guided_case: true, hidden_benchmark: false,
        diagnosis_and_repair_direction: 'operator supplied', development_requests: 3, automatic_retries: 0,
        protocol_changes_after_development: ['Complete original files replace source excerpts containing artificial separator comments.', 'Output reservation increased to 8192 tokens within the existing per-request budget.', 'Pointer booking, clear-date, reserved-slot and runtime-boundary checks added.'],
        success_definition: 'Exact anchored repair, trusted build, native keyboard booking, SELECT-only database match, fresh browser reopen, preservation of existing records, pointer regression booking, reserved-slot exclusion, cleared-date error check, and inspected container boundaries all pass.'};
      fs.writeFileSync(path.join(trials, 'frozen-protocol.json'), JSON.stringify(protocol, null, 2) + '\n', {flag: 'wx'}); console.log(JSON.stringify(protocol)); return;
    }
    throw Error('Use --analyze PHASE INDEX, --execute PHASE INDEX, or --freeze evaluation.');
  } finally { store.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
