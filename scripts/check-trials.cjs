'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {digest} = require('../lib/runs.cjs'), {sha} = require('../lib/repair.cjs');
const {contextForCase} = require('../lib/case-source.cjs');
const project = path.resolve(__dirname, '..'), read = relative => JSON.parse(fs.readFileSync(path.join(project, relative), 'utf8'));
const report = read('web/trial-report.json'), protocol = read('evidence/competition-20261021/frozen-protocol.json');
assert.equal(report.evaluation_requests, 5); assert.equal(report.development_requests, 3); assert.equal(report.trials.length, 8);
const evaluated = report.trials.filter(row => row.phase === 'evaluation');
assert.equal(evaluated.filter(row => row.overall_pass).length, report.evaluation_passed);
assert.equal(report.evaluation_failed, 5 - report.evaluation_passed);
assert.equal(report.unknown_usage_responses, 0); assert.ok(report.reserved_usd_with_100_percent_buffer <= 5);
assert.ok(Math.abs(report.trials.reduce((sum, row) => sum + row.estimated_cost_usd_excluding_tax, 0) - report.estimated_additional_model_cost_usd_excluding_tax) < 1e-10);
for (const [relative, expected] of Object.entries(report.artifact_sha256)) {
  assert.ok(!relative.includes('..') && /^(?:evidence\/competition-20261021\/|web\/)/.test(relative));
  assert.equal(sha(fs.readFileSync(path.join(project, relative))), expected, 'Artifact changed: ' + relative);
}
assert.equal(protocol.inputs.context_sha256, digest(contextForCase()));
for (const file of ['../lib/model.cjs', '../lib/fixture.cjs', '../lib/docker.cjs', '../lib/runs.cjs', '../lib/repair.cjs', '../lib/case-source.cjs', './trial.cjs']) {
  const relative = file.startsWith('../') ? file.slice(3) : 'scripts/' + file.slice(2);
  const archived = fs.readFileSync(path.join(project, 'evidence/competition-20261021/procedure', relative), 'utf8');
  assert.equal(protocol.inputs.procedure_hashes[file], digest(archived), 'Archived frozen procedure changed: ' + file);
}
const featured = read('web/featured-case.json'), run = read('web/' + featured.recording);
assert.equal(featured.evaluation_index, report.featured_evaluation_index);
assert.equal(run.id, evaluated.find(row => row.index === featured.evaluation_index).run_id);
require('../web/recording.js').validate({featured, files: contextForCase(), run}).then(() => {
  console.log(JSON.stringify({state: 'FROZEN_TRIAL_EVIDENCE_PASS', evaluation_passed: report.evaluation_passed, evaluation_attempts: 5, distinct_cases: 1, retained_development_attempts: 3, model_calls: 0}));
}).catch(error => { console.error(error); process.exitCode = 1; });
