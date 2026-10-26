'use strict';
// Renders an AccessFinish agent trace as a timeline, replayed from a recorded
// run (?case=…&run=<id> picks any run in agent-runs/runs/) or followed live when
// the local server has a Nemotron key. A live run stays bound to its own case.
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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width: 900px)');
  const traces = new Map(), ranHere = new WeakSet(); // recorded runs per case; live runs once they have finished
  let caseId = CASES.includes(params.get('case')) ? params.get('case') : CASES[0];
  let trace = null, selected = -1, shown = 0, playing = false, timer = null, follow = true, status = null, patchUrl = null;
  let live = null, liveTimer = null, engaged = false, noticeCase = null; // live: {id, caseId, trace} while a run is in progress
  const following = () => !!live && live.caseId === caseId;

  async function json(url, options) {
    const response = await fetch(url, options); const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(value.error || 'Request failed'); return value;
  }

  function stepTitle(step) {
    if (step.kind === 'observe') return 'Run the journey on the original code';
    if (step.kind === 'propose') return 'Attempt ' + step.attempt + ' · Nemotron proposes a fix';
    if (step.kind === 'read') return 'Attempt ' + step.attempt + ' · Nemotron opens a source file';
    if (step.kind === 'search') return 'Attempt ' + step.attempt + ' · Nemotron searches the code';
    if (step.kind === 'verify') return 'Attempt ' + step.attempt + (step.run_id || step.verified ? ' · Verify in a fresh sandbox' : ' · Rejected before execution');
    return 'Attempt ' + step.attempt + ' · ' + step.kind;
  }
  function stepLine(step) {
    if (step.kind === 'propose') return step.diagnosis;
    if (step.kind === 'read') return step.path + (step.limited ? ' (read limit reached)' : step.already_provided ? ' (already provided)' : step.found ? '' : ' (not available)');
    if (step.kind === 'search') return '/' + step.query + '/' + (step.path ? ' in ' + step.path : '') + (step.limited ? ' (limit reached)' : step.error ? ' (did not run)' : ' · ' + step.matches + (step.matches === 1 ? ' match' : ' matches'));
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
  function outcomeText(run = trace) {
    if (run.state === 'verified') return 'Verified on attempt ' + run.accepted.attempt + ' · ' + seconds(run.duration_ms) + ' · ' + money(run.estimated_cost_usd);
    if (run.state === 'error') return 'Stopped: ' + run.error;
    const verifies = run.steps.filter(step => step.kind === 'verify');
    return 'Not verified after ' + plural(verifies.length, 'attempt') + ' — no patch accepted, ' + verifies.filter(step => step.stage === 'outcome').length + ' false "booked" pages caught';
  }

  // One live region, polite and throttled: only the newest headline is spoken. The replay that starts on
  // its own stays silent; step headlines are spoken once the reader has used the tabs, controls or steps.
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
    button.addEventListener('click', event => choose(index, event.detail > 0));
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
      const label = next ? stepTitle(next) : following() ? (trace.steps.length && trace.steps.at(-1).kind === 'propose' ? 'Building, booking and checking the database…' : 'Nemotron is reading the evidence…') : 'Working…';
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
    const run = live?.caseId === id ? live.trace : traces.get(id), strip = $('#strip-' + id); if (!strip) return;
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
    const box = el('div', 'edit'); box.append(el('div', 'file', typeof edit?.path === 'string' ? edit.path : '(no path)'));
    // Model edits are recorded before they are validated; a malformed one is shown as it came.
    if (typeof edit?.old !== 'string' || typeof edit.new !== 'string') {
      box.append(el('p', 'malformed', 'Malformed edit: it needs text for both "old" and "new". Shown as recorded:'), el('pre', '', String(JSON.stringify(edit, null, 2))));
      return box;
    }
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
      let differs = false;
      for (const [label, a, b] of [['Appointment', expected.start, saved.appointments?.[0]?.start], ['Phone', typed.phone_number, customer.phone_number], ['Email', typed.email, customer.email]]) {
        if (!a && !b) continue;
        differs = differs || a !== b;
        const row = el('tr', a === b ? '' : 'mismatch'), savedCell = el('td', '', b || '—');
        if (a !== b) savedCell.append(el('span', 'sr-only', ' (does not match)'));
        row.append(header(label, 'row'), el('td', '', a || '—'), savedCell); body.append(row);
      }
      wrap.append(el('p', '', differs ? 'The confirmation page appeared. Reading the database tells a different story:' : 'The confirmation page appeared and the database row is right:'), table);
      // The reopen check: the booking link opened in a fresh browser, before and after Next on step 1.
      const reopen = evidence.reopen;
      if (reopen && !differs) wrap.append(el('p', '', 'Then the booking link was opened in a fresh browser, as the customer would to check or change it:'),
        facts([['Date field when the link opened', reopen.date_field_when_the_booking_link_opened], ['After pressing Next on step 1', reopen.date_field_after_pressing_next_on_step_1],
          ['Date the customer sees', reopen.date_shown_after_reopening]]));
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
      if (evidence.code_around_error) { const frame = el('pre', 'log'); frame.textContent = evidence.code_around_error; wrap.append(el('p', 'micro', 'The patched code around the error, as sent back to Nemotron:'), frame); }
      // Where a copied anchor stopped matching the file, as Nemotron was told.
      for (const anchor of (evidence.anchors || []).filter(item => item?.found_in_read_only_file)) wrap.append(facts([['Edit ' + (anchor.your_edit || anchor.edit) + ' targets read-only code', anchor.found_in_read_only_file]]));
      for (const anchor of (evidence.anchors || []).filter(item => item?.first_mismatch)) {
        const miss = anchor.first_mismatch;
        const which = anchor.your_edit ? 'Edit ' + anchor.your_edit : anchor.kept_from_attempt ? 'Edit kept from attempt ' + anchor.kept_from_attempt : 'Edit ' + anchor.edit;
        const lines = el('pre', 'log'); lines.textContent = 'Nemotron wrote: ' + miss.your_line + '\nThe file has:   ' + miss.original_line;
        wrap.append(el('p', 'micro', which + ', line ' + miss.old_line_number + ' of its anchor' + (miss.your_line !== miss.original_line && miss.your_line.trim() === miss.original_line.trim() ? ' (differs only in indentation)' : '') + ':'), lines);
        if (anchor.the_file_has?.text) { const lines = el('pre', 'log'); lines.textContent = anchor.the_file_has.text; wrap.append(el('p', 'micro', 'The file\'s own lines from line ' + anchor.the_file_has.from_line + ', sent back to copy exactly:'), lines); }
        if (miss.your_line === miss.original_line) wrap.append(el('p', 'micro', 'These look the same because this report, from agent version ' + (trace.agent_version || 1)
          + ', compared the start of lines, so a line such as "}" matched "},". Version 3 compares whole lines and points to the real difference.'));
      }
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
        : step.error ? 'The search did not run: ' + (step.error === 'timeout' ? 'the pattern took too long to match.' : 'the pattern is not a valid regular expression.') + ' Nemotron was told so.'
        : plural(step.matches, 'matching line') + (step.path ? ' in files whose path contains ' + step.path : ' across the app source') + '. Read-only: a regular expression over the code, to follow a value or an event before deciding on a fix.'));
      return;
    }
    if (step.kind === 'propose') {
      const edits = Array.isArray(step.edits) ? step.edits : [];
      detail.append(el('h3', '', 'Diagnosis'), el('blockquote', '', step.diagnosis));
      if (step.evidence_explained) detail.append(el('h3', '', 'Evidence it accounts for'), el('blockquote', '', step.evidence_explained));
      if (step.build_on_attempt) detail.append(el('p', '', 'Builds on attempt ' + step.build_on_attempt + (step.kept_edits ? ': keeps its ' + plural(step.kept_edits, 'edit') + ', then adds ' + (edits.length - step.kept_edits) + '.' : '.')));
      detail.append(el('h3', '', plural(edits.length, 'edit')));
      for (const edit of edits) detail.append(codeBlock(edit));
      // Anything the harness changed before the verifier ran, as Nemotron was told.
      // Edits are shown as the verifier applied them; Nemotron's own text stays in the trace (proposed_edits).
      for (const item of Array.isArray(step.adjustments) ? step.adjustments : []) detail.append(el('p', 'micro', 'Harness: ' + (item.your_edit ? 'Nemotron\'s edit ' + item.your_edit
        : item.kept_from_attempt ? 'the edit kept from attempt ' + item.kept_from_attempt : 'edit ' + item.edit) + ' — ' + (item.dropped ? 'dropped, ' + item.dropped : item.moved || item.anchored) + '.'));
      if (typeof step.reasoning === 'string' && step.reasoning) {
        const box = el('details', 'reasoning'); box.append(el('summary', '', 'Nemotron\'s reasoning'), el('p', '', step.reasoning)); detail.append(box);
      }
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
      if (phone) {
        $('#fact-phone').textContent = phone.verified + ' / ' + phone.runs;
        $('#verdict-customer-phone').textContent = 'Verified in ' + phone.verified + ' of ' + phone.runs + ' runs, ' + phone.first_attempt + ' on the first attempt';
      }
      if (keyboard) {
        // Keyboard results from the first agent version that verified the case onwards (earlier versions never did).
        const caught = keyboard.false_booked_caught ?? keyboard.wrong_saves_caught;
        const versions = Object.entries(summary.agent_versions || {}).map(([version, data]) => ({version: Number(version), ...(data.cases['keyboard-date'] || {})})).sort((a, b) => a.version - b.version);
        const since = versions.filter(item => item.version >= (versions.find(item => item.verified > 0)?.version ?? Infinity));
        const fixed = since.reduce((sum, item) => sum + (item.verified || 0), 0), tried = since.reduce((sum, item) => sum + (item.runs || 0), 0);
        const span = since.length ? 'agent v' + since[0].version + (since.length > 1 ? '–v' + since.at(-1).version : '') : '';
        $('#fact-caught').textContent = String(caught); $('#why-caught').textContent = String(caught);
        $('#verdict-keyboard-date').textContent = (fixed ? 'Fixed by Nemotron in ' + fixed + ' of ' + tried + ' runs (' + span + ')' : 'Not fixed yet') + ' · ' + caught + ' false "booked" pages caught';
        $('#verdict-keyboard-date').classList.toggle('good', fixed > 0); $('#verdict-keyboard-date').classList.toggle('caught', !fixed);
        $('#fact-keyboard').textContent = fixed ? fixed + ' / ' + tried : '0';
        $('#fact-keyboard-label').textContent = fixed ? 'keyboard runs fixed by Nemotron, no diagnosis supplied (' + span + ')' : 'keyboard runs fixed so far';
      }
      $('#fact-cost').textContent = money(summary.cost_usd); $('#fact-runs').textContent = String(summary.runs);
    } catch {}
  }

  // Replay: Pause/Play, Show all and a click on any step all take over from the timer.
  function setControls() {
    const here = following(), recorded = !!trace && !here, done = !trace || shown >= trace.steps.length;
    for (const id of ['#pause', '#show-all']) { $(id).hidden = !recorded; $(id).setAttribute('aria-disabled', String(done)); }
    $('#pause').textContent = playing ? 'Pause' : 'Play';
    $('#replay').hidden = !trace || here;
    $('#follow').hidden = !here; $('#follow').setAttribute('aria-pressed', String(follow));
  }
  function refresh(pending) { renderTimeline(shown, pending); renderDetail(); renderStrip(caseId); renderFacts(); setControls(); }
  function pause(message) {
    if (!playing) return; playing = false; clearTimeout(timer); renderTimeline(shown, false); setControls();
    if (message) announce('Replay paused at step ' + shown + ' of ' + trace.steps.length + '.', true);
  }
  function play() {
    if (!trace || following() || shown >= trace.steps.length) return;
    const pace = step => step.kind === 'propose' ? 1300 : 1700;
    const advance = () => {
      shown++; selected = shown - 1; const done = shown >= trace.steps.length; if (done) playing = false;
      refresh(!done); if (engaged) announce(stepHeadline(trace.steps[selected]) + (done ? ' ' + outcomeText() + '.' : ''));
      if (!done) timer = setTimeout(advance, 1100 + pace(trace.steps[shown]));
    };
    playing = true; clearTimeout(timer); renderTimeline(shown, true); setControls();
    timer = setTimeout(advance, pace(trace.steps[shown]));
  }
  function showAll(spoken) {
    if (!trace || following()) return;
    clearTimeout(timer); playing = false; shown = trace.steps.length; selected = shown - 1; refresh(false);
    if (spoken) announce('Showing all ' + shown + ' steps. ' + outcomeText() + '.', true);
  }
  function replay() {
    clearTimeout(timer); if (!trace || following()) return;
    playing = false; shown = 0; selected = -1; renderTimeline(0); renderDetail(); renderStrip(caseId);
    const started = new Date(trace.started_at_utc);
    $('#run-label').textContent = (ranHere.has(trace) ? 'Live run from this visit · ' : 'Recorded run · ') + started.toUTCString().slice(5, 16) + ', ' + started.toISOString().slice(11, 16) + ' UTC';
    if (reduced.matches) showAll(false); else play();
  }
  function choose(index, pointer) {
    engaged = true; pause(true); if (following()) follow = false;
    selected = index; markSelected(); renderDetail(); renderStrip(caseId); setControls();
    // In one column the evidence sits below the whole timeline: bring it into view after a tap, leaving focus on the
    // step; after Enter or Space, move focus to it so keyboard users land on what they chose (Shift+Tab goes back).
    const top = $('#detail').getBoundingClientRect().top;
    if (narrow.matches && !pointer) $('#detail').focus();
    else if (pointer && narrow.matches && (top < 0 || top > innerHeight * 0.75)) $('#detail').scrollIntoView({block: 'start', behavior: reduced.matches ? 'auto' : 'smooth'});
  }
  function notify(text, id) { noticeCase = id; $('#notice').textContent = text; $('#notice').hidden = id !== caseId; }

  // Tabs: roving tabindex, arrows/Home/End move and select, one panel shows the selected case.
  function select(id) {
    for (const tab of tabs) { const on = tab.dataset.case === id; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; }
    $('#case-panel').setAttribute('aria-labelledby', 'name-' + id);
    load(id);
  }
  function load(id) {
    caseId = id; clearTimeout(timer); hush(); playing = false; follow = true; selected = -1; shown = 0; trace = following() ? live.trace : traces.get(id) || null;
    $('#notice').hidden = id !== noticeCase;
    $('#timeline').replaceChildren(); renderDetail(); renderFacts(); for (const other of CASES) renderStrip(other);
    if (following()) { $('#goal').textContent = trace.goal; $('#empty').hidden = true; $('#run-label').textContent = LIVE; return showLive(); }
    if (trace) { $('#goal').textContent = trace.goal; $('#empty').hidden = true; replay(); return setControls(); }
    $('#goal').textContent = id === 'keyboard-date' ? 'A keyboard-only customer books a 09:00 slot and it is saved for the right date.' : 'The phone number the customer typed is saved exactly.';
    $('#empty').hidden = false; $('#run-label').textContent = 'No recorded run'; setControls();
    $('#empty').textContent = status?.agent_ready ? 'No recorded run for this journey yet. Press Run live to start the agent.' : 'No recorded run for this journey yet. Run it locally with: node scripts/agent.cjs --case ' + id + ' --publish';
  }

  // Live: the run belongs to the case it was started on. Other tabs keep their recorded runs while it goes on,
  // and coming back to its tab resumes following it.
  const LIVE = 'Live run · Nemotron on Nebius Token Factory';
  function showLive() {
    const run = live.trace, fresh = run.steps.length > shown; trace = run; shown = run.steps.length;
    if (fresh && follow) selected = shown - 1;
    renderTimeline(shown, run.state === 'running'); if (fresh && follow) renderDetail(); renderStrip(caseId); renderFacts(); setControls();
    return fresh;
  }
  async function runLive() {
    const button = $('#run-live'), runCase = caseId; if (button.getAttribute('aria-disabled') === 'true') return;
    engaged = true; button.setAttribute('aria-disabled', 'true'); pause(false);
    const fail = error => {
      const started = !!live; clearTimeout(liveTimer); live = null; button.setAttribute('aria-disabled', 'false');
      notify((started ? 'The live run could not be followed: ' : 'The live run did not start: ') + error.message, runCase);
      if (caseId === runCase) { if (started) load(runCase); else setControls(); }
      announce($('#notice').textContent, true); // after load(), which hushes the announcer
    };
    const poll = async () => {
      const run = await json('/api/agent/' + live.id); live.trace = run;
      if (following()) { if (showLive()) announce(stepHeadline(run.steps.at(-1))); } else renderStrip(runCase);
      if (run.state === 'running') { liveTimer = setTimeout(() => poll().catch(fail), 2000); return; }
      live = null; ranHere.add(run); traces.set(runCase, run); button.setAttribute('aria-disabled', 'false');
      if (caseId === runCase) { renderTimeline(shown); renderFacts(); setControls(); announce(outcomeText(run) + '.'); }
      else { renderStrip(runCase); announce('The live run on "' + $('#name-' + runCase).textContent + '" finished. ' + outcomeText(run) + '.'); }
    };
    try {
      const run = await json('/api/agent', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({case_id: runCase})});
      live = {id: run.id, caseId: runCase, trace: run};
      if (caseId === runCase) { follow = true; shown = 0; selected = -1; $('#timeline').replaceChildren(); renderDetail(); showLive(); $('#run-label').textContent = LIVE; $('#empty').hidden = true; }
      announce('Live run started.', true);
      await poll();
    } catch (error) { fail(error); }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { engaged = true; if (tab.dataset.case !== caseId || !trace) select(tab.dataset.case); });
    tab.addEventListener('keydown', event => {
      const next = {ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1}[event.key];
      if (next === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); engaged = true; const target = tabs[(next + tabs.length) % tabs.length]; target.focus();
      if (target.dataset.case !== caseId) select(target.dataset.case);
    });
  });
  $('#pause').addEventListener('click', () => { if ($('#pause').getAttribute('aria-disabled') === 'true') return; engaged = true; if (playing) pause(false); else play(); });
  $('#show-all').addEventListener('click', () => { if ($('#show-all').getAttribute('aria-disabled') !== 'true') { engaged = true; showAll(true); } });
  // Never swap the evidence out from under a reader: focus in it pauses the replay, or stops following a live run.
  $('#detail').addEventListener('focusin', () => { if (!following()) return pause(true); follow = false; setControls(); });
  $('#follow').addEventListener('click', () => {
    follow = !follow; if (follow && shown) { selected = shown - 1; markSelected(); renderDetail(); renderStrip(caseId); }
    setControls();
  });
  $('#replay').addEventListener('click', () => { engaged = true; replay(); });
  $('#run-live').addEventListener('click', runLive);
  (async () => {
    // Only the local server (loopback only) can run the agent; static hosts skip the probe.
    if (['127.0.0.1', 'localhost'].includes(location.hostname)) try { status = await json('/api/status'); $('#run-live').hidden = !status.agent_ready; } catch { status = null; }
    if (wantedRun) {
      try { const run = await json('agent-runs/runs/' + wantedRun + '.json'); if (CASES.includes(run.case_id)) { traces.set(run.case_id, run); caseId = run.case_id; } }
      catch { notify('Run ' + wantedRun + ' is not in the published index, so the featured run is shown instead.', caseId); }
    }
    await Promise.all(CASES.filter(id => !traces.has(id)).map(id => json('agent-runs/' + id + '.json').then(run => traces.set(id, run), () => {})));
    select(caseId); renderSummary();
  })();
})();
