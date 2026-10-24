'use strict';
const fs = require('node:fs'), crypto = require('node:crypto');
const {chromium} = require('/trusted/node_modules/playwright');
const keyboard = require('./container-keyboard-booking-worker.cjs');
const macros = require('./booking-keyboard-macros.cjs');
const observer = require('./container-booking-pilot-observer.cjs');
async function main() {
  if (process.getuid?.() !== 1000) throw Error('The browser must run as the isolated nonroot user.');
  const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (process.argv[2] === 'controls') return require('./regression-controls.cjs').run({chromium, scenario: payload.scenario});
  if (process.argv[2] === 'observe') {
    return observer.observe({chromium, bookingHash: payload.booking_hash,
      workerSha256: crypto.createHash('sha256').update(fs.readFileSync(require.resolve('./container-booking-pilot-observer.cjs'))).digest('hex')});
  }
  if (process.argv[2] !== 'keyboard') throw Error('Unsupported browser operation.');
  const session = keyboard.createSession({chromium}), actions = [];
  let submitted = 0;
  try {
    const result = await macros.run('browser_complete_booking', {
      scenario: payload.scenario,
      invoke: async (name, args = {}) => {
        const command = {browser_start: 'start', browser_inspect: 'inspect', browser_press: 'press', browser_type: 'type'}[name];
        if (!command || actions.length >= 400) throw Error('Keyboard action budget exhausted.');
        actions.push({command, ...(args.key ? {key: args.key} : {}), ...(args.text ? {text: args.text} : {})});
        const state = await session[command](...(command === 'press' ? [args.key] : command === 'type' ? [args.text] : []));
        // Record where focus landed so a failed journey can be explained.
        if (command === 'press' && state?.focus) actions.at(-1).focus = {tag: state.focus.tag, id: state.focus.id || null, role: state.focus.role || null, text: (state.focus.text || '').trim().slice(0, 40)};
        return state;
      },
      onSubmit: async () => { if (++submitted !== 1) throw Error('Only one booking submission is allowed.'); },
    });
    return {workflow: result.workflow, last_observation: result, keyboard_actions: actions, native_keyboard_only: true, submissions: submitted};
  } finally { await session.close(); }
}
main().then(result => console.log(JSON.stringify(result))).catch(error => {
  console.error(JSON.stringify({error: error.code || error.message, stage: error.observer_stage || null})); process.exitCode = 1;
});
