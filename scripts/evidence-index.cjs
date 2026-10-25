'use strict';
// Builds web/agent-runs/runs/: index.json (one row per live run, for web/evidence.html) and a slim
// copy of every trace that index.html can replay with ?run=<id>. The raw traces stay in
// evidence/agent-runs/; each row links to its raw file pinned to the commit that recorded it.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), source = path.join(root, 'evidence/agent-runs'), out = path.join(root, 'web/agent-runs/runs');
const REPO = 'https://github.com/SultanAlfaifi/accessfinish', CONTEXT = 2;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const git = args => { try { return cp.execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}); } catch { return ''; } };

// The workflow commits traces as "Record live agent runs from <sha>", <sha> being the agent's source.
// A shallow clone cannot see that history, so earlier answers are kept from the previous index.
function provenance() {
  const found = new Map(); let commit = null;
  for (const line of git(['log', '--diff-filter=A', '--format=@%h %s', '--name-only', '--', 'evidence/agent-runs']).split('\n')) {
    const header = /^@(\w+) (.*)$/.exec(line), match = header && /^Record live agent runs from ([0-9a-f]{7,40})$/.exec(header[2]);
    if (header) commit = match && {recorded_in: header[1], agent_commit: match[1].slice(0, 7)};
    else if (commit && line.trim()) found.set(path.basename(line.trim(), '.json'), commit);
  }
  return found;
}

// Keep what the page renders; drop the page-text dumps and trim each edit to its changed lines.
function trimEdit(edit) {
  const a = String(edit.old).split('\n'), b = String(edit.new).split('\n');
  let start = 0, end = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  const from = Math.max(0, start - CONTEXT), drop = Math.max(0, end - CONTEXT);
  return {...edit, old: a.slice(from, a.length - drop).join('\n'), new: b.slice(from, b.length - drop).join('\n')};
}
const tokens = usage => ({prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0});
function slimStep(step) {
  const slim = {...step};
  if (step.usage) slim.usage = tokens(step.usage);
  if (Array.isArray(step.edits)) slim.edits = step.edits.map(trimEdit);
  if (step.evidence?.page) slim.evidence = {...step.evidence, page: {focus: step.evidence.page.focus, inputs: step.evidence.page.inputs}};
  return slim;
}

const previous = new Map((() => { try { return read(path.join(out, 'index.json')).runs; } catch { return []; } })().map(run => [run.id, run]));
const featured = new Set(fs.readdirSync(path.join(root, 'web/agent-runs')).filter(name => /^[a-z-]+\.json$/.test(name) && name !== 'summary.json')
  .map(name => { try { return read(path.join(root, 'web/agent-runs', name)).id; } catch { return null; } }));
const tracked = new Set(git(['ls-files', 'evidence/agent-runs']).split('\n').filter(Boolean).map(file => path.basename(file, '.json')));
const known = provenance(), runs = [];
fs.mkdirSync(out, {recursive: true});
for (const name of fs.readdirSync(source).filter(name => /^agent-[a-f0-9]{24}\.json$/.test(name)).sort()) {
  const bytes = fs.readFileSync(path.join(source, name)), run = JSON.parse(bytes), id = path.basename(name, '.json');
  if (run.id !== id) throw Error(name + ' holds trace ' + run.id);
  const verifies = run.steps.filter(step => step.kind === 'verify');
  // Untracked traces were just produced by this checkout's agent (the CI run that is about to commit them).
  const origin = known.get(id) || previous.get(id)?.agent_commit && {recorded_in: previous.get(id).recorded_in, agent_commit: previous.get(id).agent_commit}
    || (!tracked.has(id) && process.env.GITHUB_SHA ? {recorded_in: null, agent_commit: process.env.GITHUB_SHA.slice(0, 7)} : {});
  const raw = 'evidence/agent-runs/' + name, sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const ref = origin.recorded_in || process.env.GITHUB_REF_NAME || 'HEAD';
  runs.push({id, case_id: run.case_id, title: run.title, started_at_utc: run.started_at_utc, finished_at_utc: run.finished_at_utc || null,
    state: run.state, error: run.error || undefined, featured: featured.has(id) || undefined,
    agent_version: run.agent_version ?? null, agent_commit: origin.agent_commit || null, recorded_in: origin.recorded_in || null,
    agent_url: origin.agent_commit ? REPO + '/tree/' + origin.agent_commit : null,
    attempts: verifies.length, results: verifies.map(step => step.verified ? 'verified' : step.stage || 'rejected'),
    verified_attempt: run.accepted?.attempt ?? null, false_booked_caught: verifies.filter(step => step.stage === 'outcome').length,
    duration_ms: run.duration_ms ?? null, cost_usd: Number((run.estimated_cost_usd || 0).toFixed(6)), usage: tokens(run.usage || {}),
    trace: 'agent-runs/runs/' + name, raw, raw_url: REPO + '/blob/' + encodeURIComponent(ref).replaceAll('%2F', '/') + '/' + raw, raw_sha256: sha256});
  const slim = {...run, steps: run.steps.map(slimStep), slim: {of: raw, raw_sha256: sha256, note: 'Display copy: page-text dumps removed, token usage reduced to totals, edits trimmed to the changed lines with ' + CONTEXT + ' lines of context.'}};
  if (run.usage) slim.usage = tokens(run.usage);
  if (run.accepted) { slim.accepted = {...run.accepted}; delete slim.accepted.proposal; }
  fs.writeFileSync(path.join(out, name), JSON.stringify(slim) + '\n');
}
for (const name of fs.readdirSync(out)) if (/^agent-[a-f0-9]{24}\.json$/.test(name) && !runs.some(run => run.id + '.json' === name)) fs.rmSync(path.join(out, name));
runs.sort((a, b) => b.started_at_utc.localeCompare(a.started_at_utc));
const sum = key => runs.reduce((total, run) => total + (run[key] || 0), 0);
const index = {generated_from: 'evidence/agent-runs', generator: 'scripts/evidence-index.cjs', repository: REPO,
  totals: {runs: runs.length, verified_runs: runs.filter(run => run.state === 'verified').length, attempts: sum('attempts'),
    false_booked_caught: sum('false_booked_caught'), duration_ms: sum('duration_ms'), cost_usd: Number(sum('cost_usd').toFixed(4))}, runs};
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log('Indexed ' + runs.length + ' runs into web/agent-runs/runs/ (' + runs.filter(run => !run.agent_commit).length + ' without a known agent commit)');
