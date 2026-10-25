'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {runAgent, explain, nemotron} = require('../lib/agent.cjs');
const featured = require('../web/featured-case.json').proposal;

const scenario = {date: '2026-11-02', customer: {first_name: 'Synthetic', last_name: 'Agent', email: 'agent@example.invalid', phone_number: '0000000042'}};
const stuck = {original_source_control: true, scenario, build: {status: 'TRUSTED_BUILD_PASS'},
  keyboard: {workflow: {status: 'unresolved', reason: 'booking_expected_ui_not_observed'}, last_observation: {focus: {tag: 'BODY'}, inputs: [{id: 'select-timezone'}], body: 'Appointment Date & Time'},
    keyboard_actions: [{command: 'press', key: 'Tab', focus: {tag: 'SELECT', id: 'select-service'}}]}};
const buildFailure = {scenario, applied_source: {}, error: 'Docker operation failed: SyntaxError: /app/assets/js/pages/booking.js: Unexpected token (12:3)\n    at parse'};
const wrongPhone = {scenario, applied_source: {}, build: {status: 'TRUSTED_BUILD_PASS'}, keyboard: {workflow: {status: 'confirmation_observed'}},
  before: {appointments: [], customers: []}, after: {appointments: [{id: '1', start_datetime: '2026-11-02 09:00:00'}], customers: [{id: '1', phone_number: '0000000000'}]},
  evaluation: {pass: false, reasons: ['wrong_customer_fields']}};
const verified = {scenario, applied_source: {}, booking_verified: true, booking: {start_datetime: '2026-11-02 09:00:00', hash: 'abc'},
  before: {appointments: [], customers: []}, after: {appointments: [], customers: [{id: '1', first_name: 'Synthetic', phone_number: '0000000042'}]}, boundaries_verified: true};

test('explain turns verifier manifests into honest headlines', () => {
  assert.equal(explain(stuck).headline, 'Keyboard user got stuck at the date step: there is no date field to Tab to');
  assert.equal(explain(buildFailure).headline, 'Build failed: SyntaxError: /app/assets/js/pages/booking.js: Unexpected token (12:3)');
  assert.equal(explain(wrongPhone).headline, 'Confirmation shown, but phone saved as 0000000000 instead of 0000000042');
  assert.equal(explain(verified).verified, true);
});

test('the agent feeds verifier evidence back until the outcome is verified', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  const outcomes = [stuck, buildFailure, wrongPhone, verified], seen = [];
  const execute = async ({run, original}) => { const next = outcomes.shift(); assert.equal(original, next === stuck); return {...next, run_id: run.id}; };
  const model = async messages => {
    seen.push(messages.length);
    return {message: {content: null}, call: {id: 'call-' + seen.length, function: {name: 'propose_repair', arguments: '{}'}},
      proposal: {diagnosis: 'Attempt ' + seen.length, edits: featured.edits}, usage: {prompt_tokens: 1000, completion_tokens: 100}, cost: 0.0004};
  };
  const trace = await runAgent({case_id: 'keyboard-date', execute, model, root});
  assert.equal(trace.state, 'verified');
  assert.equal(trace.accepted.attempt, 3);
  assert.deepEqual(trace.steps.map(step => step.kind), ['observe', 'propose', 'verify', 'propose', 'verify', 'propose', 'verify']);
  assert.deepEqual(seen, [2, 4, 6], 'each retry carries the previous proposal and the verifier evidence');
  assert.equal(trace.steps[4].stage, 'outcome');
  assert.ok(Math.abs(trace.estimated_cost_usd - 0.0012) < 1e-12);
  assert.ok(fs.existsSync(path.join(root, 'agent', trace.id + '.json')));
});

test('the agent stops after the attempt limit without claiming success', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  const execute = async ({run, original}) => ({...(original ? stuck : wrongPhone), run_id: run.id});
  const model = async () => ({message: {content: null}, call: {id: 'c', function: {name: 'propose_repair', arguments: '{}'}},
    proposal: {diagnosis: 'd', edits: featured.edits}, usage: {}, cost: 0});
  const trace = await runAgent({execute, model, root, maxAttempts: 2});
  assert.equal(trace.state, 'not_verified'); assert.equal(trace.accepted, undefined);
});

test('an edit whose anchor is missing is rejected before execution', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  let executions = 0;
  const execute = async ({run}) => { executions++; return {...stuck, run_id: run.id}; };
  const model = async () => ({message: {content: null}, call: {id: 'c', function: {name: 'propose_repair', arguments: '{}'}},
    proposal: {diagnosis: 'd', edits: [{path: 'assets/js/pages/booking.js', old: 'no such text anywhere', new: 'x'}]}, usage: {}, cost: 0});
  const trace = await runAgent({execute, model, root, maxAttempts: 1});
  assert.equal(executions, 1); assert.equal(trace.steps.at(-1).stage, 'apply');
});

