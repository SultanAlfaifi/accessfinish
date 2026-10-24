'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {digest} = require('../lib/runs.cjs');
const root = path.resolve(__dirname, '..'), folder = path.join(root, 'evidence/phone-model-20261023');
const read = name => JSON.parse(fs.readFileSync(path.join(folder, name)));
function check() {
  const protocol = read('model-protocol.json'), ledger = read('model-spend.json');
  assert.ok(ledger.attempts.length > 0 && ledger.attempts.length <= 2); assert.ok(ledger.reserved_usd <= .5);
  assert.equal(protocol.automatic_retries, false); assert.equal(protocol.max_new_requests, 2);
  const managed = read('execution-accessfinish.json');
  const attempt = read('attempt-' + managed.model_attempt_id + '.json'), raw = read('raw-' + managed.model_attempt_id + '.json');
  assert.equal(raw.request.model, protocol.model); assert.equal(raw.response.model, protocol.model);
  assert.equal(raw.request.messages[0].content, protocol.system);
  const input = JSON.parse(raw.request.messages[1].content);
  assert.equal(input.task, protocol.task); assert.equal(digest(input.files), protocol.source_sha256);
  assert.equal(raw.response.choices[0].finish_reason, 'tool_calls');
  assert.equal(raw.response.choices[0].message.tool_calls.length, 1);
  assert.deepEqual(JSON.parse(raw.response.choices[0].message.tool_calls[0].function.arguments), attempt.proposal);
  const spend = ledger.attempts.find(row => row.id === attempt.attempt_id);
  assert.equal(spend.request_sha256, digest(raw.request)); assert.deepEqual(spend.usage, raw.response.usage);
  assert.equal(spend.status, 'proposal_validated');
  for (const record of [managed]) {
    assert.equal(record.state, 'verified'); assert.equal(record.case_id, 'customer-phone');
    assert.equal(record.model_attempt_id, attempt.attempt_id); assert.equal(record.source_sha256, protocol.source_sha256);
    assert.equal(record.proposal_sha256, digest(attempt.proposal)); assert.equal(record.result.proposal_sha256, record.proposal_sha256);
    assert.equal(record.result.run_id, record.id); assert.equal(record.result.booking_verified, true);
    assert.equal(record.result.controls.pass, true); assert.equal(record.result.boundaries_verified, true);
    assert.equal(record.result.scenario.customer.phone_number, '0000000042');
    assert.equal(record.result.controls.pointer_customer.phone_number, '0000000073');
    const customer = record.result.after.customers.find(row => String(row.id) === String(record.result.booking.id_users_customer));
    assert.equal(customer.phone_number, '0000000042');
    assert.equal(record.result.observer.after_next2.customer['phone-number'], '0000000042');
    assert.equal(record.new_model_calls_during_execution, 0);
  }
  assert.equal(managed.approval.proposal_sha256, managed.proposal_sha256); assert.equal(managed.approval.reviewed, true);
  return {protocol, ledger, attempt, managed};
}
if (require.main === module) {
  try { const result = check(); console.log(JSON.stringify({state: 'NEW_PHONE_MODEL_PASS', generations: result.ledger.attempts.length,
    verified_execution_replays: 1, estimated_cost_usd_excluding_tax: result.attempt.estimated_cost_usd_excluding_tax, distinct_exposed_cases: 1})); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {check};
