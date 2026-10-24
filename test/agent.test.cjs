'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {runAgent, explain} = require('../lib/agent.cjs');
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
