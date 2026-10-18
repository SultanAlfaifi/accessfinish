'use strict';
// Trusted container-only worker. No provider, model, credential or host-profile imports.
const fs = require('node:fs');
const crypto = require('node:crypto');
const ORIGIN = 'http://127.0.0.1:8080';
const TASK_URL = ORIGIN + '/booking';
const PROTOCOL = 'accessfinish-container-keyboard-booking-v1';
const MAX_REQUEST_BYTES = 8192, MAX_RESPONSE_BYTES = 65536;
const KEY_PATTERN = /^(?:Tab|Shift\+Tab|Enter|Space|Escape|Backspace|Delete|Arrow(?:Up|Down|Left|Right)|Home|End|PageUp|PageDown|Control\+A)$/;
const CODES = new Set(['invalid_protocol_message', 'unsupported_command', 'booking_hash_not_allowed', 'keyboard_key_not_allowed',
  'keyboard_text_not_allowed', 'browser_not_started', 'browser_closed', 'navigation_outside_app', 'browser_operation_failed']);
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function validateCommand(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || !Number.isSafeInteger(m.id) || m.id < 1 || m.id > 2147483647 || typeof m.command !== 'string') fail('invalid_protocol_message');
  const extras = m.command === 'press' ? ['key'] : m.command === 'type' ? ['text'] : m.command === 'reopen' ? ['hash'] : [];
  if (!['start', 'inspect', 'press', 'type', 'reload', 'close', 'reopen'].includes(m.command)) fail('unsupported_command');
  if (Object.keys(m).some(k => !['id', 'command', ...extras].includes(k))) fail('invalid_protocol_message');
  if (m.command === 'press' && (typeof m.key !== 'string' || /[\x00-\x1f\x7f]/.test(m.key) || !KEY_PATTERN.test(m.key))) fail('keyboard_key_not_allowed');
  if (m.command === 'type' && (typeof m.text !== 'string' || m.text.length > 1000 || /[\x00-\x1f\x7f]/.test(m.text))) fail('keyboard_text_not_allowed');
  if (m.command === 'reopen') validateHash(m.hash);
  return m;
}
function allowedUrl(url) {
  try { if (typeof url !== 'string' || url.length > 2048 || /[\x00-\x1f\x7f]/.test(url)) return false; const u = new URL(url); return u.origin === ORIGIN && !u.username && !u.password; } catch { return false; }
}
function validateHash(hash) {
  if (typeof hash !== 'string' || hash.length < 1 || hash.length > 128 || /[^A-Za-z0-9]/.test(hash)) fail('booking_hash_not_allowed');
  return hash;
}
function bookingPageUrl(url) {
  if (!allowedUrl(url)) return false;
  const u = new URL(url);
  return !u.search && !u.hash && /^\/(?:index\.php\/)?(?:booking(?:\/reschedule\/[A-Za-z0-9]{1,128})?|booking_confirmation\/(?:of|index)\/[A-Za-z0-9]{1,128})\/?$/.test(u.pathname);
}
function bookingHref(url) {
  if (!bookingPageUrl(url)) return false;
  return /^\/(?:index\.php\/)?booking(?:\/reschedule\/[A-Za-z0-9]{1,128})?\/?$/.test(new URL(url).pathname);
}
const INPUT_IDS = new Set(['first-name', 'last-name', 'email', 'phone-number', 'address', 'city', 'zip-code', 'notes',
  'select-service', 'select-provider', 'select-timezone', 'select-date', 'af-keyboard-date', 'native_date', 'native-date']);