test('a malformed model answer becomes a failed attempt with feedback', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  const execute = async ({run, original}) => ({...(original ? stuck : verified), run_id: run.id});
  let calls = 0;
  const model = async messages => {
    if (++calls === 1) throw Object.assign(Error('Nemotron returned arguments that are not valid JSON.'), {malformed: true, usage: {prompt_tokens: 10}, cost: 0.001});
    assert.match(messages.at(-1).content, /rejected/);
    return {message: {content: null}, call: {id: 'c', function: {name: 'propose_repair', arguments: '{}'}}, proposal: {diagnosis: 'd', edits: featured.edits}, usage: {}, cost: 0};
  };
  const trace = await runAgent({execute, model, root});
  assert.equal(trace.state, 'verified'); assert.equal(trace.accepted.attempt, 2); assert.equal(trace.steps[1].stage, 'format');
});

test('rejection feedback remembers the attempt that got furthest', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  const outcomes = [stuck, wrongPhone, buildFailure, verified], feedback = [];
  const execute = async ({run}) => ({...outcomes.shift(), run_id: run.id});
  const model = async messages => {
    if (messages.at(-1).role === 'tool') feedback.push(JSON.parse(messages.at(-1).content));
    return {message: {content: null}, call: {id: 'c' + feedback.length, function: {name: 'propose_repair', arguments: '{}'}}, proposal: {diagnosis: 'd', edits: featured.edits}, usage: {}, cost: 0};
  };
  const trace = await runAgent({execute, model, root});
  assert.equal(trace.state, 'verified');
  assert.equal(feedback[0].best_attempt_so_far, 'this one');
  assert.equal(feedback[1].best_attempt_so_far.attempt, 1);
  assert.equal(feedback[1].best_attempt_so_far.got_as_far_as, 'outcome');
});

test('temporary provider errors are retried, other errors are not', async () => {
  let calls = 0;
  const reply = {choices: [{message: {tool_calls: [{id: 'c', function: {name: 'propose_repair', arguments: JSON.stringify({diagnosis: 'd', evidence_explained: 'e', edits: []})}}]}}], usage: {prompt_tokens: 1, completion_tokens: 1}};
  const flaky = async () => ++calls < 3 ? {ok: false, status: 503, text: async () => 'busy'} : {ok: true, status: 200, text: async () => JSON.stringify(reply)};
  const answer = await nemotron([], {key: 'k', fetchImpl: flaky, retryDelay: 1});
  assert.equal(calls, 3); assert.equal(answer.proposal.diagnosis, 'd');
  calls = 0;
  await assert.rejects(nemotron([], {key: 'k', retryDelay: 1, fetchImpl: async () => { calls++; return {ok: false, status: 401, text: async () => 'no'}; }}), /HTTP 401/);
  assert.equal(calls, 1);
});

test('outcome evidence interleaves date changes with page requests, and anchors are explained', async () => {
  const keyboard = {workflow: {status: 'confirmation_observed'}, page_requests: [{at: 1500, method: 'POST', path: '/booking/get_unavailable_dates'}],
    keyboard_actions: [{command: 'type', text: '02/11/2026', at: 1000, date_value: '02/11/2026'}, {command: 'inspect', at: 2000, date_value: '01/11/2026'}]};
  const evidence = explain({...wrongPhone, keyboard}).evidence;
  assert.deepEqual(evidence.timeline_after_typing_date.map(item => item.t), ['+0.0s', '+0.5s', '+1.0s']);
  assert.match(evidence.timeline_after_typing_date[2].event, /no key pressed .* "01\/11\/2026"/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  const model = async () => ({message: {content: null}, call: {id: 'c', function: {name: 'propose_repair', arguments: '{}'}},
    proposal: {diagnosis: 'd', edits: [{path: 'assets/js/pages/booking.js', old: 'zz-no-such-anchor-zz', new: 'x'}]}, usage: {}, cost: 0});
  const trace = await runAgent({execute: async ({run}) => ({...stuck, run_id: run.id}), model, root, maxAttempts: 1});
  assert.equal(trace.steps.at(-1).evidence.anchors[0].occurrences_in_original, 0);
});

test('a near-miss anchor reports the first line that differs from the original', () => {
  const {anchorReport} = require('../lib/agent.cjs');
  const files = [{path: 'assets/js/pages/booking.js', content: 'one\ntwo\nthree\n'}];
  const [report] = anchorReport(files, [{path: 'assets/js/pages/booking.js', old: 'one\ntwo\nTHREE', new: 'x'}]);
  assert.equal(report.occurrences_in_original, 0);
  assert.deepEqual(report.first_mismatch, {old_line_number: 3, your_line: 'THREE', original_line: 'three'});
});

test('the agent can read other source files before proposing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  const outcomes = [stuck, verified], seen = [];
  const execute = async ({run}) => ({...outcomes.shift(), run_id: run.id});
  let call = 0;
  const model = async messages => {
    seen.push(messages.at(-1));
    if (++call === 1) {
      assert.ok(JSON.parse(messages[1].content).other_source_files.includes('assets/js/http/booking_http_client.js'));
      return {message: {content: null}, call: {id: 'r1', function: {name: 'read_file', arguments: '{}'}}, read: 'assets/js/http/booking_http_client.js', usage: {}, cost: 0};
    }
    return {message: {content: null}, call: {id: 'p', function: {name: 'propose_repair', arguments: '{}'}}, proposal: {diagnosis: 'd', edits: featured.edits}, usage: {}, cost: 0};
  };
  const trace = await runAgent({execute, model, root});
  assert.equal(trace.state, 'verified');
  assert.deepEqual(trace.steps.map(step => step.kind), ['observe', 'read', 'propose', 'verify']);
  assert.match(seen[1].content, /getUnavailableDates/);
});

