'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {caseDefinition, phoneReference} = require('../lib/cases.cjs');
const {preview} = require('../lib/repair.cjs');
const {digest} = require('../lib/runs.cjs');
test('phone challenge is a distinct declared seeded source with a repair that preserves arbitrary entered values', () => {
  const original = caseDefinition(), phone = caseDefinition('customer-phone');
  assert.notEqual(digest(original.files), digest(phone.files));
  assert.match(phone.provenance, /Deliberately seeded/);
  const js = phone.files.find(f => f.path.endsWith('.js')).content;
  assert.ok(js.includes("phone_number: '0000000000',"));
  const repaired = preview(phone.files, phoneReference()).files;
  assert.ok(repaired.find(f => f.path.endsWith('.js')).content.includes('phone_number: $phoneNumber.val(),'));
  assert.notEqual(phone.customer.phone_number, phone.pointerPhone);
  assert.ok(repaired.find(f => f.path.endsWith('.php')).content.includes('<input'));
  assert.throws(() => caseDefinition('../../other'), /Unknown repair case/);
});
test('a proposal from the date case cannot be silently applied to the prepared phone case', () => {
  assert.throws(() => preview(caseDefinition('customer-phone').files, require('../web/featured-case.json').proposal), /exactly once/);
  assert.throws(() => preview(caseDefinition().files, phoneReference()), /exactly once/);
});
