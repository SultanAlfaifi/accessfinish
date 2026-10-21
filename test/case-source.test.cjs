'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {originalFiles, contextForCase} = require('../lib/case-source.cjs');
const {preview} = require('../lib/repair.cjs');
test('source context contains complete pinned files without artificial replacement anchors', () => {
  const full = originalFiles(), context = contextForCase();
  assert.equal(context.length, 2); assert.ok(context[0].content.includes('onMonthChange')); assert.ok(context[0].content.includes('onYearChange'));
  assert.deepEqual(context, full); assert.ok(!context[0].content.includes('// Separate complete original fragment'));
  for (const proposal of [require('../web/evidence.json').proposal, require('../integration/portable/operator-reference-proposal.json')]) {
    const fragments = preview(context, proposal), complete = preview(full, proposal);
    assert.equal(fragments.changes.length, complete.changes.length);
    for (let i = 0; i < fragments.changes.length; i++) {
      assert.equal(fragments.changes[i].old, complete.changes[i].old); assert.equal(fragments.changes[i].new, complete.changes[i].new);
    }
  }
});
