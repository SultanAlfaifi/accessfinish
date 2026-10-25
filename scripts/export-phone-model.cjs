'use strict';
const fs = require('node:fs');
const {check} = require('./check-phone-model.cjs');
const {caseDefinition} = require('../lib/cases.cjs');
const {digest} = require('../lib/runs.cjs');
const {protocol, ledger, attempt, managed} = check();
const selected = caseDefinition('customer-phone');
fs.writeFileSync('web/cases/customer-phone.json', JSON.stringify({case_id: selected.id, title: selected.title,
  provenance: selected.provenance, files: selected.files, state: 'new_nemotron_proposal_verified',
  featured: {authorship: 'model', model: attempt.model, provider: 'Nebius Token Factory',
    attempt_id: attempt.attempt_id, generated_at_utc: ledger.attempts.find(row => row.id === attempt.attempt_id).at_utc,
    usage: attempt.usage, estimated_cost_usd_excluding_tax: attempt.estimated_cost_usd_excluding_tax,
    proposal: attempt.proposal, proposal_sha256: digest(attempt.proposal)}, run: managed}, null, 2) + '\n');
fs.writeFileSync('web/records/phone-model-accessfinish.json', JSON.stringify(managed, null, 2) + '\n');
fs.writeFileSync('web/phone-model-report.json', JSON.stringify({state: 'verified', generations: ledger.attempts.length,
  model: attempt.model, provider: 'Nebius Token Factory', case_id: protocol.case_id, case_provenance: protocol.case_provenance,
  attempt_id: attempt.attempt_id, proposal_sha256: digest(attempt.proposal), source_sha256: protocol.source_sha256,
  model_generation_cost_usd_excluding_tax: attempt.estimated_cost_usd_excluding_tax, execution_replays: 1,
  records: {accessfinish: 'records/phone-model-accessfinish.json'},
  limits: 'One guided generation on a deliberately seeded exposed fault; Separate from operator controls and the original five-trial evaluation.'}, null, 2) + '\n');
console.log(JSON.stringify({state: 'NEW_PHONE_MODEL_EXPORTED', generations: ledger.attempts.length, execution_replays: 1}));
