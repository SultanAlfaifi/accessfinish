'use strict';
const fs = require('node:fs'), path = require('node:path');
const {check} = require('./check-comparison.cjs');
const {caseDefinition, phoneReference} = require('../lib/cases.cjs');
const {digest} = require('../lib/runs.cjs');
const {sha} = require('../lib/repair.cjs');
const root = path.resolve(__dirname, '..'), report = check(), outputs = [];
const write = (relative, value) => {
  const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n');
  outputs.push({path: relative, sha256: sha(fs.readFileSync(target))});
};
const rows = report.records.map(row => {
  const evidence = `records/comparison-${row.case_id}-${row.variant}-${row.workflow}.json`;
  write('web/' + evidence, row.record);
  const {record, ...summary} = row; return {...summary, evidence};
});
write('web/comparison.json', {schema_version: 1, state: report.state, protocol_sha256: report.protocol_sha256,
  started_at_utc: report.started_at_utc, finished_at_utc: report.finished_at_utc,
  all_expected_outcomes_observed: report.all_expected_outcomes_observed, pairs: report.pairs, records: rows,
  limits: JSON.parse(fs.readFileSync(path.join(root, 'evidence/extension-20261023-r2/comparison-protocol.json'))).limits,
  new_model_calls: 0});
const phone = caseDefinition('customer-phone'), proposal = phoneReference();
const run = report.records.find(row => row.case_id === phone.id && row.variant === 'repaired' && row.workflow === 'accessfinish').record;
write('web/cases/customer-phone-reference.json', {case_id: phone.id, title: phone.title, provenance: phone.provenance, files: phone.files,
  featured: {authorship: 'operator_reference', proposal, proposal_sha256: digest(proposal), model: null},
  run, state: 'operator_reference_verified_in_paired_comparison'});
write('evidence/extension-20261023-r2/public-manifest.json', {outputs, new_model_calls: 0});
console.log(JSON.stringify({state: 'COMPARISON_EXPORTED', paired_variants: report.pairs.length, public_records: rows.length}));
