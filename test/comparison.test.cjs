'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {classify} = require('../scripts/compare-workflows.cjs');
test('comparison distinguishes expected task failures from infrastructure or unrecognized failures', () => {
  assert.equal(classify({}), 'infrastructure_or_executor_failure');
  assert.equal(classify({result: {booking_verified: false, error: 'Docker daemon stopped'}}), 'unexpected_failure');
  assert.equal(classify({result: {keyboard_booking_verified: true, error: 'Calendar navigation exceeded its bounded month budget.'}}), 'regression_controls');
  assert.equal(classify({result: {keyboard_booking_verified: false, error: 'Calendar navigation exceeded its bounded month budget.'}}), 'unexpected_failure');
  assert.equal(classify({result: {evaluation: {reasons: ['wrong_customer_fields']}}}), 'wrong_customer_fields');
});
