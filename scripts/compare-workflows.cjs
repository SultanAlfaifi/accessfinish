'use strict';
const fs = require('node:fs'), path = require('node:path');
const {candidate, runConventional} = require('./conventional-tests.cjs');
const {createRunStore, digest, runtimeRoot} = require('../lib/runs.cjs');
const {sha} = require('../lib/repair.cjs');
const {caseDefinition} = require('../lib/cases.cjs');
const fixture = require('../lib/fixture.cjs');
const ROOT = path.resolve(__dirname, '..');
const PROCEDURE = ['lib/cases.cjs', 'lib/fixture.cjs', 'lib/repair.cjs', 'lib/runs.cjs',
  'scripts/conventional-tests.cjs', 'scripts/compare-workflows.cjs', 'web/featured-case.json',
  'integration/portable/source-lock.json', 'integration/portable/outcome-evaluator.cjs',
  'integration/portable/select-evaluator.php', 'integration/portable/case-worker.cjs',
  'integration/portable/booking-keyboard-macros.cjs', 'integration/portable/regression-controls.cjs',
  'integration/portable/container-keyboard-booking-worker.cjs', 'integration/portable/container-booking-pilot-observer.cjs'];
const MATRIX = [
  ['customer-phone', 'original', false, 'wrong_customer_fields'],
  ['customer-phone', 'repaired', true, null],
  ['customer-phone', 'hardcoded', false, 'regression_controls'],
  ['keyboard-date', 'original', false, 'keyboard_task_incomplete'],
  ['keyboard-date', 'repaired', true, null],
  ['keyboard-date', 'regression', false, 'regression_controls'],
];
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
function fingerprint() { return Object.fromEntries(PROCEDURE.map(name => [name, sha(fs.readFileSync(path.join(ROOT, name)))])); }
async function runManaged({case_id, variant, root}) {
  const selected = candidate(case_id, variant);
  const store = createRunStore({root, execute: args => fixture.execute({...args, original: selected.original})});
  try {
    const proposal = store.register(selected);
    let unapprovedRejected = false;
    try { store.start({proposal_id: proposal.id, reviewed: false, approved_proposal_sha256: proposal.proposal_sha256}); }
    catch { unapprovedRejected = true; }
    if (!unapprovedRejected) throw Error('Unapproved execution was accepted.');
    let staleRejected = false;
    try { store.start({proposal_id: proposal.id, reviewed: true, approved_proposal_sha256: '0'.repeat(64)}); }
    catch { staleRejected = true; }
    if (!staleRejected) throw Error('Stale approval was accepted.');
    const started = store.start({proposal_id: proposal.id, reviewed: true, approved_proposal_sha256: proposal.proposal_sha256});
    let previous = '', loops = 0;
    for (;;) {
      const run = store.getRun(started.id);
      if (run.state !== previous) { console.log(JSON.stringify({mode: 'accessfinish', case_id, variant, state: run.state})); previous = run.state; }
      if (['verified', 'failed', 'interrupted'].includes(run.state)) return {...run, workflow: 'accessfinish', variant,
        approval_gate: true, unapproved_execution_rejected: unapprovedRejected, stale_approval_rejected: staleRejected};
      if (++loops > 900) throw Error('The observed managed run did not finish within fifteen minutes; inspect its retained resources.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally { store.close(); }
}
function classify(record) {
  const result = record.result;
  if (!result) return 'infrastructure_or_executor_failure';
  if (result.booking_verified) return 'verified';
  if (result.evaluation?.reasons.includes('wrong_customer_fields')) return 'wrong_customer_fields';
  if (result.evaluation?.reasons.includes('interaction_violation') && result.keyboard?.workflow?.status !== 'confirmation_observed') return 'keyboard_task_incomplete';
  if (result.keyboard_booking_verified && result.controls?.pass === false) return 'regression_controls';
  if (result.keyboard_booking_verified && result.error?.includes('Calendar navigation exceeded its bounded month budget.')) return 'regression_controls';
  return 'unexpected_failure';
}
async function main() {
  const index = process.argv.indexOf('--output');
  const out = path.resolve(index < 0 ? path.join(ROOT, 'evidence/extension-20261023') : process.argv[index + 1]);
  fs.mkdirSync(out, {recursive: true});
  const file = path.join(out, 'comparison-protocol.json');
  if (!fs.existsSync(file)) save(file, {schema_version: 1, frozen_at_utc: new Date().toISOString(), procedure_sha256: fingerprint(),
    matrix: MATRIX, case_sources: Object.fromEntries(['keyboard-date', 'customer-phone'].map(id => [id, {sha256: digest(caseDefinition(id).files), provenance: caseDefinition(id).provenance}])),
    comparison: 'Same source, patch variants, isolated compiler, native keyboard driver, independent storage reader, reopen and regression controls. Only workflow orchestration differs.',
    limits: ['Two exposed development cases in one application, including one deliberately seeded fault.',
      'Phone fixes in this matrix are operator reference and negative controls, not Nemotron generation success.',
      'No superiority over conventional end-to-end tests is claimed. No human time, accuracy uplift, or general usability is measured.',
      'Single executions are diagnostics, not a timing benchmark. Failed and unknown runs remain retained.'],
    new_model_calls: 0});
  const protocol = JSON.parse(fs.readFileSync(file));
  if (digest(protocol.procedure_sha256) !== digest(fingerprint())) throw Error('The frozen comparison procedure changed. Preserve this experiment and choose a new output directory.');
  if (process.argv.includes('--prepare')) { console.log(JSON.stringify({protocol: file, state: 'FROZEN_NOT_EXECUTED'})); return; }
  const root = runtimeRoot(); fixture.preparation(root);
  const resultFile = path.join(out, 'comparison.json');
  const report = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile)) : {
    state: 'running', protocol_sha256: sha(fs.readFileSync(file)), started_at_utc: new Date().toISOString(), records: [], new_model_calls: 0};
  if (report.protocol_sha256 !== sha(fs.readFileSync(file))) throw Error('Protocol bytes differ from the retained report.');
  for (let i = 0; i < MATRIX.length; i++) {
    const [case_id, variant, expected, failure] = MATRIX[i];
    // Alternating order avoids consistently assigning cold setup to one workflow.
    for (const workflow of i % 2 ? ['accessfinish', 'conventional'] : ['conventional', 'accessfinish']) {
      const key = `${case_id}/${variant}/${workflow}`;
      if (report.records.some(record => record.key === key)) continue;
      console.log(JSON.stringify({starting: key}));
      const began = Date.now();
      const record = workflow === 'conventional' ? await runConventional({case_id, variant, root}) : await runManaged({case_id, variant, root});
      const classification = classify(record), matched = expected ? record.state === 'verified' : record.state === 'failed' && classification === failure;
      report.records.push({key, case_id, variant, workflow, expected_verified: expected, actual_verified: record.state === 'verified',
        classification, expected_classification: failure || 'verified', expected_outcome_observed: matched,
        elapsed_ms: Date.now() - began, record});
      save(resultFile, report);
      if (!matched) throw Error('Unexpected outcome in ' + key + '; evidence retained. Diagnose before continuing.');
    }
  }
  report.state = 'completed'; report.finished_at_utc = new Date().toISOString();
  report.pairs = MATRIX.map(([case_id, variant]) => { const pair = report.records.filter(r => r.case_id === case_id && r.variant === variant);
    return {case_id, variant, equal_correctness_outcome: pair.length === 2 && pair[0].classification === pair[1].classification}; });
  report.all_expected_outcomes_observed = report.records.length === MATRIX.length * 2 && report.records.every(r => r.expected_outcome_observed);
  save(resultFile, report);
  console.log(JSON.stringify({state: report.state, records: report.records.length, all_expected_outcomes_observed: report.all_expected_outcomes_observed}));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {MATRIX, fingerprint, classify, runManaged};
