'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createRunStore} = require('../lib/runs.cjs');
const {scenario} = require('../lib/fixture.cjs');
const files = require('../web/source-context.json'), proposal = require('../web/evidence.json').proposal;
async function finished(store, id) {
  for (let count = 0; count < 100; count++) { const run = store.getRun(id); if (['verified', 'failed'].includes(run.state)) return run; await new Promise(resolve => setTimeout(resolve, 5)); }
  throw Error('The test executor did not finish.');
}
function fixture(t, execute) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'accessfinish-runs-'));
  const store = createRunStore({root, execute});
  t.after(() => { store.close(); fs.rmSync(root, {recursive: true, force: true}); });
  return {root, store, item: store.register({files, proposal, origin: 'recorded'})};
}
test('requires approval of the exact proposal and rejects forged or absent approval', t => {
  const {store, item} = fixture(t, async () => {});
  for (const input of [{}, {reviewed: true}, {reviewed: true, approved_proposal_sha256: 'a'.repeat(64)}, {reviewed: false, approved_proposal_sha256: item.proposal_sha256}])
    assert.throws(() => store.start({proposal_id: item.id, ...input}), /exact changes/);
  assert.equal(store.busy(), false);
});
test('a second server cannot interrupt an active runtime owner', t => {
  const {root} = fixture(t, async () => {});
  assert.throws(() => createRunStore({root}), /Another AccessFinish process/);
});
test('rejects stale source and proposal bytes before execution', t => {
  const {root, store, item} = fixture(t, async () => {});
  const file = path.join(root, 'proposals', item.id + '.json'), edited = JSON.parse(fs.readFileSync(file)); edited.proposal.reason = 'changed';
  fs.writeFileSync(file, JSON.stringify(edited));
  assert.throws(() => store.start({proposal_id: item.id, reviewed: true, approved_proposal_sha256: item.proposal_sha256}), /changed/);
});
test('rejects concurrent repair runs and retains correctly bound results', async t => {
  let resolve; const gate = new Promise(r => { resolve = r; });
  const {store, item} = fixture(t, async ({run}) => { await gate; return {run_id: run.id, proposal_sha256: run.proposal_sha256, source_sha256: run.source_sha256, booking_verified: true}; });
  const input = {proposal_id: item.id, reviewed: true, approved_proposal_sha256: item.proposal_sha256}, run = store.start(input);
  assert.equal(run.booking_verified, false); assert.throws(() => store.start(input), /Another repair/);
  resolve(); const result = await finished(store, run.id);
  assert.equal(result.state, 'verified'); assert.equal(result.result.run_id, run.id); assert.equal(result.proposal_origin, 'recorded');
});
test('evidence from another run cannot produce verified status', async t => {
  const {store, item} = fixture(t, async ({run}) => ({run_id: 'run-' + 'f'.repeat(32), proposal_sha256: run.proposal_sha256, source_sha256: run.source_sha256, booking_verified: true}));
  const run = store.start({proposal_id: item.id, reviewed: true, approved_proposal_sha256: item.proposal_sha256});
  const result = await finished(store, run.id); assert.equal(result.state, 'failed'); assert.equal(result.booking_verified, false); assert.match(result.error, /different repair/);
});
test('executor failures are retained and never inherit the recorded booking success', async t => {
  const {store, item} = fixture(t, async () => { throw Error('Database unavailable'); });
  const run = store.start({proposal_id: item.id, reviewed: true, approved_proposal_sha256: item.proposal_sha256});
  const result = await finished(store, run.id); assert.equal(result.state, 'failed'); assert.equal(result.booking_verified, false); assert.equal(result.error, 'Database unavailable');
});
test('scenario uses a future Monday at least seven days ahead in Riyadh', () => {
  for (const day of ['2026-10-21', '2026-10-26', '2026-12-15']) {
    const s = scenario(new Date(day + 'T12:00:00Z')), delta = (Date.parse(s.date) - Date.parse(day)) / 86400000;
    assert.ok(delta >= 7 && delta <= 13); assert.equal(new Date(s.date).getUTCDay(), 1); assert.equal(s.timezone, 'Asia/Riyadh');
  }
});

test('a result for the date case cannot verify an approved phone-case proposal', async t => {
  const {store} = fixture(t, async ({run}) => ({run_id: run.id, proposal_sha256: run.proposal_sha256,
    source_sha256: run.source_sha256, case_id: 'keyboard-date', booking_verified: true}));
  const phone = require('../lib/cases.cjs').caseDefinition('customer-phone');
  const item = store.register({files: phone.files, proposal: require('../lib/cases.cjs').phoneReference(), origin: 'operator_reference', case_id: phone.id});
  const run = store.start({proposal_id: item.id, reviewed: true, approved_proposal_sha256: item.proposal_sha256});
  const result = await finished(store, run.id);
  assert.equal(result.state, 'failed'); assert.match(result.error, /different repair/);
});
