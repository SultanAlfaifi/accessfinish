'use strict';
// Smoke test of the keyboard worker's provenance session in a real browser. Provenance attaches a
// DevTools debugger; it must never pause the page, or turning it on could change a journey's verdict.
// Skipped when Playwright is not installed; PLAYWRIGHT_MODULE names one (the CI runs it in the browser image).
const test = require('node:test'), assert = require('node:assert/strict'), http = require('node:http');
const {createSession} = require('../integration/portable/container-keyboard-booking-worker.cjs');

// `debugger` statements at load, and in a timer started by a key handler, as a candidate edit could add.
const PAGE = `<!doctype html><title>Booking</title><label>Date <input id="select-date" type="text"></label><script>debugger;
  document.getElementById('select-date').addEventListener('keydown', function onKey(event) {
    if (event.key === 'Enter') setTimeout(function reset() { debugger; event.target.value = '01/11/2026'; }, 100);
  });</script>`;

test('provenance never pauses the page, even on a debugger statement', {timeout: 90000}, async t => {
  let playwright;
  try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
  catch (error) { if (process.env.PLAYWRIGHT_MODULE) throw error; return t.skip('Playwright is not installed'); }
  const server = http.createServer((request, response) => { response.setHeader('content-type', 'text/html'); response.end(PAGE); });
  try { await new Promise((resolve, reject) => server.once('error', reject).listen(8080, '127.0.0.1', resolve)); }
  catch (error) { if (error.code === 'EADDRINUSE') return t.skip('127.0.0.1:8080 is in use'); throw error; }
  // The browser image runs Chromium's sandbox under its own seccomp profile; this test runs without it.
  const chromium = {launch: options => playwright.chromium.launch({...options, chromiumSandbox: false})};
  const results = {};
  try {
    for (const provenance of [false, true]) {
      const session = createSession({chromium, provenance}), timer = new Promise((resolve, reject) => setTimeout(() => reject(Error('the page paused')), 30000).unref());
      try {
        // start and reload both navigate: a pause setting lost on navigation would hang here.
        await Promise.race([timer, (async () => {
          await session.start(); await session.reload(); await session.press('Tab'); await session.type('02/11/2026'); await session.press('Enter');
          await new Promise(resolve => setTimeout(resolve, 400));
          results[provenance] = {value: (await session.inspect()).inputs.find(input => input.id === 'select-date').value, writes: session.dateWrites()};
        })()]);
      } finally { await session.close(); }
    }
  } finally { server.close(); }
  assert.equal(results.false.value, '01/11/2026');
  assert.equal(results.true.value, results.false.value, 'provenance changed what the page did');
  const write = results.true.writes.find(item => item.value === '01/11/2026');
  assert.ok(write, 'the write made by page code was recorded');
  assert.deepEqual(write.async_stack.slice(0, 3), ['reset (booking)', 'async setTimeout', 'onKey (booking)']);
});
