'use strict';
// Run the AccessFinish agent on one case from the command line.
//   node scripts/agent.cjs --case keyboard-date [--publish]
// --publish copies the finished trace (and its patch) into web/agent-runs/ so
// the browser replay shows it, and keeps a copy under evidence/agent-runs/.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const {runAgent} = require('../lib/agent.cjs');
const {caseDefinition} = require('../lib/cases.cjs');
const {preview} = require('../lib/repair.cjs');
const fixture = require('../lib/fixture.cjs');

const argument = flag => process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;
const project = path.resolve(__dirname, '..');

// A reviewable unified diff of the accepted proposal against the original files.
function unifiedPatch(files, proposal) {
  const after = preview(files, proposal).files, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-patch-'));
  let patch = '';
  for (const file of files) {
    const changed = after.find(item => item.path === file.path);
    if (changed.content === file.content) continue;
    for (const [side, content] of [['a', file.content], ['b', changed.content]]) {
      fs.mkdirSync(path.dirname(path.join(dir, side, file.path)), {recursive: true}); fs.writeFileSync(path.join(dir, side, file.path), content);
    }
    const result = cp.spawnSync('git', ['diff', '--no-index', '--no-color', path.join('a', file.path), path.join('b', file.path)], {cwd: dir, encoding: 'utf8'});
    patch += result.stdout.replaceAll('a/a/', 'a/').replaceAll('b/b/', 'b/');
  }
  fs.rmSync(dir, {recursive: true, force: true});
  return patch;
}

async function main() {
  const caseId = argument('--case') || 'keyboard-date', selected = caseDefinition(caseId);
  const print = text => process.stdout.write(text + '\n');
  print('AccessFinish agent · ' + selected.title + '\nGoal: ' + selected.goal + '\n');
  let shown = 0;
  const trace = await runAgent({case_id: caseId, execute: fixture.execute, onUpdate: current => {
    for (const step of current.steps.slice(shown)) {
      if (step.kind === 'observe') print('Observe   ' + (step.verified ? '✓ ' : '✗ ') + step.headline);
      if (step.kind === 'propose') print('Attempt ' + step.attempt + ' Nemotron: ' + step.diagnosis + ' (' + step.edits.length + ' edits)');
      if (step.kind === 'verify') print('          ' + (step.verified ? '✓ ' : '✗ ') + step.headline);
    }
    shown = current.steps.length;
  }});
  print('\nResult: ' + trace.state + ' · ' + (trace.duration_ms / 1000).toFixed(0) + ' s · ' + trace.usage.prompt_tokens + ' input + ' +
    trace.usage.completion_tokens + ' output tokens · $' + trace.estimated_cost_usd.toFixed(4) + (trace.error ? '\nError: ' + trace.error : ''));
  if (trace.accepted) trace.accepted.patch = unifiedPatch(selected.files, trace.accepted.proposal);
  if (process.argv.includes('--publish')) {
    for (const dir of ['web/agent-runs', 'evidence/agent-runs']) fs.mkdirSync(path.join(project, dir), {recursive: true});
    fs.writeFileSync(path.join(project, 'evidence/agent-runs', trace.id + '.json'), JSON.stringify(trace, null, 2) + '\n');
    fs.writeFileSync(path.join(project, 'web/agent-runs', caseId + '.json'), JSON.stringify(trace, null, 2) + '\n');
    print('Published web/agent-runs/' + caseId + '.json');
  }
  if (trace.state !== 'verified') process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {unifiedPatch};