// Edits with anchors that occur exactly once in the original booking.js, for merge tests.
const {caseDefinition} = require('../lib/cases.cjs');
const bookingJs = caseDefinition('keyboard-date').files[0].content;
const anchors = [...new Set(bookingJs.split('\n').map(line => line.trim()))].filter(line => line.length > 30 && bookingJs.split(line).length === 2);
const edit = n => ({path: 'assets/js/pages/booking.js', old: anchors[n], new: anchors[n] + ' // ' + n});
const wrongDate = {...wrongPhone, after: {appointments: [{id: '1', start_datetime: '2026-11-01 09:00:00'}], customers: [{id: '1', phone_number: '0000000042'}]},
  evaluation: {pass: false, reasons: ['wrong_start_datetime']}};
const answer = (id, proposal) => ({message: {content: null}, call: {id, function: {name: 'propose_repair', arguments: '{}'}}, proposal: {evidence_explained: 'e', ...proposal}, usage: {}, cost: 0});
const lastFeedback = messages => messages.at(-1).role === 'tool' ? JSON.parse(messages.at(-1).content) : null;

test('search_code returns path:line hits across the app, bounded and time-limited', () => {
  const {searchCode} = require('../lib/agent.cjs'), files = caseDefinition('keyboard-date').files;
  const hit = searchCode({pattern: 'function getUnavailableDates\\('}, files);
  assert.equal(hit.matches, 1);
  assert.match(hit.text, /^assets\/js\/http\/booking_http_client\.js:\d+: function getUnavailableDates\(/);
  assert.match(searchCode({pattern: 'SELECT-DATE', ignore_case: true, path: 'pages/booking.js'}, files).text, /^assets\/js\/pages\/booking\.js:\d+: /);
  const many = searchCode({pattern: '\\.'}, files);
  assert.equal(many.text.split('\n').length, 31); assert.match(many.text.split('\n').at(-1), /more matching lines/);
  const invalid = searchCode({pattern: '('}, files);
  assert.match(invalid.text, /Invalid regular expression/); assert.equal(invalid.error, 'invalid_pattern'); assert.equal(invalid.matches, undefined);
  assert.deepEqual(searchCode({pattern: 'zz-no-such-text-zz'}, files), {matches: 0, text: 'No matches.'});
  // The sources use CRLF line endings: a pattern anchored at the end of a line still matches.
  assert.ok(files[0].content.includes('\r\n'));
  assert.equal(searchCode({pattern: 'onMonthChange: \\(selectedDates, dateStr, instance\\) => \\{$'}, files).matches, 1);
  assert.equal(searchCode({pattern: 'function getUnavailableDates\\(.*\\{$'}, files).matches, 1);
  const started = Date.now(), slow = searchCode({pattern: '^(a+)+$'}, [{path: 'x.js', content: 'a'.repeat(34) + 'b'}], {timeout: 200});
  assert.match(slow.text, /took too long/); assert.equal(slow.error, 'timeout');
  assert.ok(Date.now() - started < 5000);
});

test('lookups: search_code and read_file are answered, editable files and re-reads get a short note', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-')), outcomes = [stuck, verified], replies = [];
  const lookups = [{search: {pattern: 'function getUnavailableDates'}}, {read: 'assets/js/pages/booking.js'}, {read: 'assets/js/utils/ui.js'}, {read: 'assets/js/utils/ui.js'}, {search: {pattern: '('}}];
  const model = async messages => {
    if (messages.at(-1).role === 'tool') replies.push(messages.at(-1).content);
    const next = lookups.shift();
    return next ? {message: {content: null}, call: {id: 'l' + lookups.length, function: {name: next.search ? 'search_code' : 'read_file', arguments: '{}'}}, ...next, usage: {}, cost: 0}
      : answer('p', {diagnosis: 'd', edits: featured.edits});
  };
  const trace = await runAgent({execute: async ({run}) => ({...outcomes.shift(), run_id: run.id}), model, root});
  assert.equal(trace.state, 'verified');
  assert.deepEqual(trace.steps.map(step => step.kind), ['observe', 'search', 'read', 'read', 'read', 'search', 'propose', 'verify']);
  assert.equal(trace.steps[1].query, 'function getUnavailableDates'); assert.equal(trace.steps[1].matches, 1);
  assert.match(replies[0], /booking_http_client\.js:\d+: function getUnavailableDates/);
  assert.match(replies[1], /already have the complete original/); assert.equal(trace.steps[2].already_provided, true);
  assert.match(replies[2], /window\.App\.Utils\.UI/);
  assert.match(replies[3], /Already returned in attempt 1/); assert.equal(trace.steps[4].already_provided, true);
  assert.match(replies[4], /Invalid regular expression/);
  assert.deepEqual([trace.steps[5].error, 'matches' in trace.steps[5]], ['invalid_pattern', false], 'a search that did not run records no match count');
});