const INPUT_TYPES = new Set(['text', 'email', 'tel', 'date', 'textarea', 'select-one']);
function diagnosticShape(s) {
  if (!s || typeof s !== 'object' || !bookingPageUrl(s.url) || typeof s.title !== 'string' || typeof s.body !== 'string' ||
    s.title.length > 512 || s.body.length > 12000 || !s.focus || typeof s.focus !== 'object' ||
    !Array.isArray(s.inputs) || s.inputs.length > 16 || !Array.isArray(s.links) || s.links.length > 16) fail('browser_operation_failed');
  const inputs = s.inputs.map(input => {
    if (!input || Object.keys(input).some(k => !['id', 'type', 'value', 'selected_option_label'].includes(k)) ||
      !INPUT_IDS.has(input.id) || !INPUT_TYPES.has(input.type) || typeof input.value !== 'string' || input.value.length > 1000 ||
      !(input.selected_option_label === null || (input.type === 'select-one' && typeof input.selected_option_label === 'string' && input.selected_option_label.length <= 200))) fail('browser_operation_failed');
    return {id: input.id, type: input.type, value: input.value, selected_option_label: input.selected_option_label};
  });
  if (new Set(inputs.map(input => input.id)).size !== inputs.length) fail('browser_operation_failed');
  const links = s.links.map(link => {
    if (!link || Object.keys(link).some(k => !['href', 'text'].includes(k)) || !bookingHref(link.href) ||
      typeof link.text !== 'string' || link.text.length > 200) fail('browser_operation_failed');
    return {href: link.href, text: link.text};
  });
  const focusValue = s.focus.value;
  if (!(focusValue === null || (INPUT_IDS.has(s.focus.id) && INPUT_TYPES.has(s.focus.type) && typeof focusValue === 'string' && focusValue.length <= 1000))) fail('browser_operation_failed');
  if (!(s.focus.type === null || (typeof s.focus.type === 'string' && s.focus.type.length <= 32))) fail('browser_operation_failed');
  return {url: s.url.slice(0, 2048), title: s.title,
    focus: {tag: typeof s.focus.tag === 'string' ? s.focus.tag.slice(0, 64) : null,
      id: typeof s.focus.id === 'string' ? s.focus.id.slice(0, 200) : null,
      role: typeof s.focus.role === 'string' ? s.focus.role.slice(0, 100) : null,
      text: typeof s.focus.text === 'string' ? s.focus.text.slice(0, 200) : '', type: s.focus.type, value: focusValue}, body: s.body, inputs, links};
}
// Fixed function serialized by Playwright. No selectors, expressions or URLs are supplied by callers.
function readBookingDiagnostic() {
  const ids = new Set(['first-name', 'last-name', 'email', 'phone-number', 'address', 'city', 'zip-code', 'notes',
    'select-service', 'select-provider', 'select-timezone', 'select-date', 'af-keyboard-date', 'native_date', 'native-date']);
  const types = new Set(['text', 'email', 'tel', 'date', 'textarea', 'select-one']);
  const visible = element => !!element && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none';
  const type = element => element?.tagName === 'TEXTAREA' ? 'textarea' : element?.tagName === 'SELECT' ? 'select-one' : element?.type || null;
  const safe = element => visible(element) && ids.has(element.id) && types.has(type(element)) &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
  const active = document.activeElement;
  const inputs = [...document.querySelectorAll('input,textarea,select')].filter(safe).slice(0, 16).map(element => ({
    id: element.id, type: type(element), value: String(element.value || '').slice(0, 1000),
    selected_option_label: element.tagName === 'SELECT' ? (element.selectedOptions[0]?.textContent || '').slice(0, 200) : null}));
  const links = [], seen = new Set();
  for (const element of document.querySelectorAll('a[href]')) {
    if (!visible(element)) continue;
    try {
      const u = new URL(element.href);
      if (u.origin !== 'http://127.0.0.1:8080' || u.username || u.password || u.search || u.hash ||
        !/^\/(?:index\.php\/)?booking(?:\/reschedule\/[A-Za-z0-9]{1,128})?\/?$/.test(u.pathname) || seen.has(u.href)) continue;
      seen.add(u.href); links.push({href: u.href.slice(0, 2048), text: (element.textContent || '').slice(0, 200)});
      if (links.length >= 16) break;
    } catch {}
  }
  return {url: location.href.slice(0, 2048), title: document.title.slice(0, 512),
    focus: {tag: active?.tagName, id: active?.id, role: active?.getAttribute('role'),
      text: (active?.textContent || '').slice(0, 200), type: type(active), value: safe(active) ? String(active.value || '').slice(0, 1000) : null},
    body: (document.body?.innerText || '').slice(0, 12000), inputs, links};
}
function createSession({chromium}) {
  if (!chromium || typeof chromium.launch !== 'function') fail('browser_operation_failed');
  let browser = null, launchPromise = null, context = null, page = null, closed = false, closePromise = null, violated = false;
  async function stopContext() {
    const previous = context; context = null; page = null;
    if (previous) await previous.close();
  }
  function assertActive() {
    if (closed) fail('browser_closed');
    if (!page) fail('browser_not_started');
    if (violated || !bookingPageUrl(page.url())) fail('navigation_outside_app');
  }
  async function inspect() {
    assertActive();
    // Fixed read-only diagnostic only. No script, selector or expression is accepted from stdin.
    const state = await page.evaluate(readBookingDiagnostic);
    assertActive();
    return diagnosticShape(state);
  }
  async function freshContext(url) {
      if (closed) fail('browser_closed');
      await stopContext(); violated = false;
      try {
        if (!launchPromise) launchPromise = chromium.launch({headless: true, chromiumSandbox: true, args: ['--disable-dev-shm-usage']});
        browser = await launchPromise;
        if (closed) { await browser.close(); fail('browser_closed'); }
        context = await browser.newContext({timezoneId: 'UTC', viewport: {width: 1280, height: 900}, serviceWorkers: 'block'});
        if (closed) { await stopContext(); fail('browser_closed'); }
        const owned = context;
        await owned.route('**/*', route => allowedUrl(route.request().url()) ? route.continue() : route.abort());
        page = await owned.newPage();
        const currentPage = page;
        page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(10000);
        owned.on('page', extra => { if (extra !== currentPage) extra.close().catch(() => {}); });
        page.on('framenavigated', frame => {
          if (frame === currentPage.mainFrame() && !bookingPageUrl(frame.url())) {
            violated = true; owned.close().catch(() => {});
          }
        });
        await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 10000});
        return await inspect();
      } catch (e) {
        await stopContext().catch(() => {});
        if (!browser) launchPromise = null; // A failed launch can be retried without a leaked browser.
        throw e;
      }
  }
  return {
    start: () => freshContext(TASK_URL),
    // Operator-only. The model tool definitions must never expose this method.
    reopen: async hash => freshContext(ORIGIN + '/booking/reschedule/' + validateHash(hash)),
    inspect,
    async press(key) {
      validateCommand({id: 1, command: 'press', key}); assertActive();
      await page.keyboard.press(key); return inspect();
    },
    async type(text) {
      validateCommand({id: 1, command: 'type', text}); assertActive();
      await page.keyboard.type(text); return inspect();
    },
    async reload() { assertActive(); await page.reload({waitUntil: 'domcontentloaded', timeout: 10000}); return inspect(); },
    async close() {
      if (closePromise) return closePromise;
      closed = true;
      closePromise = (async () => {
        try { await stopContext(); }
        finally { if (launchPromise) { const b = await launchPromise.catch(() => null); if (b) await b.close(); } browser = null; }
        return {closed: true};
      })();
      return closePromise;
    }
  };
}
function runProtocol({session, input, output}) {
  return new Promise((resolve, reject) => {
    let buffer = '', queue = Promise.resolve(), lastId = 0, pendingCount = 0, closing = false, terminated = false;
    const emit = packet => {
      const text = JSON.stringify(packet);
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw Error('response_size_limit');
      output.write(text + '\n');
    };
    const finish = () => {
      if (terminated) return; terminated = true;
      // Closing the context immediately also cancels a pending page operation.
      const stop = session.close();
      Promise.allSettled([queue, stop]).then(() => resolve());
    };
    const invalid = () => { emit({id: 0, ok: false, error: 'invalid_protocol_message'}); closing = true; input.destroy?.(); finish(); };
    input.setEncoding?.('utf8');
    input.on('data', chunk => {
      if (terminated) return;
      buffer += chunk;
      if (Buffer.byteLength(buffer) > MAX_REQUEST_BYTES && !buffer.includes('\n')) return invalid();
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (!line || Buffer.byteLength(line) > MAX_REQUEST_BYTES) return invalid();
        let m;
        try { m = JSON.parse(line); } catch { return invalid(); }
        const id = m?.id;
        if (!Number.isSafeInteger(id) || id < 1 || id <= lastId || closing || pendingCount >= 16) return invalid();
        lastId = id;
        let policyError;
        try { validateCommand(m); } catch (e) { policyError = e.code; }
        if (!policyError && m.command === 'close') closing = true;
        pendingCount++;
        queue = queue.then(async () => {
          if (policyError) return emit({id, ok: false, error: CODES.has(policyError) ? policyError : 'invalid_protocol_message'});
          try {
            const result = await session[m.command](...(['press', 'type', 'reopen'].includes(m.command) ? [m.command === 'press' ? m.key : m.command === 'type' ? m.text : m.hash] : []));
            emit({id, ok: true, result});
          } catch (e) { emit({id, ok: false, error: CODES.has(e.code) ? e.code : 'browser_operation_failed'}); }
        }).finally(() => { pendingCount--; }).catch(reject);
      }
      if (Buffer.byteLength(buffer) > MAX_REQUEST_BYTES) return invalid();
    });
    input.once('end', () => { if (buffer.trim()) invalid(); else finish(); });
    input.once('error', finish);
  });
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--session-token' || args[1].length !== 32 || !/^[a-f0-9]{32}$/.test(args[1]) || process.getuid?.() !== 1000) fail('invalid_protocol_message');
  const {chromium} = require('/trusted/node_modules/playwright');
  const session = createSession({chromium});
  const shutdown = () => {
    const deadline = setTimeout(() => process.exit(0), 1200); deadline.unref();
    session.close().finally(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown); process.stdin.once('end', shutdown);
  process.stdout.write(JSON.stringify({id: 0, ok: true, result: {protocol: PROTOCOL,
    worker_sha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    worker_pid: process.pid, session_token: args[1]}}) + '\n');
  try { await runProtocol({session, input: process.stdin, output: process.stdout}); }
  finally { await session.close(); }
}
module.exports = {createSession, validateCommand, runProtocol, allowedUrl, diagnosticShape, PROTOCOL, TASK_URL,
  bookingPageUrl, bookingHref, validateHash, readBookingDiagnostic, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES};
if (require.main === module) main().catch(() => { process.stderr.write('container_keyboard_worker_stopped\n'); process.exitCode = 1; });
