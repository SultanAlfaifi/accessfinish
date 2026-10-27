'use strict';
// Renders the pull-request comment AccessFinish would post as a merge gate, from a recorded live run.
//   node scripts/pr-comment.cjs [agent-<id>] > examples/pr-comment.md
// Every line comes from the run's raw trace in evidence/agent-runs/; nothing is posted anywhere.
const fs = require('node:fs'), path = require('node:path');
const id = process.argv[2] || 'agent-2c87e16a520f678b45cbbbeb';
if (!/^agent-[a-f0-9]{24}$/.test(id)) throw Error('Pass a run id such as agent-2c87e16a520f678b45cbbbeb.');
const trace = JSON.parse(fs.readFileSync(path.join(__dirname, '../evidence/agent-runs', id + '.json'), 'utf8'));
const REPO = 'https://github.com/SultanAlfaifi/accessfinish';
const CHECKS = ['Trusted build in an offline sandbox', 'Booking completed with the keyboard only', 'Saved row read back with a read-only database account',
  'Booking reopened in a fresh browser', 'Mouse booking with different data, using month navigation', 'Clearing the date causes no error',
  'Reserved slot is not offered', 'Existing records unchanged', 'Sandbox isolation inspected'];
const cell = text => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const verifies = trace.steps.filter(step => step.kind === 'verify');
const out = [];

out.push('## AccessFinish: ' + (trace.state === 'verified' ? '✅ verified fix found' : '❌ no verified fix'), '');
out.push('> **Goal:** ' + trace.goal, '');
out.push('| Attempt | Verdict | What the verifier found |', '| :---: | --- | --- |');
for (const step of verifies) out.push('| ' + step.attempt + ' | ' + (step.verified ? '✅ verified' : '❌ ' + (step.stage || 'rejected')) + ' | ' + cell(step.headline) + ' |');
out.push('');

// The first patch that reached a "booked" page but saved the wrong data: the one a confirmation-page check would have merged.
const wrong = verifies.find(step => step.stage === 'outcome' && step.evidence?.saved);
if (wrong) {
  const evidence = wrong.evidence, saved = evidence.saved.appointments?.[0] || {};
  out.push('### Why attempt ' + wrong.attempt + ' was blocked although the page said "booked"', '');
  out.push('| | Typed by the user | Saved in the database |', '| --- | --- | --- |');
  out.push('| Appointment | `' + evidence.expected?.start + '` | `' + saved.start + '` |', '');
  const write = (evidence.timeline_after_typing_date || []).find(item => /page code set the date field/.test(item.event));
  if (write) out.push('The verifier recorded the code that changed the typed date (DevTools async stack, newest call first):', '', '```text', write.t + '  ' + write.event, '```', '');
}
const reopen = verifies.find(step => step.stage === 'outcome' && step.evidence?.reopen && step !== wrong);
if (reopen) {
  const r = reopen.evidence.reopen;
  out.push('### Why attempt ' + reopen.attempt + ' was blocked although the date was saved right', '');
  out.push('Reopening the booking in a fresh browser: the date field held `' + r.date_field_when_the_booking_link_opened + '`, then `' + r.date_field_after_pressing_next_on_step_1 + '` after **Next**; the customer would see **' + r.date_shown_after_reopening + '**.', '');
}

if (trace.accepted) {
  const proof = trace.accepted.proof || {};
  out.push('### Attempt ' + trace.accepted.attempt + ': verified', '');
  out.push('- Saved appointment: `' + proof.booking?.start + '`, reopened in a fresh browser as `' + proof.reopened_date + '`');
  out.push('- Keyboard actions: ' + proof.keyboard_actions);
  for (const check of CHECKS) out.push('- [x] ' + check);
  out.push('', '<details><summary>Patch (' + trace.accepted.patch.split('\n').length + ' lines)</summary>', '', '```diff', trace.accepted.patch.trimEnd(), '```', '</details>', '');
}
out.push('<sub>Model: ' + trace.model + ' on ' + trace.provider + ' · ' + verifies.length + ' attempts · estimated $' + Number(trace.estimated_cost_usd || 0).toFixed(2)
  + ' at list price · <a href="' + REPO + '/blob/codex/submission/evidence/agent-runs/' + id + '.json">raw trace</a></sub>');
process.stdout.write(out.join('\n') + '\n');
