'use strict';
// Renders an AccessFinish agent trace as a timeline, replayed from a recorded
// run (?case=…&run=<id> picks any run in agent-runs/runs/) or followed live when
// the local server has a Nemotron key.
(() => {
  const $ = selector => document.querySelector(selector);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const hidden = (tag, className, text) => { const node = el(tag, className, text); node.setAttribute('aria-hidden', 'true'); return node; };
  const seconds = ms => ms >= 60000 ? Math.floor(ms / 60000) + ' min ' + Math.round(ms % 60000 / 1000) + ' s' : Math.round(ms / 1000) + ' s';
  const money = usd => usd < 0.01 ? '$' + usd.toFixed(4) : '$' + usd.toFixed(2);
  const plural = (count, word) => count + ' ' + word + (count === 1 ? '' : 's');
  const CHECKS = ['Trusted build in an offline sandbox', 'Booking completed with the keyboard only', 'Saved row read back with a read-only database account',
    'Booking reopened in a fresh browser', 'Mouse booking with different data, using month navigation', 'Clearing the date causes no error',
    'Reserved slot is not offered', 'Existing records unchanged', 'Sandbox isolation inspected'];
  const tabs = [...document.querySelectorAll('[role=tab][data-case]')], CASES = tabs.map(tab => tab.dataset.case);
  const params = new URLSearchParams(location.search), wantedRun = /^agent-[a-f0-9]{24}$/.test(params.get('run') || '') ? params.get('run') : null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const traces = new Map();
  let caseId = CASES.includes(params.get('case')) ? params.get('case') : CASES[0];
  let trace = null, selected = -1, shown = 0, playing = false, timer = null, live = null, follow = true, status = null, patchUrl = null;

  async function json(url, options) {
    const response = await fetch(url, options); const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(value.error || 'Request failed'); return value;
  }

  function stepTitle(step) {
    if (step.kind === 'observe') return 'Run the journey on the original code';
    if (step.kind === 'propose') return 'Attempt ' + step.attempt + ' · Nemotron proposes a fix';
    if (step.kind === 'read') return 'Attempt ' + step.attempt + ' · Nemotron opens a source file';
    if (step.kind === 'search') return 'Attempt ' + step.attempt + ' · Nemotron searches the code';
    if (step.kind === 'verify') return 'Attempt ' + step.attempt + ' · Verify in a fresh sandbox';
    return 'Attempt ' + step.attempt + ' · ' + step.kind;
  }
  function stepLine(step) {
    if (step.kind === 'propose') return step.diagnosis;
    if (step.kind === 'read') return step.path + (step.limited ? ' (read limit reached)' : step.already_provided ? ' (already provided)' : step.found ? '' : ' (not available)');
    if (step.kind === 'search') return '/' + step.query + '/' + (step.path ? ' in ' + step.path : '') + (step.limited ? ' (limit reached)' : ' · ' + step.matches + (step.matches === 1 ? ' match' : ' matches'));
    return step.headline ?? step.path ?? '';
  }
  function stepState(step) {
    if (step.kind === 'observe' || step.kind === 'verify') return step.verified ? 'pass' : 'fail';
    return step.kind === 'propose' ? 'think' : 'read';
  }
  // Words for what the ✓ / ✗ icons show.
  function stepStatus(step) {
    if (step.kind === 'observe') return step.verified ? 'works' : 'fails';
    if (step.kind === 'verify') return step.verified ? 'verified' : 'rejected';
    return '';
  }
  function stepHeadline(step) {
    if (step.kind === 'propose') return stepTitle(step) + ' with ' + plural(step.edits?.length || 0, 'edit') + '.';
    const state = stepStatus(step);
    return stepTitle(step) + (state ? ', ' + state : '') + ': ' + stepLine(step);
  }
  function outcomeText() {
    if (trace.state === 'verified') return 'Verified on attempt ' + trace.accepted.attempt + ' · ' + seconds(trace.duration_ms) + ' · ' + money(trace.estimated_cost_usd);
    if (trace.state === 'error') return 'Stopped: ' + trace.error;
    const verifies = trace.steps.filter(step => step.kind === 'verify');
    return 'Not verified after ' + plural(verifies.length, 'attempt') + ' — no patch accepted, ' + verifies.filter(step => step.stage === 'outcome').length + ' false "booked" pages caught';
  }

  // One live region, polite and throttled: only the newest headline is spoken.
  let spoken = 0, speakTimer = null;
  function announce(text, now = false) {
    clearTimeout(speakTimer);
    speakTimer = setTimeout(() => { $('#announcer').textContent = text; spoken = Date.now(); }, now ? 0 : Math.max(0, spoken + 4000 - Date.now()));
  }
  function hush() { clearTimeout(speakTimer); $('#announcer').textContent = ''; }

  function stepItem(step, index) {
    const item = el('li', 'step ' + stepState(step)); item.dataset.index = index;
    const button = el('button'); button.type = 'button'; button.setAttribute('aria-controls', 'detail');
    const glyph = step.kind === 'propose' ? '◆' : step.kind === 'read' ? '↗' : step.kind === 'search' ? '⌕' : stepState(step) === 'pass' ? '✓' : step.kind === 'verify' || step.kind === 'observe' ? '✗' : '•';
    const text = el('span', 'text'); text.append(el('b', '', stepTitle(step)));
    if (stepStatus(step)) text.append(el('span', 'sr-only', stepStatus(step) + ':'));
    text.append(el('span', 'line', stepLine(step)));
    button.append(hidden('span', 'icon', glyph), text, el('span', 'meta', step.duration_ms ? seconds(step.duration_ms) : ''));
    button.addEventListener('click', () => choose(index));
    item.append(button); return item;
  }
  // Grows and trims the list in place, so a focused step keeps focus while the replay moves on.
  function renderTimeline(count, pending = false) {
    const list = $('#timeline');
    for (const node of list.querySelectorAll('.running, .outcome')) node.remove();
    if (!trace) return list.replaceChildren();
    while (list.children.length > count) list.lastElementChild.remove();
    for (let index = list.children.length; index < count; index++) list.append(stepItem(trace.steps[index], index));
    markSelected();
    if (pending) {
      const item = el('li', 'step running'), next = trace.steps[count];
      const label = next ? stepTitle(next) : live ? (trace.steps.length && trace.steps.at(-1).kind === 'propose' ? 'Building, booking and checking the database…' : 'Nemotron is reading the evidence…') : 'Working…';
      item.append(hidden('span', 'icon spinner', ''), el('span', 'text', label)); list.append(item);
    } else if (count === trace.steps.length && trace.state !== 'running') {
      const verified = trace.state === 'verified', item = el('li', 'step outcome ' + (verified ? 'pass' : 'fail'));
      item.append(hidden('span', 'icon', verified ? '✓' : '!'), el('span', 'text', outcomeText())); list.append(item);
    }
  }
  function markSelected() {
    for (const item of $('#timeline').querySelectorAll('li[data-index]')) {
      const on = Number(item.dataset.index) === selected, button = item.firstElementChild;
      item.classList.toggle('selected', on); if (on) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
    }
  }
  // One dot per attempt of the shown run; attempts the replay has not reached yet stay hollow.
  function renderStrip(id) {
    const run = traces.get(id), strip = $('#strip-' + id); if (!strip) return;
    if (!run) return strip.replaceChildren();
    const verifies = run.steps.map((step, index) => [step, index]).filter(([step]) => step.kind === 'verify');
    const current = id === caseId && trace === run, attempt = current && selected >= 0 ? trace.steps[selected].attempt : null;
    const dots = hidden('span', 'pips');
    for (const [step, index] of verifies) dots.append(el('span', 'pip ' + (step.verified ? 'ok' : 'bad') + (current && index >= shown ? ' todo' : '') + (step.attempt === attempt ? ' now' : '')));
    const result = run.state === 'verified' ? (verifies.length === 1 ? 'verified' : 'verified on attempt ' + run.accepted.attempt) : run.state === 'running' ? 'running' : run.state === 'error' ? 'stopped by an error' : 'none verified';
    strip.replaceChildren(dots, el('span', 'strip-text', 'This run: ' + plural(verifies.length, 'attempt') + ', ' + result));
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
    for (const [mark, text] of diffLines(edit.old, edit.new)) {
      if (mark !== '…') { pre.append(el('span', mark === '+' ? 'add' : mark === '-' ? 'del' : 'ctx', mark + ' ' + text)); continue; }
      const gap = el('span', 'gap'); gap.append(hidden('span', '', '⋯'), el('span', 'sr-only', 'unchanged lines')); pre.append(gap);
    }
    box.append(pre); return box;
  }
  function facts(rows) {
    const list = el('dl', 'facts-list');
    for (const [key, value] of rows) { if (value === undefined || value === null || value === '') continue; const row = el('div'); row.append(el('dt', '', key), el('dd', '', String(value))); list.append(row); }
    return list;
  }
  function trail(evidence) {
    const box = el('div', 'trail');
    for (const item of evidence.focus_trail || []) {
      const [key, target] = item.split(' → '); const chip = el('span', 'chip'); chip.append(el('kbd', '', key), el('span', '', target || '')); box.append(chip);
    }
    box.append(el('span', 'chip stuck', 'stuck'));
    return box;
  }
  function header(text, scope) { const cell = el('th'); cell.scope = scope; cell.textContent = text; return cell; }
  function evidenceView(step) {
    const wrap = el('div'); const evidence = step.evidence || {};
    if (evidence.stage === 'keyboard') {
      if (evidence.focus_trail?.length) wrap.append(el('p', '', 'Where Tab took keyboard focus, until it got stuck:'), trail(evidence));
      if (evidence.page) wrap.append(facts([['Focus ended on', [evidence.page.focus?.tag, evidence.page.focus?.id && '#' + evidence.page.focus.id].filter(Boolean).join(' ')],
        ['Fields the keyboard could use', (evidence.page.inputs || []).join(', ') || 'none']]));
    } else if (evidence.stage === 'outcome') {
      const saved = evidence.saved || {}, expected = evidence.expected || {}, customer = saved.customers?.[0] || {}, typed = expected.customer || {};
      const table = el('table', 'compare'), head = el('tr'), body = el('tbody'), thead = el('thead'), field = header('', 'col');
      field.append(el('span', 'sr-only', 'Field'));
      head.append(field, header('Typed by the user', 'col'), header('Saved in the database', 'col')); thead.append(head);
      table.append(el('caption', 'sr-only', 'What the user typed compared with what the database saved'), thead, body);
      for (const [label, a, b] of [['Appointment', expected.start, saved.appointments?.[0]?.start], ['Phone', typed.phone_number, customer.phone_number], ['Email', typed.email, customer.email]]) {
        if (!a && !b) continue;
        const row = el('tr', a === b ? '' : 'mismatch'), savedCell = el('td', '', b || '—');
        if (a !== b) savedCell.append(el('span', 'sr-only', ' (does not match)'));
        row.append(header(label, 'row'), el('td', '', a || '—'), savedCell); body.append(row);
      }
      wrap.append(el('p', '', 'The confirmation page appeared. Reading the database tells a different story:'), table);
      if (evidence.timeline_after_typing_date?.length) {
        const list = el('ol', 'history');
        for (const item of evidence.timeline_after_typing_date) { const row = el('li', /no key pressed/.test(item.event) ? 'jump' : ''); row.append(el('code', '', item.t), el('span', '', item.event)); list.append(row); }
        wrap.append(el('p', '', 'What happened after the date was typed:'), list);
      } else if (evidence.date_field_history?.length) {
        const list = el('ol', 'history');
        for (const item of evidence.date_field_history) { const row = el('li'); row.append(el('span', '', item.action), el('code', '', item.date_field_value || '(empty)')); list.append(row); }
        wrap.append(el('p', '', 'The date field, each time its value changed:'), list);
      }
    } else if (evidence.stage === 'build' || evidence.stage === 'apply' || evidence.stage === 'format') {
      const pre = el('pre', 'log'); pre.textContent = evidence.error || '';
      wrap.append(el('p', '', evidence.stage === 'build' ? 'The trusted compiler rejected the patched code:' : evidence.stage === 'apply' ? 'The edit did not match the source exactly:' : 'The answer could not be used as a patch:'), pre);
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
      if (patchUrl) URL.revokeObjectURL(patchUrl);
      patchUrl = URL.createObjectURL(new Blob([trace.accepted.patch], {type: 'text/x-diff'}));
      const link = el('a', 'download', 'Download the verified patch'); link.href = patchUrl; link.download = 'accessfinish-' + trace.case_id + '.patch'; box.append(link);
    }
    return box;
  }
  function renderDetail() {
    const detail = $('#detail'); detail.replaceChildren();
    const step = trace && trace.steps[selected];
    if (!step) return detail.append(el('p', 'placeholder', trace ? 'Choose a step in the timeline to see the evidence behind it.' : ''));
    detail.append(el('p', 'kicker', stepTitle(step)));
    if (step.kind === 'read') {
      detail.append(el('h3', '', step.path), el('p', '', step.limited ? 'The read limit for this attempt was reached, so the file was not sent.'
        : step.already_provided ? 'Nemotron asked for this file again. It was already in the conversation, so it was not sent twice.'
        : !step.found ? 'There is no such file in the app source.' : 'Nemotron chose to open this file to follow the code before deciding on a fix. Read-only: edits stay limited to the two booking files.'));
      return;
    }
    if (step.kind === 'search') {
      const pattern = el('h3'); pattern.append(el('code', '', '/' + step.query + '/'));
      detail.append(pattern, el('p', '', step.limited ? 'The lookup limit for this attempt was reached, so the search did not run.'
        : plural(step.matches, 'matching line') + (step.path ? ' in files whose path contains ' + step.path : ' across the app source') + '. Read-only: a regular expression over the code, to follow a value or an event before deciding on a fix.'));
      return;
    }
    if (step.kind === 'propose') {
      const edits = step.edits || [];
      detail.append(el('h3', '', 'Diagnosis'), el('blockquote', '', step.diagnosis));
      if (step.evidence_explained) detail.append(el('h3', '', 'Evidence it accounts for'), el('blockquote', '', step.evidence_explained));
      if (step.build_on_attempt) detail.append(el('p', '', 'Builds on attempt ' + step.build_on_attempt + (step.kept_edits ? ': keeps its ' + plural(step.kept_edits, 'edit') + ', then adds ' + (edits.length - step.kept_edits) + '.' : '.')));
      detail.append(el('h3', '', plural(edits.length, 'edit')));
      for (const edit of edits) detail.append(codeBlock(edit));
      if (step.usage) detail.append(el('p', 'micro', (step.usage.prompt_tokens || 0).toLocaleString() + ' input + ' + (step.usage.completion_tokens || 0).toLocaleString() + ' output tokens · ' + seconds(step.duration_ms)));
      return;
    }
    detail.append(el('h3', step.verified ? 'good' : 'bad', stepLine(step)));
    if (step.verified && trace.accepted && trace.accepted.attempt === step.attempt) detail.append(proofView());
    else detail.append(evidenceView(step));
    if (step.run_id) detail.append(el('p', 'micro', 'Isolated run ' + step.run_id + ' · ' + seconds(step.duration_ms)));
  }

  function renderFacts() {
    $('#finding').hidden = !(trace && caseId === 'keyboard-date' && trace.state !== 'verified' && trace.state !== 'running' && shown >= trace.steps.length);
  }
  // Totals across every recorded live run (web/agent-runs/summary.json).
  async function renderSummary() {
    try {
      const summary = await json('agent-runs/summary.json'), phone = summary.cases['customer-phone'], keyboard = summary.cases['keyboard-date'];
      if (phone) { $('#fact-phone').textContent = phone.first_attempt + ' / ' + phone.runs; $('#verdict-customer-phone').textContent = 'Fixed on the first attempt in ' + phone.first_attempt + ' of ' + phone.runs + ' runs'; }
      if (keyboard) {
        $('#fact-caught').textContent = String(keyboard.wrong_saves_caught); $('#why-caught').textContent = String(keyboard.wrong_saves_caught);
        $('#verdict-keyboard-date').textContent = 'Not fixed yet · ' + keyboard.wrong_saves_caught + ' false "booked" pages caught';
      }
      $('#fact-cost').textContent = money(summary.cost_usd); $('#fact-runs').textContent = String(summary.runs);
    } catch {}
    $('#fact-checks').textContent = String(CHECKS.length);
  }

  // Replay: Pause/Play, Show all and a click on any step all take over from the timer.
  function setControls() {
    const recorded = !!trace && !live, done = !trace || shown >= trace.steps.length;
    for (const id of ['#pause', '#show-all']) { $(id).hidden = !recorded; $(id).setAttribute('aria-disabled', String(done)); }
    $('#pause').textContent = playing ? 'Pause' : 'Play';
    $('#replay').hidden = !trace || !!live;
  }
  function refresh(pending) { renderTimeline(shown, pending); renderDetail(); renderStrip(caseId); renderFacts(); setControls(); }
  function pause(message) {
    if (!playing) return; playing = false; clearTimeout(timer); renderTimeline(shown, false); setControls();
    if (message) announce('Replay paused at step ' + shown + ' of ' + trace.steps.length + '.', true);
  }
  function play() {
    if (!trace || live || shown >= trace.steps.length) return;
    const pace = step => step.kind === 'propose' ? 1300 : 1700;
    const advance = () => {
      shown++; selected = shown - 1; const done = shown >= trace.steps.length; if (done) playing = false;
      refresh(!done); announce(stepHeadline(trace.steps[selected]) + (done ? ' ' + outcomeText() + '.' : ''));
      if (!done) timer = setTimeout(advance, 1100 + pace(trace.steps[shown]));
    };
    playing = true; clearTimeout(timer); renderTimeline(shown, true); setControls();
    timer = setTimeout(advance, pace(trace.steps[shown]));
  }
  function showAll(spoken) {
    if (!trace || live) return;
    clearTimeout(timer); playing = false; shown = trace.steps.length; selected = shown - 1; refresh(false);
    if (spoken) announce('Showing all ' + shown + ' steps. ' + outcomeText() + '.', true);
  }
  function replay() {
    clearTimeout(timer); if (!trace) return;
    live = null; playing = false; shown = 0; selected = -1; renderTimeline(0); renderDetail(); renderStrip(caseId);
    const started = new Date(trace.started_at_utc);
    $('#run-label').textContent = 'Recorded run · ' + started.toUTCString().slice(5, 16) + ', ' + started.toISOString().slice(11, 16) + ' UTC';
    if (reduced.matches) showAll(false); else play();
  }
  function choose(index) {
    pause(true); if (live) follow = false;
    selected = index; markSelected(); renderDetail(); renderStrip(caseId);
  }

  // Tabs: roving tabindex, arrows/Home/End move and select, one panel shows the selected case.
  function select(id) {
    for (const tab of tabs) { const on = tab.dataset.case === id; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; }
    $('#case-panel').setAttribute('aria-labelledby', 'tab-' + id);
    load(id);
  }
  function load(id) {
    caseId = id; clearTimeout(timer); hush(); live = null; playing = false; follow = true; selected = -1; shown = 0; trace = traces.get(id) || null;
    $('#timeline').replaceChildren(); renderDetail(); renderFacts(); for (const other of CASES) renderStrip(other);
    if (trace) { $('#goal').textContent = trace.goal; $('#empty').hidden = true; replay(); return setControls(); }
    $('#goal').textContent = id === 'keyboard-date' ? 'A keyboard-only customer books a 09:00 slot and it is saved for the right date.' : 'The phone number the customer typed is saved exactly.';
    $('#empty').hidden = false; $('#run-label').textContent = 'No recorded run'; setControls();
    $('#empty').textContent = status?.agent_ready ? 'No recorded run for this journey yet. Press Run live to start the agent.' : 'No recorded run for this journey yet. Run it locally with: node scripts/agent.cjs --case ' + id + ' --publish';
  }

  async function runLive() {
    const button = $('#run-live'); if (button.getAttribute('aria-disabled') === 'true') return;
    button.setAttribute('aria-disabled', 'true'); clearTimeout(timer); playing = false;
    const fail = error => { $('#empty').hidden = false; $('#empty').textContent = error.message; button.setAttribute('aria-disabled', 'false'); live = null; setControls(); };
    const poll = async () => {
      if (live !== trace.id) return;
      trace = await json('/api/agent/' + trace.id); traces.set(caseId, trace);
      const fresh = trace.steps.length > shown, running = trace.state === 'running'; shown = trace.steps.length;
      if (fresh && follow) selected = shown - 1;
      renderTimeline(shown, running); renderStrip(caseId); if (fresh && follow) renderDetail();
      if (fresh) announce(stepHeadline(trace.steps.at(-1)));
      if (running) { timer = setTimeout(() => poll().catch(fail), 2000); return; }
      live = null; button.setAttribute('aria-disabled', 'false'); renderTimeline(shown); renderFacts(); setControls(); announce(outcomeText() + '.');
    };
    try {
      trace = await json('/api/agent', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({case_id: caseId})});
      live = trace.id; follow = true; shown = 0; selected = -1; traces.set(caseId, trace); renderTimeline(0); renderDetail(); setControls();
      $('#run-label').textContent = 'Live run · Nemotron on Nebius Token Factory'; $('#empty').hidden = true; announce('Live run started.', true);
      await poll();
    } catch (error) { fail(error); }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { if (tab.dataset.case !== caseId || !trace) select(tab.dataset.case); });
    tab.addEventListener('keydown', event => {
      const next = {ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1}[event.key];
      if (next === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); const target = tabs[(next + tabs.length) % tabs.length]; target.focus();
      if (target.dataset.case !== caseId) select(target.dataset.case);
    });
  });
  $('#pause').addEventListener('click', () => { if ($('#pause').getAttribute('aria-disabled') === 'true') return; if (playing) pause(false); else play(); });
  $('#show-all').addEventListener('click', () => { if ($('#show-all').getAttribute('aria-disabled') !== 'true') showAll(true); });
  $('#detail').addEventListener('focusin', () => pause(true)); // never swap the evidence out from under a reader
  $('#replay').addEventListener('click', replay);
  $('#run-live').addEventListener('click', runLive);
  (async () => {
    // Only the local server (loopback only) can run the agent; static hosts skip the probe.
    if (['127.0.0.1', 'localhost'].includes(location.hostname)) try { status = await json('/api/status'); $('#run-live').hidden = !status.agent_ready; } catch { status = null; }
    if (wantedRun) {
      try { const run = await json('agent-runs/runs/' + wantedRun + '.json'); if (CASES.includes(run.case_id)) { traces.set(run.case_id, run); caseId = run.case_id; } }
      catch { $('#notice').hidden = false; $('#notice').textContent = 'Run ' + wantedRun + ' is not in the published index, so the latest run is shown instead.'; }
    }
    await Promise.all(CASES.filter(id => !traces.has(id)).map(id => json('agent-runs/' + id + '.json').then(run => traces.set(id, run), () => {})));
    select(caseId); renderSummary();
  })();
})();
