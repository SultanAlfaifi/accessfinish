'use strict';
const fs = require('node:fs'), path = require('node:path');
const {digest} = require('../lib/runs.cjs');
const {sha} = require('../lib/repair.cjs');
const {caseDefinition} = require('../lib/cases.cjs');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'evidence/phone-model-20261023');
const runtime = path.join(process.env.LOCALAPPDATA || path.join(require('node:os').homedir(), '.local/state'), 'AccessFinish/phone-model-20261023');
const code = () => Object.fromEntries(['lib/model.cjs', 'lib/cases.cjs', 'lib/fixture.cjs', 'lib/runs.cjs', 'scripts/phone-model-trial.cjs'].map(name => [name, sha(fs.readFileSync(path.join(root, name)))]));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
async function main() {
  const selected = caseDefinition('customer-phone'); fs.mkdirSync(out, {recursive: true});
  const file = path.join(out, 'model-protocol.json');
  if (process.argv.includes('--prepare')) {
    require('./check-comparison.cjs').check();
    if (fs.existsSync(file)) throw Error('Preserve the existing model protocol.');
    save(file, {schema_version: 1, frozen_at_utc: new Date().toISOString(), case_id: selected.id,
      case_provenance: selected.provenance, task: selected.task, system: selected.modelSystem,
      source_sha256: digest(selected.files), procedure_sha256: code(),
      model: require('../lib/model.cjs').MODEL, max_new_requests: 2, combined_reservation_ceiling_usd: .50,
      automatic_retries: false, approval: 'User explicitly approved: Approve up to two requests — $0.50 maximum',
      scope: 'Guided exposed second-case generation; separate from the original five frozen trials and operator-control comparison.'});
  }
  const protocol = JSON.parse(fs.readFileSync(file));
  if (digest(protocol.procedure_sha256) !== digest(code()) || protocol.source_sha256 !== digest(selected.files)) throw Error('The approved model input or procedure changed.');
  const pricing = JSON.parse(fs.readFileSync(path.join(out, 'pricing.json')));
  if (Date.now() - Date.parse(pricing.verified_at_utc) > 86400000 || pricing.input_usd_per_million !== .3 || pricing.output_usd_per_million !== .9)
    throw Error('Fresh verified public pricing is required before key access.');
  if (!process.argv.includes('--run')) {
    console.log(JSON.stringify({preflight: true, source_sha256: protocol.source_sha256, runtime, max_requests: 2, total_cap_usd: .5})); return;
  }
  if (process.env.AF_PHONE_MODEL_APPROVED !== '20261023-two-requests-0.50') throw Error('The new explicit approval was not provided to this launcher.');
  fs.mkdirSync(runtime, {recursive: true});
  process.env.AF_MODEL_BUDGET_USD = '.50'; process.env.AF_MAX_MODEL_REQUESTS = '2';
  process.env.NEBIUS_PRICE_VERIFIED_AT = pricing.verified_at_utc;
  process.env.NEBIUS_INPUT_USD_PER_MILLION = '.30'; process.env.NEBIUS_OUTPUT_USD_PER_MILLION = '.90';
  // Exactly one request per explicit invocation. No retry, follow-up or execution.
  const result = await require('../lib/model.cjs').analyze({files: selected.files, case_id: selected.id}, {root: runtime});
  const name = 'attempt-' + result.attempt_id + '.json';
  save(path.join(out, name), {...result, source_sha256: protocol.source_sha256, state: 'generated_pending_operator_review'});
  const responseFile = path.join(runtime, 'model-responses', result.attempt_id + '.json');
  fs.copyFileSync(responseFile, path.join(out, 'raw-' + result.attempt_id + '.json'));
  fs.copyFileSync(path.join(runtime, 'model-spend.json'), path.join(out, 'model-spend.json'));
  console.log(JSON.stringify({attempt: name, edits: result.proposal.edits.length,
    estimated_cost_usd_excluding_tax: result.estimated_cost_usd_excluding_tax, executed: false}));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
