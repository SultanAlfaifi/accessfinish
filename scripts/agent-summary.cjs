'use strict';
// Totals across every recorded live agent run, for the page and README: overall per case,
// and per agent version so a changed loop is never mixed into an earlier version's results.
// Traces recorded before versioning count as version 1.
const fs = require('node:fs'), path = require('node:path');
const {scenario} = require('../lib/fixture.cjs');
const totals = () => ({runs: 0, verified: 0, first_attempt: 0, attempts: 0, executed: 0, false_booked_caught: 0, wrong_saves_caught: 0, reopen_mismatches_caught: 0,
  runs_saved_correctly: 0, cost_usd: 0, seconds: 0});
// An outcome failure where the saved booking was right and only reopening it showed something else.
const reopenOnly = step => step.stage === 'outcome' && (step.evidence?.reasons || []).length > 0 && step.evidence.reasons.every(reason => /^reopen_/.test(reason))
  && step.evidence.saved?.appointments?.[0]?.start === step.evidence.expected?.start;
function count(item, run) {
  const verifies = run.steps.filter(step => step.kind === 'verify'), outcomes = verifies.filter(step => step.stage === 'outcome');
  item.runs++; item.attempts += verifies.length; item.executed += verifies.filter(step => step.run_id).length; item.cost_usd += run.estimated_cost_usd; item.seconds += run.duration_ms / 1000;
  // Every outcome failure is a "booked" page with a wrong result: a wrong saved row, or a right row that reopens wrong.
  item.false_booked_caught += outcomes.length; item.reopen_mismatches_caught += outcomes.filter(reopenOnly).length; item.wrong_saves_caught += outcomes.filter(step => !reopenOnly(step)).length;
  if (run.state === 'verified' || outcomes.some(reopenOnly)) item.runs_saved_correctly++;
  if (run.state === 'verified') { item.verified++; if (run.accepted.attempt === 1) item.first_attempt++; }
}
// The keyboard-date reset only happens when the booked date is in a later month than the day of the run
// (the date picker must change month), as in every version 1 run. Within a version, runs whose date was
// in the same month are counted apart. Older traces used the date the fixture derived from the clock.
function crossesMonth(run) {
  if (typeof run.scenario_crosses_month === 'boolean') return run.scenario_crosses_month;
  if (!run.started_at_utc) return null;
  return (run.scenario_date || scenario(new Date(run.started_at_utc)).date).slice(0, 7) !== run.started_at_utc.slice(0, 7);
}
const rounded = cases => { for (const item of Object.values(cases)) { item.cost_usd = Number(item.cost_usd.toFixed(4)); item.seconds = Math.round(item.seconds); } return cases; };
function summarize(runs) {
  const cases = {}, versions = {};
  for (const run of runs) {
    count(cases[run.case_id] ||= totals(), run);
    const version = versions[String(run.agent_version || '1')] ||= {runs: 0, cost_usd: 0, cases: {}};
    const bucket = crossesMonth(run) === false ? version.same_month_date_cases ||= {} : version.cases;
    version.runs++; version.cost_usd += run.estimated_cost_usd; count(bucket[run.case_id] ||= totals(), run);
  }
  for (const version of Object.values(versions)) {
    version.cost_usd = Number(version.cost_usd.toFixed(4)); rounded(version.cases); if (version.same_month_date_cases) rounded(version.same_month_date_cases);
  }
  return {generated_from: 'evidence/agent-runs', model: 'nvidia/nemotron-3-super-120b-a12b', runs: runs.length,
    cost_usd: Number(runs.reduce((sum, run) => sum + run.estimated_cost_usd, 0).toFixed(4)), cases: rounded(cases), agent_versions: versions};
}
if (require.main === module) {
  const dir = path.join(__dirname, '../evidence/agent-runs');
  const summary = summarize(fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))));
  fs.writeFileSync(path.join(__dirname, '../web/agent-runs/summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}
module.exports = {summarize, crossesMonth};
