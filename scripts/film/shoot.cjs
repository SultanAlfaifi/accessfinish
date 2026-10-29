'use strict';
// Screen-record AccessFinish on a desktop: a visible Chromium and terminals on an X display, captured
// with ffmpeg. Nothing is staged: the browser drives the real app with real key presses, and the live
// scene presses Run live on the local page, which runs Nemotron and the sandboxed verifier.
//   node scripts/film/shoot.cjs --scene before|live|after --out <dir> [--xvfb] [--dry]
// before: the original app (scripts/film/serve-app.cjs --original must be serving on :8080)
// live:   npm start in a terminal, then Run live on the keyboard case (--dry replays a recorded run instead)
// after:  the patched app (serve-app.cjs --trace ...): book with the keyboard, read the saved row, reopen
// Each scene writes <scene>.mp4 and <scene>.json, a log of what happened and when (seconds into the video).
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const argument = flag => process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;
const scene = argument('--scene'), out = path.resolve(argument('--out') || 'film-out'), dry = process.argv.includes('--dry');
const project = path.resolve(__dirname, '..', '..');
const W = 1920, H = 1080, SCALE = 1.5, APP = 'http://127.0.0.1:8080', PAGE = 'http://127.0.0.1:4177';
const DATE = process.env.AF_SCENARIO_DATE || '2026-11-09';
const CUSTOMER = {first: 'Layla', last: 'Hassan', email: 'layla.hassan@example.invalid', phone: '0551234567'};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
fs.mkdirSync(out, {recursive: true});

// ---- desktop ----
const children = [];
function spawn(command, args, options = {}) {
  const child = cp.spawn(command, args, {stdio: ['pipe', 'ignore', 'pipe'], ...options});
  child.stderr?.on('data', () => {}); children.push(child); return child;
}
const x = (...args) => cp.execFileSync('xdotool', args.map(String), {encoding: 'utf8'}).trim();
async function desktop() {
  if (process.argv.includes('--xvfb')) {
    process.env.DISPLAY = ':99';
    spawn('Xvfb', [':99', '-screen', '0', W + 'x' + H + 'x24', '-nolisten', 'tcp']); await sleep(1500);
    spawn('openbox', []); await sleep(800);
  }
  try { cp.execFileSync('xsetroot', ['-solid', '#0f172a']); } catch {}
}
// A terminal window with a big, legible font. Its command runs in the repository.
async function terminal(name, command, {geometry = '96x26+120+90', env = {}} = {}) {
  spawn('xterm', ['-name', name, '-title', name === 'af-server' ? 'npm start' : 'Terminal', '-fa', 'DejaVu Sans Mono', '-fs', '17', '-geometry', geometry,
    '-bg', '#0b1020', '-fg', '#e2e8f0', '-cr', '#38bdf8', '-bc', '-xrm', 'XTerm*borderWidth: 0', '-e', 'bash', '-c', command], {cwd: project, env: {...process.env, ...env}});
  for (let i = 0; i < 40; i++) { try { const id = x('search', '--classname', name).split('\n')[0]; if (id) return id; } catch {} await sleep(250); }
  throw Error('Terminal ' + name + ' did not open.');
}
const raise = id => { try { x('windowactivate', '--sync', id); } catch { x('windowraise', id); } };

// ---- recording ----
let recorder, started = 0;
const events = [];
const t = () => started ? +((Date.now() - started) / 1000).toFixed(2) : 0;
const log = (event, detail = {}) => { const entry = {t: t(), event, ...detail}; events.push(entry); console.log(entry.t.toFixed(1).padStart(6) + 's  ' + event + ' ' + JSON.stringify(detail)); };
async function record(fps) {
  recorder = cp.spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'x11grab', '-draw_mouse', '1', '-framerate', String(fps), '-video_size', W + 'x' + H, '-i', process.env.DISPLAY,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, scene + '.mp4')], {stdio: ['pipe', 'inherit', 'inherit']});
  await sleep(700); started = Date.now(); log('recording', {fps});
}
async function finish(extra = {}) {
  log('end');
  if (recorder) { recorder.stdin.write('q'); await new Promise(resolve => recorder.once('close', resolve)); }
  fs.writeFileSync(path.join(out, scene + '.json'), JSON.stringify({scene, date: DATE, customer: CUSTOMER, recorded_at_utc: new Date().toISOString(), ...extra, events}, null, 2) + '\n');
}