test('build_on_attempt keeps an earlier attempt\'s edits, drops duplicates, and is recorded', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-')), outcomes = [stuck, wrongDate, verified], executed = [];
  const execute = async ({run, proposal, original}) => { if (!original) executed.push(proposal.proposal.edits); return {...outcomes.shift(), run_id: run.id}; };
  const proposals = [{diagnosis: 'first', edits: [edit(0), edit(1)]}, {diagnosis: 'second', evidence_explained: 'the saved start', build_on_attempt: 1, edits: [edit(1), edit(2)]}];
  const trace = await runAgent({execute, model: async () => answer('c', proposals.shift()), root});
  assert.equal(trace.state, 'verified');
  assert.deepEqual(executed[1], [edit(0), edit(1), edit(2)]);
  const propose = trace.steps.filter(step => step.kind === 'propose')[1];
  assert.equal(propose.build_on_attempt, 1); assert.equal(propose.kept_edits, 2); assert.equal(propose.evidence_explained, 'the saved start');
  assert.equal(trace.accepted.build_on_attempt, 1); assert.deepEqual(trace.accepted.proposal.edits, executed[1]);
});

test('build_on_attempt is rejected before execution when it exceeds the edit cap or names no usable attempt', async () => {
  const {MAX_EDITS} = require('../lib/agent.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-')), feedback = [];
  let executions = 0;
  const execute = async ({run, original}) => { executions++; return {...(original ? stuck : wrongDate), run_id: run.id}; };
  const proposals = [{diagnosis: 'five', edits: [0, 1, 2, 3, 4].map(edit)}, {diagnosis: 'too many', build_on_attempt: 1, edits: [edit(5), edit(6)]},
    {diagnosis: 'unknown base', build_on_attempt: 7, edits: [edit(5)]}];
  const model = async messages => { feedback.push(lastFeedback(messages)); return answer('c' + feedback.length, proposals.shift()); };
  const trace = await runAgent({execute, model, root, maxAttempts: 3});
  assert.equal(executions, 2, 'only the original and attempt 1 ran in the fixture');
  const verifies = trace.steps.filter(step => step.kind === 'verify');
  assert.deepEqual(verifies.map(step => step.stage), ['outcome', 'format', 'format']);
  assert.match(verifies[1].headline, new RegExp('5 edits and yours bring the proposal to 7, but the verifier accepts at most ' + MAX_EDITS));
  assert.match(verifies[2].headline, /build_on_attempt 7 is not an earlier attempt .*those are: 1/);
  assert.equal(feedback[2].verifier_evidence.stage, 'format');
  assert.equal(feedback[2].best_attempt_so_far.attempt, 1, 'a rejected merge never becomes the best attempt');
});

test('build_on_attempt sent as a numeric string is read as that attempt; anything else is rejected as such', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-')), executed = [];
  const execute = async ({run, proposal, original}) => { if (!original) executed.push(proposal.proposal.edits); return {...(original ? stuck : wrongDate), run_id: run.id}; };
  const proposals = [{diagnosis: 'first', edits: [edit(0)]}, {diagnosis: 'string', build_on_attempt: '1', edits: [edit(1)]}, {diagnosis: 'word', build_on_attempt: 'one', edits: [edit(2)]}];
  const trace = await runAgent({execute, model: async () => answer('c', proposals.shift()), root, maxAttempts: 3});
  assert.deepEqual(executed[1], [edit(0), edit(1)]);
  const [, second, third] = trace.steps.filter(step => step.kind === 'propose');
  assert.equal(second.build_on_attempt, 1); assert.equal(second.kept_edits, 1); assert.equal(third.build_on_attempt, 'one');
  assert.equal(trace.steps.at(-1).headline, 'Rejected before execution: build_on_attempt must be the number of an earlier attempt, not "one".');
});

