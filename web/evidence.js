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
    const status = el('td'); status.append(verdict(run));
    const links = el('td'), list = el('span', 'links');
    list.append(link('./?case=' + encodeURIComponent(run.case_id) + '&run=' + encodeURIComponent(run.id) + '#agent', 'Replay', id),
      link(run.trace, 'Trace', id), link(run.raw_url, 'Raw', id));
    links.append(list);
    tr.append(name, agent, started, attempts, status, el('td', 'num', String(run.false_booked_caught)), el('td', 'num', run.duration_ms == null ? '—' : seconds(run.duration_ms)),
      el('td', 'num', '$' + run.cost_usd.toFixed(4)), links);
    return tr;
  }

  (async () => {
    try {
      const response = await fetch('agent-runs/runs/index.json'); if (!response.ok) throw Error();
      const index = await response.json(), totals = index.totals;
      $('#total-runs').textContent = String(totals.runs); $('#total-attempts').textContent = String(totals.attempts);
      $('#total-caught').textContent = String(totals.false_booked_caught); $('#total-cost').textContent = '$' + totals.cost_usd.toFixed(2);
      $('#runs').replaceChildren(...index.runs.map(row));
      $('#runs-status').textContent = totals.runs + ' runs, ' + totals.verified_runs + ' verified. Totals cover every run in evidence/agent-runs.';
    } catch {
      $('#runs-status').textContent = 'The run index could not be loaded. Build it with: node scripts/evidence-index.cjs';
    }
  })();
})();