// ---- browser ----
let browser;
async function browserWindow(options = {}) {
  browser ||= await chromium.launch({headless: false, ignoreDefaultArgs: ['--enable-automation'],
    args: ['--window-position=0,0', '--window-size=' + Math.round(W / SCALE) + ',' + Math.round(H / SCALE), '--force-device-scale-factor=' + SCALE, '--no-first-run',
      '--hide-crash-restore-bubble', '--disable-features=Translate,MediaRouter', '--password-store=basic']});
  const context = await browser.newContext({viewport: null, timezoneId: 'Asia/Riyadh', locale: 'en-GB', ...options});
  await context.addInitScript(keyHud);
  return context;
}
// On the booking app only: show each key press at the bottom of the page and outline the focused element,
// so a viewer can follow a keyboard-only journey. Display only: no focusable element, no pointer events.
function keyHud() {
  if (location.port !== '8080') return;
  const css = ':focus,:focus-visible{outline:4px solid #f59e0b!important;outline-offset:3px!important;box-shadow:0 0 0 8px rgba(245,158,11,.25)!important}'
    + '#af-keys{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;display:flex;flex-wrap:nowrap;gap:8px;align-items:center;pointer-events:none;white-space:nowrap;font:600 17px/1 system-ui,sans-serif}'
    + '#af-keys .k{flex:none;background:#0f172a;color:#fff;border:1px solid #334155;border-bottom-width:4px;border-radius:10px;padding:10px 14px;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:opacity .5s}'
    + '#af-keys .k.old{opacity:.35}#af-keys .tag{flex:none;background:#f59e0b;color:#0f172a;border-radius:999px;padding:8px 12px;font-size:14px;letter-spacing:.02em}';
  const mount = () => {
    if (document.getElementById('af-keys')) return;
    const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    const bar = document.createElement('div'); bar.id = 'af-keys'; bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span class="tag">KEYBOARD ONLY</span>'; document.body.append(bar);
  };
  window.__afKey = label => {
    mount(); const bar = document.getElementById('af-keys');
    for (const key of bar.querySelectorAll('.k')) key.classList.add('old');
    const key = document.createElement('span'); key.className = 'k'; key.textContent = label; bar.append(key);
    while (bar.querySelectorAll('.k').length > 4) bar.querySelector('.k').remove();
  };
  document.addEventListener('DOMContentLoaded', mount);
}
const focusOf = page => page.evaluate(() => {
  const a = document.activeElement;
  const text = a?.tagName === 'SELECT' ? a.selectedOptions[0]?.textContent : a?.innerText || a?.value || a?.getAttribute('aria-label');
  return {id: a?.id || '', tag: a?.tagName || '', className: String(a?.className || '').slice(0, 60), text: String(text || '').trim().slice(0, 60)};
});
async function press(page, key, label = key, wait = 650) {
  await page.evaluate(text => window.__afKey?.(text), label);
  await page.keyboard.press(key); await sleep(wait);
  const focus = await focusOf(page); log('key', {key, focus}); return focus;
}
async function type(page, text) {
  await page.evaluate(value => window.__afKey?.('type “' + value + '”'), text);
  await page.keyboard.type(text, {delay: 110}); await sleep(500); log('type', {text, focus: await focusOf(page)});
}
async function tabTo(page, test, limit = 40, wait = 450) {
  let focus = await focusOf(page);
  for (let i = 0; i < limit && !test(focus); i++) focus = await press(page, 'Tab', 'Tab', wait);
  if (!test(focus)) throw Error('Focus never reached the expected element; last: ' + JSON.stringify(focus));
  return focus;
}
async function choose(page, id, value) {
  const current = () => page.evaluate(el => document.getElementById(el)?.value, id);
  if (String(await current()) === String(value)) return;
  await press(page, 'Home', 'Home', 300);
  for (let i = 0; i < 16 && String(await current()) !== String(value); i++) await press(page, 'ArrowDown', '↓', 450);
  if (String(await current()) !== String(value)) throw Error('Could not select ' + value + ' in ' + id);
}
// The real mouse pointer (xdotool) glides to an element and clicks it, so the click shows on screen.
async function click(page, locator) {
  const box = await locator.boundingBox(); if (!box) throw Error('Nothing to click.');
  const view = await page.evaluate(() => ({x: window.screenX, y: window.screenY + window.outerHeight - window.innerHeight}));
  const tx = Math.round((view.x + box.x + box.width / 2) * SCALE), ty = Math.round((view.y + box.y + box.height / 2) * SCALE);
  const [sx, sy] = x('getmouselocation', '--shell').split('\n').slice(0, 2).map(line => Number(line.split('=')[1]));
  for (let i = 1; i <= 24; i++) { const k = i / 24, e = k * k * (3 - 2 * k); x('mousemove', Math.round(sx + (tx - sx) * e), Math.round(sy + (ty - sy) * e)); await sleep(22); }
  await sleep(250); x('click', 1); await sleep(300);
}
async function scrollTo(page, selector) {
  await page.evaluate(sel => document.querySelector(sel).scrollIntoView({behavior: 'smooth', block: 'start'}), selector); await sleep(1400);
}