test('an edit that is not an object is rejected: by the model client as malformed, by the loop at the apply stage', async () => {
  const reply = args => async () => ({ok: true, status: 200, text: async () => JSON.stringify({choices: [{message: {tool_calls: [{id: 'c', function: {name: 'propose_repair', arguments: JSON.stringify(args)}}]}}], usage: {}})});
  await assert.rejects(nemotron([], {key: 'k', fetchImpl: reply({diagnosis: 'd', evidence_explained: 'e', edits: [featured.edits[0], null]})}), error => error.malformed && /Every edit must be an object/.test(error.message));
  await assert.rejects(nemotron([], {key: 'k', fetchImpl: reply({diagnosis: 'd', evidence_explained: 'e', edits: [{path: 'assets/js/pages/booking.js', old: 5, new: 'x'}]})}), error => error.malformed);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  const trace = await runAgent({execute: async ({run}) => ({...stuck, run_id: run.id}), model: async () => answer('c', {diagnosis: 'd', edits: [featured.edits[0], null]}), root, maxAttempts: 1});
  assert.equal(trace.state, 'not_verified'); assert.equal(trace.steps.at(-1).stage, 'apply');
  assert.deepEqual(trace.steps.at(-1).evidence.anchors.map(anchor => anchor.occurrences_in_original), [1, 0]);
  assert.match(trace.steps.at(-1).evidence.anchors[1].invalid, /not an object/);
});

test('rejection feedback carries a hypothesis ledger that flags explanations that changed nothing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-')), outcomes = [stuck, wrongDate, wrongDate, stuck], feedback = [];
  const execute = async ({run}) => ({...outcomes.shift(), run_id: run.id});
  const model = async messages => { feedback.push(lastFeedback(messages)); return answer('c' + feedback.length, {diagnosis: 'Hypothesis ' + feedback.length, edits: featured.edits}); };
  await runAgent({execute, model, root, maxAttempts: 3});
  assert.equal(feedback[1].attempts_so_far.length, 1); assert.equal(feedback[1].unchanged_results, undefined);
  const ledger = feedback.at(-1);
  assert.deepEqual(ledger.attempts_so_far.map(item => [item.attempt, item.diagnosis, item.got_as_far_as]), [[1, 'Hypothesis 1', 'outcome'], [2, 'Hypothesis 2', 'outcome']]);
  assert.match(ledger.attempts_so_far[1].verifier_said, /saved for 2026-11-01 09:00/);
  assert.match(ledger.unchanged_results[0], /^Attempts 1, 2 ended with the identical verifier result: .*did not change the outcome/);
  const {hypothesisLedger} = require('../lib/agent.cjs');
  const notes = hypothesisLedger([{attempt: 1, diagnosis: 'd', stage: 'keyboard', headline: 'same as before'}, {attempt: 2, diagnosis: null, stage: 'format', headline: 'Rejected: x'}],
    {headline: 'same as before'});
  assert.match(notes.unchanged_results[0], /^Attempt 1 left the original failure unchanged/); assert.equal(notes.unchanged_results.length, 1);
});

