'use strict';
// Run the AccessFinish agent on one case from the command line.
//   node scripts/agent.cjs --case keyboard-date [--publish]
// --publish copies the finished trace (and its patch) into web/agent-runs/ so
// the browser replay shows it, and keeps a copy under evidence/agent-runs/.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const {runAgent, gitState, AGENT_VERSION} = require('../lib/agent.cjs');
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
  print('AccessFinish agent v' + AGENT_VERSION + ' · ' + selected.title + '\nGoal: ' + selected.goal + '\n');
  let shown = 0;
  // --recorded-model checks the pipeline without a key: the "model" answers with the
  // case's recorded Nemotron proposal. Such traces are never published.
  const recorded = process.argv.includes('--recorded-model');
  if (recorded && process.argv.includes('--publish')) throw Error('--recorded-model runs are pipeline checks and cannot be published.');
  if (process.argv.includes('--publish') && gitState().git_dirty) throw Error('--publish needs committed code: lib/, integration/ or scripts/ has uncommitted changes, so the trace\'s commit would not hold the code that ran.');
  // One booking date for every attempt of the run: by default the first Monday in a later month,
  // so the date picker has to change month as it did in every version 1 run. AF_SCENARIO_DATE overrides it.
  process.env.AF_SCENARIO_DATE ||= fixture.nextMonthScenarioDate();
  fixture.scenario(new Date(), process.env.AF_SCENARIO_DATE); // A date the fixture would refuse stops the run before any model call.
  const model = recorded ? async () => {
    const featured = caseId === 'customer-phone' ? require('../web/cases/customer-phone.json').featured : require('../web/featured-case.json');
    return {message: {content: null}, call: {id: 'recorded', function: {name: 'propose_repair', arguments: '{}'}},
      proposal: {diagnosis: 'Recorded proposal (pipeline check, no model call)', edits: featured.proposal.edits}, usage: {}, cost: 0};
  } : undefined;
  const trace = await runAgent({case_id: caseId, execute: fixture.execute, ...(model ? {model, maxAttempts: 1} : {}), onUpdate: current => {
    for (const step of current.steps.slice(shown)) {
      if (step.kind === 'observe') print('Observe   ' + (step.verified ? '✓ ' : '✗ ') + step.headline);
      if (step.kind === 'read') print('Attempt ' + step.attempt + ' reads ' + step.path + (step.already_provided ? ' (already provided)' : step.found ? '' : ' (not available)'));
      if (step.kind === 'search') print('Attempt ' + step.attempt + ' searches /' + step.query + '/' + (step.path ? ' in ' + step.path : '')
        + (step.limited ? ' (lookup limit reached, not run)' : step.error ? ' (not run: ' + step.error.replaceAll('_', ' ') + ')' : ' → ' + step.matches + ' matches'));
      if (step.kind === 'propose') print('Attempt ' + step.attempt + ' Nemotron: ' + step.diagnosis + ' (' + step.edits.length + ' edits'
        + (step.build_on_attempt ? ', ' + (step.kept_edits ?? 0) + ' kept from attempt ' + step.build_on_attempt : '') + ')');
      for (const item of step.kind === 'propose' ? step.adjustments || [] : []) print('          harness: ' + (item.your_edit ? 'edit ' + item.your_edit : 'kept edit') + ' ' + (item.dropped ? 'dropped, ' + item.dropped : item.anchored));
      if (step.kind === 'verify') print('          ' + (step.verified ? '✓ ' : '✗ ') + step.headline);
    }
    shown = current.steps.length;
  }});
  print('\nResult: ' + trace.state + ' · ' + (trace.duration_ms / 1000).toFixed(0) + ' s · ' + trace.usage.prompt_tokens + ' input + ' +
    trace.usage.completion_tokens + ' output tokens · $' + trace.estimated_cost_usd.toFixed(4) + (trace.error ? '\nError: ' + trace.error : '')
    + '\nConditions: commit ' + (trace.git_commit || 'unknown').slice(0, 12) + (trace.git_dirty ? ' with uncommitted changes' : '') + ' · fixture ' + (trace.fixture_fingerprint || 'unknown').slice(0, 12)
    + ' · scenario date ' + (trace.scenario_date || 'unknown') + (trace.scenario_crosses_month === false ? ' (same month as the run)' : '')
    + ' · temperature ' + trace.temperature + ' · up to ' + trace.max_attempts + ' attempts');
  if (trace.accepted) trace.accepted.patch = unifiedPatch(selected.files, trace.accepted.proposal);
  if (process.argv.includes('--publish')) {
    for (const dir of ['web/agent-runs', 'evidence/agent-runs']) fs.mkdirSync(path.join(project, dir), {recursive: true});
    fs.writeFileSync(path.join(project, 'evidence/agent-runs', trace.id + '.json'), JSON.stringify(trace, null, 2) + '\n');
    // The page features the newest agent version's latest verified run, else its latest run; every run
    // stays in evidence/agent-runs and in the totals.
    const featured = path.join(project, 'web/agent-runs', caseId + '.json'), current = fs.existsSync(featured) ? JSON.parse(fs.readFileSync(featured, 'utf8')) : null;
    const rank = item => [Number(item.agent_version || 1), item.state === 'verified' ? 1 : 0];
    const [version, verified] = rank(trace), [shownVersion, shownVerified] = current ? rank(current) : [0, 0];
    if (version > shownVersion || version === shownVersion && verified >= shownVerified) {
      fs.writeFileSync(featured, JSON.stringify(trace, null, 2) + '\n'); print('Published web/agent-runs/' + caseId + '.json');
    } else print('Recorded evidence/agent-runs/' + trace.id + '.json; the featured run stays the verified ' + current.id);
  }
  if (trace.state !== 'verified') process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {unifiedPatch};
