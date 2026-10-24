'use strict';
// Totals across every recorded live agent run, for the page and README.
const fs = require('node:fs'), path = require('node:path');
const dir = path.join(__dirname, '../evidence/agent-runs');
const runs = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
const cases = {};
for (const run of runs) {
  const item = cases[run.case_id] ||= {runs: 0, verified: 0, first_attempt: 0, attempts: 0, wrong_saves_caught: 0, cost_usd: 0, seconds: 0};
  const verifies = run.steps.filter(step => step.kind === 'verify');
  item.runs++; item.attempts += verifies.length; item.cost_usd += run.estimated_cost_usd; item.seconds += run.duration_ms / 1000;
  item.wrong_saves_caught += verifies.filter(step => step.stage === 'outcome').length;
  if (run.state === 'verified') { item.verified++; if (run.accepted.attempt === 1) item.first_attempt++; }
}
for (const item of Object.values(cases)) { item.cost_usd = Number(item.cost_usd.toFixed(4)); item.seconds = Math.round(item.seconds); }
const summary = {generated_from: 'evidence/agent-runs', model: 'nvidia/nemotron-3-super-120b-a12b', runs: runs.length,
  cost_usd: Number(runs.reduce((sum, run) => sum + run.estimated_cost_usd, 0).toFixed(4)), cases};
fs.writeFileSync(path.join(__dirname, '../web/agent-runs/summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