test('the ledger groups one failure seen twice with different timing, and never groups crashes', async () => {
  // The same wrong save and the same reset, 640 ms and 660 ms after typing (a page timer plus a request).
  const resetAfter = ms => ({...wrongDate, keyboard: {workflow: {status: 'confirmation_observed'},
    keyboard_actions: [{command: 'type', text: '02/11/2026', at: 1000, date_value: '02/11/2026'}, {command: 'inspect', at: 2000, date_value: '01/11/2026'}],
    date_writes: [{at: 1000 + ms, value: '01/11/2026', via: 'value', stack: ['Object.setDateTimePickerValue (ui.min.js)']}]}});
  const crash = {scenario, applied_source: {}, build: {status: 'TRUSTED_BUILD_PASS'}, error: 'Docker operation timed out after 180000 ms'};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-')), outcomes = [stuck, resetAfter(640), resetAfter(660), crash, crash, stuck], feedback = [];
  const model = async messages => { feedback.push(lastFeedback(messages)); return answer('c' + feedback.length, {diagnosis: 'Hypothesis ' + feedback.length, edits: featured.edits}); };
  await runAgent({execute: async ({run}) => ({...outcomes.shift(), run_id: run.id}), model, root, maxAttempts: 5});
  assert.equal(feedback[2].attempts_so_far[0].verifier_said, feedback[2].attempts_so_far[1].verifier_said);
  assert.deepEqual(feedback[2].verifier_evidence.date_field_writes.map(write => write.t), ['+0.7s']);
  assert.match(feedback[2].unchanged_results[0], /^Attempts 1, 2 ended with the identical verifier result: .*changed the typed date to 01\/11\/2026"/);
  const last = feedback.at(-1);
  assert.match(last.attempts_so_far[3].verifier_said, /^The keyboard journey crashed: Docker operation timed out/);
  assert.equal(last.unchanged_results.length, 1, 'two identical crashes say nothing about the explanations behind them');
});

test('a booking saved for the right date but reopened with another one says so, with the date field before and after Next', () => {
  const reopenedWrong = {...wrongPhone, after: {appointments: [{id: '1', start_datetime: '2026-11-02 09:00:00'}], customers: [{id: '1', ...scenario.customer}]},
    evaluation: {pass: false, reasons: ['reopen_date_mismatch']},
    observer: {initial: {date_inputs: [{id: 'select-date', value: '02/11/2026', visible: false}]},
      after_next1: {date_inputs: [{id: 'select-date', value: '24/10/2026', visible: true}], date: {selected_date_iso: '2026-10-24', ambiguous: false}}}};
  const result = explain(reopenedWrong);
  assert.equal(result.headline, 'Saved for the right date, but reopening the booking showed 2026-10-24 instead of 2026-11-02');
  assert.deepEqual(result.evidence.reopen, {date_field_when_the_booking_link_opened: 'select-date="02/11/2026" (hidden)',
    date_field_after_pressing_next_on_step_1: 'select-date="24/10/2026"', date_shown_after_reopening: '2026-10-24'});
});

test('Nemotron\'s reasoning is kept in the trace for audit but never sent back to the model', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-')), seen = [];
  const trace = await runAgent({execute: async ({run, original}) => ({...(original ? stuck : verified), run_id: run.id}), root, maxAttempts: 1,
    model: async messages => { seen.push(JSON.stringify(messages)); const reply = answer('c', {diagnosis: 'd', evidence_explained: 'e', edits: featured.edits}); reply.message.reasoning_content = 'private chain of thought'; return reply; }});
  assert.equal(trace.steps.find(item => item.kind === 'propose').reasoning, 'private chain of thought');
  assert.ok(seen.every(text => !text.includes('private chain of thought')));
});

test('explain names the code that silently changed the typed date', () => {
  const initiator = ['send (jquery.min.js)', 'ajax (jquery.min.js)', 'getUnavailableDates (booking_http_client.min.js)', '(anonymous) (booking.min.js)', 'async setTimeout', 'onMonthChange (booking.min.js)', 'Ye (flatpickr.min.js)'];
  const keyboard = {workflow: {status: 'confirmation_observed'},
    keyboard_actions: [{command: 'type', text: '02/11/2026', at: 1000, date_value: '02/11/2026'}, {command: 'inspect', at: 2000, date_value: '01/11/2026'}],
    page_requests: [{at: 1500, method: 'GET', path: '/index.php/booking/get_unavailable_dates', initiator}],
    date_writes: [{at: 200, value: '25/10/2026', via: 'value', event: null, request: null, stack: ['Object.setDateTimePickerValue (ui.min.js)', 'Object.initialize (booking.min.js)']},
      {at: 1700, value: '01/11/2026', via: 'value', event: 'load', request: 'GET /index.php/booking/get_unavailable_dates', stack: ['Object.Ye [as setDate] (flatpickr.min.js)',
        'Object.setDateTimePickerValue (ui.min.js)', 'applyUnavailableDates (booking_http_client.min.js)', 'Object.<anonymous> (booking_http_client.min.js)', 'c (jquery.min.js)',
        'Object.fireWith [as resolveWith] (jquery.min.js)', 'XMLHttpRequest.<anonymous> (jquery.min.js)']}]};
  const {headline, evidence} = explain({...wrongDate, keyboard});
  assert.equal(headline, 'Confirmation shown, but saved for 2026-11-01 09:00 instead of 2026-11-02 09:00; page code changed the typed date to 01/11/2026');
  assert.deepEqual(evidence.date_field_writes, [{t: '-0.8s', value: '25/10/2026', by: 'setDateTimePickerValue ← initialize'},
    {t: '+0.7s', value: '01/11/2026', by: 'setDate ← setDateTimePickerValue ← applyUnavailableDates ← resolveWith ← (response to GET /index.php/booking/get_unavailable_dates) ← send ← ajax ← getUnavailableDates ← (setTimeout) ← onMonthChange'}]);
  assert.deepEqual(evidence.timeline_after_typing_date.map(item => item.t), ['+0.0s', '+0.5s', '+0.7s', '+1.0s']);
  assert.match(evidence.timeline_after_typing_date[1].event, /^page request GET \/index\.php\/booking\/get_unavailable_dates from send ← ajax ← getUnavailableDates ← \(setTimeout\) ← onMonthChange$/);
  assert.match(evidence.timeline_after_typing_date[2].event, /^page code set the date field to "01\/11\/2026" via setDate ← /);
  // With DevTools async stacks the write carries its own async chain and is not stitched to a request.
  const asyncStack = ['setDateTimePickerValue (ui.min.js)', 'applyUnavailableDates (booking_http_client.min.js)', 'async XMLHttpRequest.send', 'getUnavailableDates (booking_http_client.min.js)', 'async setTimeout', 'onMonthChange (booking.min.js)'];
  const traced = explain({...wrongDate, keyboard: {...keyboard, date_writes: [{...keyboard.date_writes[1], async_stack: asyncStack}]}}).evidence;
  assert.equal(traced.date_field_writes[0].by, 'setDate ← setDateTimePickerValue ← applyUnavailableDates ← resolveWith ← (XMLHttpRequest.send) ← getUnavailableDates ← (setTimeout) ← onMonthChange');
  const cdpOnly = explain({...wrongDate, keyboard: {...keyboard, date_writes: [{...keyboard.date_writes[1], stack: [], async_stack: asyncStack}]}}).evidence;
  assert.equal(cdpOnly.date_field_writes[0].by, 'setDateTimePickerValue ← applyUnavailableDates ← (XMLHttpRequest.send) ← getUnavailableDates ← (setTimeout) ← onMonthChange');
  // Stuck waiting for the slot because the date moved: the keyboard evidence carries the same provenance.
  const stuckAfterTyping = explain({...stuck, keyboard: {...keyboard, workflow: {status: 'unresolved', reason: 'booking_expected_ui_not_observed'},
    last_observation: {inputs: [{id: 'select-date', type: 'text'}]}}});
  assert.match(stuckAfterTyping.headline, /^Keyboard user got stuck: the expected control never appeared; page code changed the typed date to 01\/11\/2026/);
  assert.equal(stuckAfterTyping.evidence.date_field_writes.length, 2);
});

