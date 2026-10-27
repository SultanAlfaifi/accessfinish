'use strict';
// Nemotron on Token Factory, by the numbers: per-request usage recorded in every live trace.
//   node scripts/token-stats.cjs → web/agent-runs/usage.json (shown on the evidence page)
// Cost is the traces' own estimate at the public list price ($0.30 / $0.90 per million input / output
// tokens, cached input counted at the full input price); it is not a billed amount.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), dir = path.join(root, 'evidence/agent-runs');
const traces = fs.readdirSync(dir).filter(name => /^agent-[a-f0-9]{24}\.json$/.test(name)).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));

const quantile = (values, q) => { const v = [...values].sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : null; };
const round = (value, digits = 4) => Number(value.toFixed(digits));
const totals = {requests: 0, prompt_tokens: 0, cached_prompt_tokens: 0, completion_tokens: 0, reasoning_tokens: 0};
const proposalSeconds = [], groups = new Map();
for (const trace of traces) {
  for (const step of trace.steps) {
    if (step.kind === 'propose' && step.duration_ms) proposalSeconds.push(step.duration_ms / 1000);
    const usage = step.usage;
    if (!usage) continue;
    totals.requests++;
    totals.prompt_tokens += usage.prompt_tokens || 0;
    totals.completion_tokens += usage.completion_tokens || 0;
    totals.cached_prompt_tokens += usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0;
    totals.reasoning_tokens += usage.completion_tokens_details?.reasoning_tokens || 0;
  }
  const key = trace.case_id + ' v' + (trace.agent_version ?? 1);
  const group = groups.get(key) || {case_id: trace.case_id, agent_version: String(trace.agent_version ?? 1), runs: 0, verified: 0, cost_usd: 0, minutes: []};
  group.runs++; group.verified += trace.state === 'verified' ? 1 : 0; group.cost_usd += trace.estimated_cost_usd || 0;
  if (trace.duration_ms) group.minutes.push(trace.duration_ms / 60000);
  groups.set(key, group);
}
const cost = traces.reduce((sum, trace) => sum + (trace.estimated_cost_usd || 0), 0);
const byCase = id => [...groups.values()].filter(group => group.case_id === id);
const perVerified = list => { const verified = list.reduce((s, g) => s + g.verified, 0); return verified ? round(list.reduce((s, g) => s + g.cost_usd, 0) / verified, 2) : null; };
const keyboardFinal = byCase('keyboard-date').filter(group => ['4', '5'].includes(group.agent_version));
const result = {
  generated_from: 'evidence/agent-runs', generator: 'scripts/token-stats.cjs',
  note: 'Requests are the model calls that returned usage. Cost is the traces\' estimate at the public list price ($0.30 / $0.90 per million input / output tokens), with cached input counted at the full input price; it is not a billed amount.',
  runs: traces.length, requests: totals.requests,
  prompt_tokens: totals.prompt_tokens, cached_prompt_tokens: totals.cached_prompt_tokens, cached_share: round(totals.cached_prompt_tokens / totals.prompt_tokens, 3),
  completion_tokens: totals.completion_tokens, reasoning_tokens: totals.reasoning_tokens, reasoning_share: round(totals.reasoning_tokens / totals.completion_tokens, 3),
  estimated_cost_usd: round(cost, 2),
  seconds_to_proposal: {median: round(quantile(proposalSeconds, 0.5), 1), p90: round(quantile(proposalSeconds, 0.9), 1), note: 'From the start of an attempt to Nemotron\'s proposal, including its code lookups.'},
  phone_cost_per_run_usd: round(byCase('customer-phone').reduce((s, g) => s + g.cost_usd, 0) / byCase('customer-phone').reduce((s, g) => s + g.runs, 0), 3),
  keyboard_v4_v5_cost_per_verified_fix_usd: perVerified(keyboardFinal),
  by_case_and_version: [...groups.values()].sort((a, b) => a.case_id.localeCompare(b.case_id) || a.agent_version.localeCompare(b.agent_version))
    .map(({minutes, ...group}) => ({...group, cost_usd: round(group.cost_usd, 3), median_run_minutes: round(quantile(minutes, 0.5), 1)})),
};
fs.writeFileSync(path.join(root, 'web/agent-runs/usage.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({...result, by_case_and_version: undefined}, null, 2));
