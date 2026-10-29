'use strict';
// Table of every live agent run, from agent-runs/runs/index.json (scripts/evidence-index.cjs).
(() => {
  const $ = selector => document.querySelector(selector);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const link = (href, text, describedBy) => { const node = el('a', '', text); node.href = href; if (describedBy) node.setAttribute('aria-describedby', describedBy); return node; };
  const seconds = ms => ms >= 60000 ? Math.floor(ms / 60000) + ' min ' + Math.round(ms % 60000 / 1000) + ' s' : Math.round(ms / 1000) + ' s';
  const CASES = {'customer-phone': 'Save the phone the customer typed', 'keyboard-date': 'Book an appointment without a mouse'};

  function verdict(run) {
    if (run.state === 'verified') return el('span', 'good', 'Verified on attempt ' + run.verified_attempt);
    return el('span', 'bad', run.state === 'error' ? 'Stopped by an error' : run.state === 'running' ? 'Still running' : 'Not verified');
  }
  function row(run) {
    const tr = el('tr'), name = el('th'), id = 'run-' + run.id;
    tr.dataset.case = run.case_id; tr.dataset.state = run.state;
    name.scope = 'row'; name.id = id;
    name.append(el('span', '', CASES[run.case_id] || run.title || run.case_id), el('span', 'id', run.id.slice(6, 14)));
    if (run.featured) name.append(el('span', 'tag feature', 'On the home page'));
    const agent = el('td', 'nowrap', run.agent_version ? 'v' + run.agent_version + (run.agent_commit ? ' · ' : '') : '');
    if (run.agent_commit) { const code = el('code'); code.append(run.agent_url ? link(run.agent_url, run.agent_commit) : run.agent_commit); agent.append(code); }
    if (!agent.textContent) agent.textContent = '—';
    const started = el('td', 'nowrap'), time = el('time', '', run.started_at_utc.slice(0, 16).replace('T', ' ')); time.dateTime = run.started_at_utc; started.append(time);
    const attempts = el('td'), pips = el('span', 'pips');
    pips.setAttribute('aria-hidden', 'true');
    for (const result of run.results) pips.append(el('span', 'pip ' + (result === 'verified' ? 'ok' : 'bad')));
    const strip = el('span', 'strip'); strip.append(pips); attempts.append(el('span', '', String(run.attempts)), strip);
    if (run.attempts > run.executed) attempts.append(el('span', 'note', (run.attempts - run.executed) + ' rejected before execution'));
    const status = el('td'); status.append(verdict(run));
    const links = el('td'), list = el('span', 'links');
    list.append(link('./?case=' + encodeURIComponent(run.case_id) + '&run=' + encodeURIComponent(run.id) + '#agent', 'Replay', id),
      link(run.trace, 'Trace', id), link(run.raw_url, 'Raw', id));
    links.append(list);
    tr.append(name, status, links, attempts, el('td', 'num', String(run.false_booked_caught)), el('td', 'num', run.duration_ms == null ? '—' : seconds(run.duration_ms)),
      el('td', 'num', '$' + run.cost_usd.toFixed(4)), agent, started);
    return tr;
  }

  // What each agent version changed (lib/agent.cjs AGENT_VERSION), shown next to its results from summary.json.
  const CHANGES = {
    1: 'Pre-versioning runs from seven loop commits; read_file in the last run · caps of 4, 6, then 8 attempts',
    2: 'Code search, call-chain provenance of the date field, attempt ledger, reopen evidence, sampling',
    3: 'Whitespace-tolerant anchors, whole-line mismatch reports',
    4: 'Reopen progress tracked, wrong-path edits moved, read-only code named',
    5: 'The file\'s own lines returned with a failed anchor; a code frame with a compile error',
  };
  async function versions() {
    const response = await fetch('agent-runs/summary.json'); if (!response.ok) return;
    const summary = await response.json(), body = $('#versions');
    for (const [version, data] of Object.entries(summary.agent_versions || {})) {
      const keyboard = data.cases['keyboard-date'] || {}, phone = data.cases['customer-phone'] || {}, tr = el('tr'), name = el('th', 'nowrap', 'v' + version);
      name.scope = 'row';
      const limit = (data.max_attempts || []).length ? ' · up to ' + data.max_attempts.join(' or ') + ' attempts' : '';
      // One square per keyboard run: verified, saved correctly but not verified, or never saved right.
      const squares = el('td'), grid = el('span', 'squares'), runs = keyboard.runs || 0, verified = keyboard.verified || 0, saved = keyboard.runs_saved_correctly || 0;
      grid.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < runs; i++) grid.append(el('span', 'sq ' + (i < verified ? 'ok' : i < saved ? 'saved' : '')));
      squares.append(el('span', 'nowrap', runs + ' '), grid);
      tr.append(name, el('td', 'num' + (verified ? ' good' : ''), verified + ' / ' + runs), el('td', 'num', saved + ' / ' + runs), squares,
        el('td', 'num', (phone.first_attempt || 0) + ' / ' + (phone.runs || 0)), el('td', 'num', (keyboard.executed ?? '—') + ' / ' + (keyboard.attempts || 0)),
        el('td', 'num', '$' + Number(data.cost_usd || 0).toFixed(2)), el('td', '', (CHANGES[version] || '') + limit));
      body.append(tr);
    }
  }
  versions().catch(() => {});

  async function usage() {
    const response = await fetch('agent-runs/usage.json'); if (!response.ok) return;
    const u = await response.json(), percent = value => Math.round(value * 100) + '%';
    $('#u-requests').textContent = String(u.requests); $('#u-cached').textContent = percent(u.cached_share); $('#u-reasoning').textContent = percent(u.reasoning_share);
    $('#u-latency').textContent = Math.round(u.seconds_to_proposal.median) + ' s'; $('#u-p90').textContent = Math.round(u.seconds_to_proposal.p90) + ' s';
    $('#u-fix').textContent = '$' + u.keyboard_v4_v5_cost_per_verified_fix_usd.toFixed(2); $('#u-phone').textContent = '$' + u.phone_cost_per_run_usd.toFixed(3);
  }
  usage().catch(() => {});

  // Filter the runs table by case or verdict.
  let allRuns = [];
  function applyFilter() {
    const value = document.querySelector('input[name=filter]:checked')?.value || 'all';
    let shown = 0;
    for (const tr of $('#runs').children) {
      const visible = value === 'all' || tr.dataset.case === value || (value === 'verified' && tr.dataset.state === 'verified');
      tr.hidden = !visible; shown += visible ? 1 : 0;
    }
    if (allRuns.length) $('#runs-status').textContent = (value === 'all' ? '' : 'Showing ' + shown + ' of ' + allRuns.length + ' runs. ') + allRuns.length + ' runs, ' + allRuns.filter(r => r.state === 'verified').length + ' verified. Totals cover every run in evidence/agent-runs.';
  }
  for (const input of document.querySelectorAll('input[name=filter]')) input.addEventListener('change', applyFilter);

  (async () => {
    try {
      const response = await fetch('agent-runs/runs/index.json'); if (!response.ok) throw Error();
      const index = await response.json(), totals = index.totals;
      // Attempts rejected before execution (the edit did not apply) never reached a sandbox, so they are counted apart.
      const unexecuted = totals.attempts - totals.executed;
      $('#total-runs').textContent = String(totals.runs); $('#total-executed').textContent = String(totals.executed);
      $('#total-unexecuted').textContent = String(unexecuted); $('#total-unexecuted-note').hidden = !unexecuted;
      $('#total-caught').textContent = String(totals.false_booked_caught); $('#total-cost').textContent = '$' + totals.cost_usd.toFixed(2);
      $('#runs').replaceChildren(...index.runs.map(row)); allRuns = index.runs; applyFilter();
    } catch {
      $('#runs-status').textContent = 'The run index could not be loaded. Build it with: node scripts/evidence-index.cjs';
    }
  })();
})();