test('the page hook reports date writes made by page code, not by keystrokes, with stack and request', () => {
  const vm = require('node:vm');
  const {recordDateWrites, DATE_WRITE, inspectorFrames} = require('../integration/portable/container-keyboard-booking-worker.cjs');
  const reports = []; let poll;
  const context = vm.createContext({URL, console: {trace: (...args) => reports.push(args)}, location: {href: 'http://127.0.0.1:8080/booking'}, setInterval: fn => { poll = fn; }, addEventListener: () => {}});
  vm.runInContext(`globalThis.window = globalThis;
    class HTMLInputElement { constructor(id) { this.id = id; this.stored = ''; } get value() { return this.stored; } set value(v) { this.stored = String(v); } }
    class XMLHttpRequest { open() { return 'opened'; } }
    Object.assign(globalThis, {HTMLInputElement, XMLHttpRequest, date: new HTMLInputElement('select-date'), email: new HTMLInputElement('email')});
    globalThis.document = {getElementById: id => id === 'select-date' ? date : null};`, context);
  vm.runInContext('(' + recordDateWrites + ')(' + JSON.stringify(DATE_WRITE) + ')', context);
  vm.runInContext(`const xhr = new XMLHttpRequest(); globalThis.opened = xhr.open('GET', '/index.php/booking/get_unavailable_dates?selected_date=x');
    function setDateTimePickerValue(value) { date.value = value; }
    function applyUnavailableDates() { setDateTimePickerValue('01/11/2026'); }
    window.event = {type: 'keydown', isTrusted: true}; date.value = '02/11/2026';
    window.event = {type: 'load', isTrusted: true, target: xhr}; applyUnavailableDates();
    window.event = undefined; date.value = '01/11/2026'; email.value = 'a@example.invalid';
    date.stored = '05/11/2026';`, context);
  poll();
  assert.equal(context.opened, 'opened', 'the wrapped open still calls the original');
  assert.equal(context.date.value, '05/11/2026');
  assert.ok(reports.every(args => args[0] === DATE_WRITE));
  const writes = reports.map(args => JSON.parse(args[1]));
  assert.deepEqual(writes.map(write => [write.from, write.value, write.via]), [['02/11/2026', '01/11/2026', 'value'], ['01/11/2026', '05/11/2026', 'unseen']]);
  assert.equal(writes[0].request, 'GET /index.php/booking/get_unavailable_dates'); assert.equal(writes[0].event, 'load');
  assert.deepEqual(writes[0].stack.slice(0, 2), ['setDateTimePickerValue (evalmachine.<anonymous>)', 'applyUnavailableDates (evalmachine.<anonymous>)']);
  assert.deepEqual(inspectorFrames({callFrames: [{functionName: '__afNote', url: ''}, {functionName: 'applyUnavailableDates', url: 'http://127.0.0.1:8080/assets/js/http/booking_http_client.min.js?1'}],
    parent: {description: 'setTimeout', callFrames: [{functionName: '', url: 'http://127.0.0.1:8080/assets/js/pages/booking.min.js'}]}}),
  ['applyUnavailableDates (booking_http_client.min.js)', 'async setTimeout', '(anonymous) (booking.min.js)']);
});

