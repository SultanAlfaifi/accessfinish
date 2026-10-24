'use strict';
// Renders an AccessFinish agent trace as a timeline, replayed from a recorded
// run or followed live when the local server has a Nemotron key.
(() => {
  const $ = selector => document.querySelector(selector);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const seconds = ms => ms >= 60000 ? Math.floor(ms / 60000) + ' min ' + Math.round(ms % 60000 / 1000) + ' s' : Math.round(ms / 1000) + ' s';
  const money = usd => usd < 0.01 ? '$' + usd.toFixed(4) : '$' + usd.toFixed(2);
  const CHECKS = ['Trusted build in an offline sandbox', 'Booking completed with the keyboard only', 'Saved row read back with a read-only database account',
    'Booking reopened in a fresh browser', 'Mouse booking with different data, using month navigation', 'Clearing the date causes no error',
    'Reserved slot is not offered', 'Existing records unchanged', 'Sandbox isolation inspected'];
  let caseId = 'keyboard-date', trace = null, selected = -1, timer = null, live = null, status = null;

  async function json(url, options) {
    const response = await fetch(url, options); const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(value.error || 'Request failed'); return value;
  }

  function stepTitle(step) {
    if (step.kind === 'observe') return 'Run the journey on the original code';
    if (step.kind === 'propose') return 'Attempt ' + step.attempt + ' · Nemotron proposes a fix';
    return 'Attempt ' + step.attempt + ' · Verify in a fresh sandbox';
  }
  function stepLine(step) {
    if (step.kind === 'propose') return step.diagnosis;
    return step.headline;
  }
  function stepState(step) {
    if (step.kind === 'propose') return 'think';
    return step.verified ? 'pass' : 'fail';
  }

  function renderTimeline(count = trace ? trace.steps.length : 0, pending = false) {
    const list = $('#timeline'); list.replaceChildren();
    if (!trace) return;
    trace.steps.slice(0, count).forEach((step, index) => {
      const item = el('li', 'step ' + stepState(step) + (index === selected ? ' selected' : ''));
      const button = el('button'); button.type = 'button'; button.setAttribute('aria-pressed', String(index === selected));
      button.append(el('span', 'icon', step.kind === 'propose' ? '◆' : step.verified ? '✓' : '✗'));
      const text = el('span', 'text'); text.append(el('b', '', stepTitle(step)), el('span', 'line', stepLine(step)));
      const meta = el('span', 'meta', step.duration_ms ? seconds(step.duration_ms) : '');
      button.append(text, meta); button.addEventListener('click', () => { selected = index; renderTimeline(count, pending); renderDetail(); });
      item.append(button); list.append(item);
    });
    if (pending) {
      const item = el('li', 'step running'); const next = trace.steps[count];
      const label = next ? stepTitle(next) : live ? (trace.steps.length && trace.steps.at(-1).kind === 'propose' ? 'Building, booking and checking the database…' : 'Nemotron is reading the evidence…') : 'Working…';
      item.append(el('span', 'icon spinner', ''), el('span', 'text', label)); list.append(item);
    }
    if (!pending && count === trace.steps.length && trace.state !== 'running') {
      const verified = trace.state === 'verified';
      const item = el('li', 'step outcome ' + (verified ? 'pass' : 'fail'));
      item.append(el('span', 'icon', verified ? '✓' : '!'), el('span', 'text', verified
        ? 'Verified on attempt ' + trace.accepted.attempt + ' · ' + seconds(trace.duration_ms) + ' · ' + money(trace.estimated_cost_usd)
        : trace.state === 'error' ? 'Stopped: ' + trace.error : 'Not verified after ' + trace.steps.filter(step => step.kind === 'verify').length + ' attempts — nothing was accepted'));
      list.append(item);
    }
  }

  // Line diff of one literal edit, keeping two lines of context around changes.
  function diffLines(before, after) {
    const a = before.split('\n'), b = after.split('\n'), table = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    const rows = []; let i = 0, j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) { rows.push([' ', a[i]]); i++; j++; }
      else if (i < a.length && (j >= b.length || table[i + 1][j] >= table[i][j + 1])) rows.push(['-', a[i++]]);
      else rows.push(['+', b[j++]]);
    }
    const keep = rows.map((row, index) => row[0] !== ' ' || rows.slice(Math.max(0, index - 2), index + 3).some(near => near[0] !== ' '));
    const out = []; rows.forEach((row, index) => { if (keep[index]) out.push(row); else if (out.at(-1)?.[0] !== '…') out.push(['…', '']); });
    return out;
  }
  function codeBlock(edit) {
    const box = el('div', 'edit'); box.append(el('div', 'file', edit.path));
    const pre = el('pre', 'lines');
    for (const [mark, text] of diffLines(edit.old, edit.new)) pre.append(el('span', mark === '+' ? 'add' : mark === '-' ? 'del' : mark === '…' ? 'gap' : 'ctx', mark === '…' ? '⋯' : mark + ' ' + text));
    box.append(pre); return box;
  }
  function facts(rows) {
    const list = el('dl', 'facts-list');
    for (const [key, value] of rows) { if (value === undefined || value === null || value === '') continue; const row = el('div'); row.append(el('dt', '', key), el('dd', '', String(value))); list.append(row); }
    return list;
  }
  function trail(evidence) {
    const box = el('div', 'trail');
    const steps = evidence.focus_trail || [];
    for (const item of steps) {
      const [key, target] = item.split(' → '); const chip = el('span', 'chip'); chip.append(el('kbd', '', key), el('span', '', target || '')); box.append(chip);
    }
    box.append(el('span', 'chip stuck', 'stuck'));
    return box;
  }
  function evidenceView(step) {
    const wrap = el('div'); const evidence = step.evidence || {};
    if (evidence.stage === 'keyboard') {
      if (evidence.focus_trail?.length) wrap.append(el('p', '', 'Where Tab took keyboard focus, until it got stuck:'), trail(evidence));
      if (evidence.page) wrap.append(facts([['Focus ended on', [evidence.page.focus?.tag, evidence.page.focus?.id && '#' + evidence.page.focus.id].filter(Boolean).join(' ')],
        ['Fields the keyboard could use', (evidence.page.inputs || []).join(', ') || 'none']]));
    } else if (evidence.stage === 'outcome') {
      const saved = evidence.saved || {}, expected = evidence.expected || {}, customer = saved.customers?.[0] || {}, typed = expected.customer || {};
      const table = el('table', 'compare'); const head = el('tr'); head.append(el('th', '', ''), el('th', '', 'Typed by the user'), el('th', '', 'Saved in the database'));
      table.append(head);
      for (const [label, a, b] of [['Appointment', expected.start, saved.appointments?.[0]?.start], ['Phone', typed.phone_number, customer.phone_number], ['Email', typed.email, customer.email]]) {
        if (!a && !b) continue; const row = el('tr', a === b ? '' : 'mismatch'); row.append(el('th', '', label), el('td', '', a || '—'), el('td', '', b || '—')); table.append(row);
      }
      wrap.append(el('p', '', 'The confirmation page appeared. Reading the database tells a different story:'), table);
      if (evidence.date_field_history?.length) {
        const list = el('ol', 'history');
        for (const item of evidence.date_field_history) { const row = el('li'); row.append(el('span', '', item.action), el('code', '', item.date_field_value || '(empty)')); list.append(row); }
        wrap.append(el('p', '', 'The date field, each time its value changed:'), list);
      }
    } else if (evidence.stage === 'build' || evidence.stage === 'apply') {
      const pre = el('pre', 'log'); pre.textContent = evidence.error || ''; wrap.append(el('p', '', evidence.stage === 'build' ? 'The trusted compiler rejected the patched code:' : 'The edit did not match the source exactly:'), pre);
    } else if (evidence.stage === 'regression') {
      const flags = evidence.controls?.browser ? Object.entries(evidence.controls.browser).filter(([, value]) => typeof value === 'boolean') : [];
      const list = el('ul', 'checks'); for (const [key, value] of flags) list.append(el('li', value ? 'ok' : 'bad', key.replaceAll('_', ' ')));
      wrap.append(el('p', '', 'The keyboard booking was saved correctly, but the mouse path broke:'), flags.length ? list : el('pre', 'log', evidence.error || ''));
    }
    return wrap;
  }
  function proofView() {
    const proof = trace.accepted.proof || {}, box = el('div', 'proof');
    box.append(el('p', 'stamp', 'VERIFIED'));
    box.append(facts([['Saved appointment', proof.booking?.start && proof.booking.start.slice(0, 16) + '–' + (proof.booking.end || '').slice(11, 16) + ' Riyadh'],
      ['Saved customer', [proof.customer?.name, proof.customer?.phone_number].filter(Boolean).join(' · ')],
      ['Typed by the user', proof.typed && [proof.typed.first_name + ' ' + proof.typed.last_name, proof.typed.phone_number].join(' · ')],
      ['Reopened in a fresh browser', proof.reopened_date], ['Keyboard actions', proof.keyboard_actions]]));
    const list = el('ul', 'checks'); for (const check of CHECKS) list.append(el('li', 'ok', check)); box.append(list);
    if (trace.accepted.patch) {
      const link = el('a', 'download', 'Download the verified patch'); link.href = URL.createObjectURL(new Blob([trace.accepted.patch], {type: 'text/x-diff'}));
      link.download = 'accessfinish-' + trace.case_id + '.patch'; box.append(link);
    }
    return box;
  }
  function renderDetail() {
    const detail = $('#detail'); detail.replaceChildren();
    if (!trace || selected < 0) return;
    const step = trace.steps[selected]; if (!step) return;
    detail.append(el('p', 'kicker', stepTitle(step)));
    if (step.kind === 'propose') {
      detail.append(el('h3', '', 'Diagnosis'), el('blockquote', '', step.diagnosis));
      detail.append(el('h3', '', step.edits.length + (step.edits.length === 1 ? ' edit' : ' edits')));
      for (const edit of step.edits) detail.append(codeBlock(edit));
      if (step.usage) detail.append(el('p', 'micro', (step.usage.prompt_tokens || 0).toLocaleString() + ' input + ' + (step.usage.completion_tokens || 0).toLocaleString() + ' output tokens · ' + seconds(step.duration_ms)));
      return;
    }
    detail.append(el('h3', step.verified ? 'good' : 'bad', step.headline));
    if (step.verified && trace.accepted && trace.accepted.attempt === step.attempt) detail.append(proofView());
    else detail.append(evidenceView(step));
    if (step.run_id) detail.append(el('p', 'micro', 'Isolated run ' + step.run_id + ' · ' + seconds(step.duration_ms)));
  }

  function renderFacts() {
    const done = trace && trace.state === 'verified';
    $('#fact-attempts').textContent = done ? String(trace.accepted.attempt) : '—';
    $('#fact-time').textContent = trace && trace.duration_ms ? seconds(trace.duration_ms) : '—';
    $('#fact-cost').textContent = trace && trace.state !== 'running' ? money(trace.estimated_cost_usd) : '—';
    $('#fact-checks').textContent = String(CHECKS.length);
  }

  function replay() {
    clearTimeout(timer); if (!trace) return;
    let count = 0; selected = -1; $('#run-label').textContent = 'Replaying recorded run · ' + new Date(trace.started_at_utc).toUTCString().slice(5, 16);
    const tick = () => {
      if (count >= trace.steps.length) { selected = trace.steps.length - 1; renderTimeline(); renderDetail(); renderFacts(); return; }
      const step = trace.steps[count]; renderTimeline(count, true);
      timer = setTimeout(() => { count++; selected = count - 1; renderTimeline(count, count < trace.steps.length); renderDetail(); timer = setTimeout(tick, 1100); }, step.kind === 'propose' ? 1300 : 1700);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { count = trace.steps.length; tick(); } else tick();
  }

  async function load(id) {
    caseId = id; clearTimeout(timer); trace = null; selected = -1; live = null;
    for (const tab of document.querySelectorAll('.case')) tab.setAttribute('aria-selected', String(tab.dataset.case === id));
    $('#timeline').replaceChildren(); $('#detail').replaceChildren(); renderFacts();
    try {
      trace = await json('agent-runs/' + id + '.json');
      $('#goal').textContent = trace.goal; $('#empty').hidden = true; $('#replay').hidden = false; replay();
    } catch {
      $('#goal').textContent = id === 'keyboard-date' ? 'A keyboard-only customer books a 09:00 slot and it is saved for the right date.' : 'The phone number the customer typed is saved exactly.';
      $('#empty').hidden = false; $('#replay').hidden = true;
      $('#empty').textContent = status?.agent_ready ? 'No recorded run for this journey yet. Press Run live to start the agent.' : 'No recorded run for this journey yet. Run it locally with: node scripts/agent.cjs --case ' + id + ' --publish';
      $('#run-label').textContent = 'No recorded run';
    }
  }

  async function runLive() {
    $('#run-live').disabled = true; $('#replay').hidden = true; clearTimeout(timer);
    try {
      trace = await json('/api/agent', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({case_id: caseId})});
      live = trace.id; $('#run-label').textContent = 'Live run · Nemotron on Nebius Token Factory'; $('#empty').hidden = true;
      const poll = async () => {
        if (live !== trace.id) return;
        trace = await json('/api/agent/' + trace.id); selected = trace.steps.length - 1;
        const running = trace.state === 'running'; renderTimeline(trace.steps.length, running); renderDetail(); renderFacts();
        if (running) timer = setTimeout(poll, 2000); else { $('#run-live').disabled = false; $('#replay').hidden = false; }
      };
      poll();
    } catch (error) { $('#empty').hidden = false; $('#empty').textContent = error.message; $('#run-live').disabled = false; }
  }

  document.querySelectorAll('.case').forEach(tab => tab.addEventListener('click', () => load(tab.dataset.case)));
  $('#replay').addEventListener('click', replay);
  $('#run-live').addEventListener('click', runLive);
  (async () => {
    try { status = await json('/api/status'); $('#run-live').hidden = !status.agent_ready; } catch { status = null; }
    load(caseId);
  })();
})();
