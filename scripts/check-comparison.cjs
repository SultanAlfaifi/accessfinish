'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {MATRIX, fingerprint, classify} = require('./compare-workflows.cjs');
const {candidate} = require('./conventional-tests.cjs');
const {digest} = require('../lib/runs.cjs');
const {sha} = require('../lib/repair.cjs');
const root = path.resolve(__dirname, '..');
function check(folder = path.join(root, 'evidence/extension-20261023-r2')) {
  const protocolBytes = fs.readFileSync(path.join(folder, 'comparison-protocol.json'));
  const protocol = JSON.parse(protocolBytes), report = JSON.parse(fs.readFileSync(path.join(folder, 'comparison.json')));
  assert.equal(report.state, 'completed', 'Comparison is not complete.');
  assert.equal(report.protocol_sha256, sha(protocolBytes));
  assert.deepEqual(protocol.matrix, MATRIX); assert.deepEqual(protocol.procedure_sha256, fingerprint());
  assert.equal(report.records.length, MATRIX.length * 2); assert.equal(report.new_model_calls, 0);
  const seen = new Set();
  for (const row of report.records) {
    assert.ok(!seen.has(row.key)); seen.add(row.key);
    const specification = MATRIX.find(([id, variant]) => id === row.case_id && variant === row.variant);
    assert.ok(specification); assert.ok(['conventional', 'accessfinish'].includes(row.workflow));
    const input = candidate(row.case_id, row.variant), record = row.record, result = record.result;
    assert.equal(record.source_sha256, digest(input.files)); assert.equal(record.proposal_sha256, digest(input.proposal));
    assert.equal(result.run_id, record.id); assert.equal(result.source_sha256, record.source_sha256);
    assert.equal(result.proposal_sha256, record.proposal_sha256); assert.equal(result.case_id, row.case_id);
    assert.equal(result.candidate_applied, !input.original);
    assert.equal(row.actual_verified, result.booking_verified); assert.equal(row.actual_verified, specification[2]);
    assert.equal(classify(record), specification[3] || 'verified'); assert.equal(row.classification, classify(record));
    if (row.workflow === 'accessfinish') {
      assert.equal(record.approval.reviewed, true); assert.equal(record.approval.proposal_sha256, record.proposal_sha256);
      assert.equal(record.unapproved_execution_rejected, true); assert.equal(record.stale_approval_rejected, true);
    } else assert.equal(record.approval_gate, false);
    if (row.actual_verified) {
      assert.equal(result.boundaries_verified, true); assert.equal(result.controls.pass, true);
      assert.equal(result.evaluation.pass, true); assert.equal(result.keyboard.native_keyboard_only, true);
    }
    if (row.case_id === 'customer-phone') {
      assert.match(result.case_provenance, /Deliberately seeded/);
      const main = result.after.customers.find(customer => String(customer.id) === String(result.booking.id_users_customer));
      assert.equal(result.scenario.customer.phone_number, '0000000042');
      if (row.variant === 'original') assert.equal(main.phone_number, '0000000000');
      else assert.equal(main.phone_number, '0000000042');
      if (row.variant !== 'original') {
        assert.equal(result.controls.pointer_customer.phone_number, '0000000073');
        if (row.variant === 'hardcoded') {
          assert.equal(result.keyboard_booking_verified, true);
          assert.equal(result.controls.evaluation.pass, false);
          assert.ok(result.controls.evaluation.reasons.includes('wrong_customer_fields'));
        }
      }
    }
  }
  for (const pair of report.pairs) {
    const rows = report.records.filter(row => row.case_id === pair.case_id && row.variant === pair.variant);
    assert.equal(rows.length, 2); assert.equal(rows[0].classification, rows[1].classification);
  }
  assert.equal(report.pairs.length, 6); assert.equal(report.all_expected_outcomes_observed, true);
  return report;
}
if (require.main === module) {
  try { const report = check(); console.log(JSON.stringify({state: 'TWO_CASE_COMPARISON_PASS', paired_variants: report.pairs.length,
    executions: report.records.length, equal_correctness_outcomes: true, new_model_calls: 0})); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {check};