test('traces are stamped with the agent version and run conditions', async () => {
  const {AGENT_VERSION} = require('../lib/agent.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-'));
  const trace = await runAgent({execute: async ({run, original}) => ({...(original ? {...stuck, fixture_fingerprint: 'f'.repeat(64), execution_started_at_utc: '2026-10-25T09:00:00.000Z'} : verified), run_id: run.id}),
    model: async () => answer('c', {diagnosis: 'd', edits: featured.edits}), root, maxAttempts: 3});
  assert.equal(trace.agent_version, AGENT_VERSION); assert.equal(trace.max_attempts, 3); assert.equal(trace.temperature, require('../lib/agent.cjs').TEMPERATURE); assert.equal(trace.top_p, require('../lib/agent.cjs').TOP_P);
  assert.equal(trace.scenario_date, '2026-11-02'); assert.equal(trace.scenario_crosses_month, true); assert.equal(trace.fixture_fingerprint, 'f'.repeat(64));
  assert.ok(trace.git_commit === null || /^[a-f0-9]{40}$/.test(trace.git_commit));
  assert.ok([true, false, null].includes(trace.git_dirty), 'whether the code that ran differs from that commit');
});

test('a pinned scenario date must be a Monday inside the booking window; the default for agent runs is next month', () => {
  const {scenario, nextMonthScenarioDate} = require('../lib/fixture.cjs'), now = new Date('2026-10-25T12:00:00Z');
  assert.equal(scenario(now, '2026-11-16').date, '2026-11-16'); assert.equal(scenario(now).date, '2026-11-02');
  for (const bad of ['2026-11-17', '2026-10-19', '2027-01-25', '2026-02-30', '16/11/2026']) assert.throws(() => scenario(now, bad), /AF_SCENARIO_DATE must be a Monday/);
  assert.equal(nextMonthScenarioDate(now), '2026-11-02');
  assert.equal(nextMonthScenarioDate(new Date('2026-11-01T12:00:00Z')), '2026-12-07', 'the default 2026-11-09 stays in November');
});

test('nemotron requires evidence_explained and parses search_code calls', async () => {
  const reply = (name, args) => async () => ({ok: true, status: 200, text: async () => JSON.stringify({choices: [{message: {tool_calls: [{id: 'c', function: {name, arguments: JSON.stringify(args)}}]}}], usage: {}})});
  await assert.rejects(nemotron([], {key: 'k', fetchImpl: reply('propose_repair', {diagnosis: 'd', edits: []})}), error => error.malformed && /evidence_explained/.test(error.message));
  const search = await nemotron([], {key: 'k', fetchImpl: reply('search_code', {pattern: 'setDate', path: 'utils'})});
  assert.deepEqual(search.search, {pattern: 'setDate', path: 'utils', ignore_case: false});
});

test('the run summary groups totals per agent version', () => {
  const {summarize} = require('../scripts/agent-summary.cjs');
  const run = (agent_version, state, extra = {}) => ({case_id: 'keyboard-date', ...(agent_version ? {agent_version} : {}), state, estimated_cost_usd: 0.01, duration_ms: 1000,
    started_at_utc: '2026-10-24T12:00:00.000Z', steps: [{kind: 'verify', stage: 'outcome'}, {kind: 'verify', stage: state === 'verified' ? 'passed' : 'outcome'}],
    ...(state === 'verified' ? {accepted: {attempt: 2}} : {}), ...extra});
  const sameMonth = run('2', 'verified', {started_at_utc: '2026-11-03T12:00:00.000Z', scenario_date: '2026-11-16', scenario_crosses_month: false});
  const summary = summarize([run(undefined, 'not_verified'), run('2', 'verified'), run('2', 'not_verified'), sameMonth]);
  assert.equal(summary.cases['keyboard-date'].runs, 4);
  assert.deepEqual(Object.keys(summary.agent_versions), ['1', '2']);
  assert.equal(summary.agent_versions['1'].cases['keyboard-date'].verified, 0);
  assert.equal(summary.agent_versions['2'].runs, 3); assert.equal(summary.agent_versions['2'].cases['keyboard-date'].verified, 1);
  assert.equal(summary.agent_versions['2'].cases['keyboard-date'].wrong_saves_caught, 3);
  assert.equal(summary.agent_versions['2'].same_month_date_cases['keyboard-date'].runs, 1, 'a run that could not face the month-change reset is counted apart');
  assert.equal(summary.agent_versions['1'].same_month_date_cases, undefined, 'version 1 traces derive their date from the clock: 2026-10-24 booked 2026-11-02');
});