// ---- scenes ----
async function bookingStart(page) {
  await page.goto(APP + '/booking'); await page.waitForSelector('#select-service'); await sleep(2200); log('booking-page');
  await tabTo(page, f => f.id === 'select-service', 6, 650); await choose(page, 'select-service', 1);
  await tabTo(page, f => f.id === 'select-provider', 6, 650); await choose(page, 'select-provider', 2);
  await tabTo(page, f => f.id === 'button-next-1', 6, 650); await press(page, 'Enter', 'Enter ↵', 1600);
  log('date-step');
}

async function before() {
  const context = await browserWindow(), page = await context.newPage(); await sleep(1500);
  await record(30);
  await bookingStart(page);
  // Keep pressing Tab through the date step: focus goes round the step and never lands in the calendar.
  const seen = [];
  for (let i = 0; i < 14; i++) { const focus = await press(page, 'Tab', 'Tab', 800); seen.push(focus); }
  const reached = seen.some(f => ['select-date', 'af-keyboard-date', 'native-date', 'native_date'].includes(f.id) || /flatpickr-day/.test(f.className));
  log('calendar-reached', {reached}); await sleep(2500);
  await finish({calendar_reached: reached, focus_trail: seen});
}

async function live() {
  const server = await terminal('af-server', 'printf "\\033[1;36m$ npm start\\033[0m\\n"; npm start 2>&1; sleep 99999', {geometry: '80x12+140+120'});
  await record(dry ? 30 : 15);
  await sleep(3500); log('server-terminal');
  const context = await browserWindow(), page = await context.newPage();
  await page.goto(dry ? 'http://127.0.0.1:4178/' : PAGE); await sleep(3000); log('page-hero');
  const docker = await terminal('af-docker', 'watch -t -n 1 "docker ps --format \'table {{.Names}}\\t{{.Status}}\\t{{.Networks}}\' | sed \'s/   */  /g\'"', {geometry: '104x14+90+520'});
  raise(x('search', '--onlyvisible', '--class', 'chromium').split('\n').pop()); await sleep(600);
  await scrollTo(page, '#agent'); log('agent-panel');
  let trace = null;
  if (dry) {
    await sleep(1500); await click(page, page.locator('#replay')); log('replay-clicked');
    await page.waitForFunction(() => document.querySelector('#timeline .outcome'), null, {timeout: 180000});
    trace = {state: 'replayed', steps: (await (await fetch('http://127.0.0.1:4178/agent-runs/keyboard-date.json')).json()).steps};
  } else {
    await page.waitForSelector('#run-live:not([hidden])', {timeout: 30000}); await sleep(1800);
    const answer = page.waitForResponse(response => response.url().endsWith('/api/agent') && response.request().method() === 'POST');
    await click(page, page.locator('#run-live'));
    const run = await (await answer).json(); log('run-live', {id: run.id});
    let shown = 0, peeks = 0;
    for (;;) {
      await sleep(2000);
      trace = await (await fetch(PAGE + '/api/agent/' + run.id)).json();
      for (const step of trace.steps.slice(shown)) log('step', {index: shown++, kind: step.kind, attempt: step.attempt ?? null, verified: step.verified ?? null, stage: step.stage ?? null,
        headline: step.headline || step.diagnosis || step.query || step.path || ''});
      // Twice, while the sandbox is booking, show its containers: offline, one per role.
      const verifying = trace.steps.length && ['propose'].includes(trace.steps.at(-1).kind) || !trace.steps.length;
      if (peeks < 2 && verifying && t() - (events.findLast(e => e.event === 'peek')?.t || 0) > 25) {
        await sleep(6000); if ((await (await fetch(PAGE + '/api/agent/' + run.id)).json()).state !== 'running') continue;
        raise(docker); log('peek', {window: 'docker ps'}); await sleep(6500); raise(x('search', '--onlyvisible', '--class', 'chromium').split('\n').pop()); log('peek-end'); peeks++;
      }
      if (trace.state !== 'running') break;
    }
    log('run-finished', {state: trace.state, attempts: trace.steps.filter(s => s.kind === 'verify').length, cost_usd: trace.estimated_cost_usd});
    await sleep(4000);
  }
  // Walk back through the finished run: the false "booked" pages it rejected, then the proof.
  const steps = await page.locator('#timeline li[data-index]').count(), all = trace.steps || [];
  const picks = [];
  const wrong = all.findIndex(s => s.kind === 'verify' && /instead of/.test(s.headline || ''));
  const reopen = all.findIndex(s => s.kind === 'verify' && /reopen/i.test(s.headline || '') && !s.verified);
  const final = all.findLastIndex(s => s.kind === 'verify');
  for (const [index, label] of [[wrong, 'wrong-date'], [reopen, 'wrong-reopen'], [final, 'final']]) if (index >= 0 && index < steps && !picks.some(p => p[0] === index)) picks.push([index, label]);
  for (const [index, label] of picks) {
    const item = page.locator('#timeline li[data-index="' + index + '"] > :first-child');
    await item.scrollIntoViewIfNeeded(); await sleep(500); await click(page, item); log('show-step', {index, label}); await sleep(label === 'final' ? 6000 : 7000);
  }
  if (picks.at(-1)?.[1] === 'final') {
    for (let i = 0; i < 7; i++) { await page.evaluate(() => document.querySelector('#detail').scrollBy({top: 240, behavior: 'smooth'})); await sleep(1100); }
    log('proof-scrolled'); await sleep(2500);
  }
  await finish({run_id: trace.id || null, state: trace.state, verified: trace.state === 'verified'});
  if (!dry && trace.id) fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(trace, null, 2) + '\n');
  void server;
}

async function after() {
  const term = await terminal('af-rows', 'printf "\\033[1;36m$ node scripts/film/serve-app.cjs --rows\\033[0m"; read -r _; node scripts/film/serve-app.cjs --rows; sleep 99999', {geometry: '118x12+60+640'});
  const context = await browserWindow(), page = await context.newPage(); await sleep(1500);
  await record(30);
  await bookingStart(page);
  const [year, month, day] = DATE.split('-'), typed = day + '/' + month + '/' + year;
  await tabTo(page, f => f.id === 'select-date', 12, 750); log('date-field');
  await press(page, 'Control+A', 'Ctrl + A', 400); await type(page, typed); await press(page, 'Enter', 'Enter ↵', 900);
  await tabTo(page, f => f.id === 'select-timezone', 4, 1200);
  // The clinic is in Riyadh: pick that time zone by typing the start of its name into the focused list
  // (native type-ahead), so the slots read in the clinic's own time. If it can't be picked, stay on UTC.
  const prefix = await page.evaluate(() => {
    const options = [...document.getElementById('select-timezone').options].map(o => ({value: o.value, label: o.textContent.trim(), text: o.textContent.trim().toLowerCase()}));
    const target = options.find(o => o.value === 'Asia/Riyadh'); if (!target) return null;
    for (let n = 1; n <= target.text.length; n++) { const p = target.text.slice(0, n); if (options.filter(o => o.text.startsWith(p)).length === 1) return target.label.slice(0, n); }
    return null;
  });
  if (prefix) { await page.evaluate(text => window.__afKey?.('type “' + text + '”'), prefix); await page.keyboard.type(prefix, {delay: 90}); await sleep(1800); }
  const zone = await page.evaluate(() => document.getElementById('select-timezone')?.value), hour = zone === 'Asia/Riyadh' ? 9 : 6;
  log('timezone', {prefix, zone});
  const slot = new RegExp('^0?' + hour + ':00\\s*(?:am)?$', 'i');
  await page.waitForFunction(() => document.querySelectorAll('.available-hour').length > 0, null, {timeout: 15000}).catch(() => {});
  log('hours', {timezone: zone, date_value: await page.evaluate(() => document.getElementById('select-date')?.value)});
  await tabTo(page, f => slot.test(f.text), 60, 380); await press(page, 'Enter', 'Enter ↵', 900); log('slot-chosen');
  await tabTo(page, f => f.id === 'button-next-2', 40, 380); await press(page, 'Enter', 'Enter ↵', 1500);
  for (const [id, value] of [['first-name', CUSTOMER.first], ['last-name', CUSTOMER.last], ['email', CUSTOMER.email], ['phone-number', CUSTOMER.phone]]) {
    await tabTo(page, f => f.id === id, 12, 380); await type(page, value);
  }
  await tabTo(page, f => f.id === 'button-next-3', 20, 380); await press(page, 'Enter', 'Enter ↵', 1800); log('confirm-step');
  for (let i = 0; i < 40; i++) {
    const focus = await focusOf(page);
    if (focus.id === 'book-appointment-submit') break;
    if (['accept-to-terms-and-conditions', 'accept-to-privacy-policy'].includes(focus.id) && !(await page.evaluate(id => document.getElementById(id).checked, focus.id))) await press(page, 'Space', 'Space', 500);
    else await press(page, 'Tab', 'Tab', 380);
  }
  await press(page, 'Enter', 'Enter ↵', 500);
  await page.waitForURL(/booking_confirmation/, {timeout: 20000}); await sleep(3500);
  const hash = /booking_confirmation\/(?:of|index)\/([A-Za-z0-9]+)/.exec(page.url())?.[1]; log('confirmation', {url: page.url(), hash});
  // What was saved: the database, read with the verifier's read-only account.
  raise(term); await sleep(1200); x('key', 'Return'); log('rows-command'); await sleep(9000);
  // Reopen the booking in a fresh browser: the date must still be the one typed.
  const fresh = await browserWindow(), reopened = await fresh.newPage(); await sleep(1200);
  await reopened.goto(APP + '/booking/reschedule/' + hash); await reopened.waitForSelector('#select-service'); await sleep(2200); log('reopened');
  await tabTo(reopened, f => f.id === 'button-next-1', 8, 600); await press(reopened, 'Enter', 'Enter ↵', 2500);
  const shown = await reopened.evaluate(() => document.getElementById('select-date')?.value); log('reopened-date', {value: shown, typed}); await sleep(4000);
  await finish({typed_date: typed, booking_hash: hash, reopened_date: shown});
}

(async () => {
  if (!['before', 'live', 'after'].includes(scene)) throw Error('Pass --scene before|live|after');
  await desktop();
  try { await {before, live, after}[scene](); }
  catch (error) {
    console.error(error.stack || error.message); log('error', {message: error.message});
    try { cp.execFileSync('import', ['-window', 'root', path.join(out, scene + '-error.png')]); } catch {}
    await finish({error: error.message}); process.exitCode = 1;
  } finally {
    await browser?.close().catch(() => {});
    for (const child of children) child.kill();
  }
})();
