'use strict';
// Host bridge to one immutable, owned container. No host browser or provider imports.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const worker = require('./container-keyboard-booking-worker.cjs');
const OWNER_LABEL = 'org.accessfinish.isolation.run';
const WORKER_PATH = '/trusted/container-keyboard-booking-worker.cjs';
const ENDPOINT = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const CONTEXT = 'desktop-linux';
const SECCOMP_PATH = path.resolve(__dirname, '../exploratory-booking/isolation/browser-seccomp-profile.json');
const SECCOMP_SHA256 = '7df0b3642770487408df9c4d54f92eac46e1f55329872790b1305e2391a7dcc7';
const APP_TMPFS = ['/tmp', '/app/storage'];
const APP_RESOURCES = {memory: 536870912, memory_swap: 536870912, nano_cpus: 1000000000, pids_limit: 128};
const BROWSER_RESOURCES = {memory: 1610612736, memory_swap: 1610612736, nano_cpus: 1000000000, pids_limit: 256, shm_size: 268435456};
// Verified installation on this host; never search an editable working directory.
const DOCKER_CLI = 'C:/Users/EXAMPLE/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const bounded = (value, max) => Number.isSafeInteger(value) && value >= 1 && value <= max;
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function minimalDockerEnv(source = process.env) {
  const result = {};
  for (const key of ['SystemRoot', 'PATH', 'TEMP', 'TMP', 'USERPROFILE']) if (typeof source[key] === 'string') result[key] = source[key];
  return result;
}
function assertPlainFile(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) fail('absolute_runtime_metadata_required');
  let current = path.resolve(file);
  while (true) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (current === path.resolve(file) && (!stat.isFile() || stat.nlink !== 1))) fail('runtime_metadata_link_denied');
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  if (fs.statSync(file).size > 32768) fail('runtime_metadata_too_large');
}
function validateRuntime(m) {
  if (!m || m.schema_version !== 2 || !/^afiso-[a-f0-9]{16}$/.test(m.id) || m.state !== 'LOCAL_BOUNDARY_PASS_REVIEW_REQUIRED' ||
    m.docker_context !== CONTEXT || m.ownership_label !== OWNER_LABEL || m.task_url !== worker.TASK_URL ||
    m.model_calls !== 0 || m.paid_calls !== 0 || m.live_repair_ready !== false) fail('unverified_runtime_metadata');
  const c = m.container, app = m.app;
  if (!c || !app || c.name !== m.id + '-booking-browser-worker' || app.name !== m.id + '-app' ||
    !/^[a-f0-9]{64}$/.test(c.id) || !/^[a-f0-9]{64}$/.test(app.id) || c.id === app.id ||
    !/^sha256:[a-f0-9]{64}$/.test(c.image_id) || !/^sha256:[a-f0-9]{64}$/.test(app.image_id) ||
    c.user !== '1000:1000' || app.user !== '1000:1000' || app.network_mode !== 'none' || c.network_mode !== 'container:' + app.id ||
    m.worker?.path !== WORKER_PATH || !/^[a-f0-9]{64}$/.test(m.worker?.sha256 || '') ||
    !same(m.tmpfs, ['/tmp']) || !same(m.allowed_mounts, []) || !same(m.resources, BROWSER_RESOURCES) ||
    m.browser_seccomp_sha256 !== SECCOMP_SHA256) fail('invalid_owned_browser_contract');
  if (!same(app.tmpfs, APP_TMPFS) || !same(app.resources, APP_RESOURCES) || !same(app.allowed_mounts, [
    {name: m.id + '-source', destination: '/app', rw: false},
    {name: m.id + '-db-socket', destination: '/run/mysqld', rw: false}])) fail('invalid_owned_app_contract');
  return m;
}
function secureCommon(info, runId, expectedId, expectedName) {
  const c = info?.Config, h = info?.HostConfig;
  if (!c || !h || info.Id !== expectedId || info.Name !== '/' + expectedName || c.Labels?.[OWNER_LABEL] !== runId ||
    c.User !== '1000:1000' || info.State?.Running !== true || h.Privileged || !h.ReadonlyRootfs ||
    !h.CapDrop?.includes('ALL') || h.CapAdd?.length || !h.SecurityOpt?.some(x => x === 'no-new-privileges=true' || x === 'no-new-privileges') ||
    h.SecurityOpt?.some(x => /unconfined/i.test(x)) || h.Binds?.length || h.ExtraHosts?.length || h.Devices?.length ||
    (h.PortBindings && Object.keys(h.PortBindings).length) || h.PidMode || h.IpcMode !== 'private' ||
    h.UsernsMode === 'host' || h.CgroupnsMode === 'host' || !Array.isArray(info.Mounts)) fail('owned_runtime_boundary_mismatch');
  for (const env of c.Env || []) if (/^(?:NEBIUS|OPENAI|TOKENFACTORY|AF_HOST_SECRET_SENTINEL|DOCKER_)/i.test(env)) fail('container_provider_environment_denied');
  for (const mount of info.Mounts) if (mount.Type !== 'tmpfs' && (mount.Type !== 'volume' || !mount.Name?.startsWith(runId + '-'))) fail('container_host_mount_denied');
}
function verifyContainerInfo(info, m) {
  secureCommon(info, m.id, m.container.id, m.container.name);
  const h = info.HostConfig;
  if (info.Image !== m.container.image_id || h.NetworkMode !== m.container.network_mode ||
    !bounded(h.Memory, 1536 * 1024 * 1024) || h.MemorySwap !== h.Memory ||
    !bounded(h.NanoCpus, 1e9) || !bounded(h.PidsLimit, 256) ||
    !bounded(h.ShmSize, m.resources.shm_size)) fail('browser_runtime_limits_or_image_changed');
  verifyTmpfs(info, m.tmpfs);
  const seccomp = h.SecurityOpt.filter(x => x.startsWith('seccomp='));
  if (seccomp.length !== 1) fail('browser_seccomp_profile_required');
  assertPlainFile(SECCOMP_PATH);
  const trustedBytes = fs.readFileSync(SECCOMP_PATH);
  if (sha(trustedBytes) !== m.browser_seccomp_sha256 || sha(trustedBytes) !== SECCOMP_SHA256) fail('reviewed_seccomp_hash_changed');
  try { if (!same(JSON.parse(seccomp[0].slice(8)), JSON.parse(trustedBytes))) fail('browser_seccomp_profile_changed'); }
  catch (e) { if (e.code) throw e; fail('browser_seccomp_profile_changed'); }
  const mounts = info.Mounts.filter(x => x.Type !== 'tmpfs');
  if (mounts.length !== m.allowed_mounts.length) fail('browser_mount_set_changed');
  for (const mount of mounts) if (!m.allowed_mounts.some(x => x.name === mount.Name && x.destination === mount.Destination && x.rw === mount.RW)) fail('browser_mount_access_changed');
  for (const mount of info.Mounts.filter(x => x.Type === 'tmpfs')) if (!m.tmpfs.includes(mount.Destination)) fail('unexpected_browser_tmpfs');
  return true;
}
function verifyAppInfo(info, m) {
  secureCommon(info, m.id, m.app.id, m.app.name);
  const h = info.HostConfig;
  if (info.Image !== m.app.image_id || h.NetworkMode !== 'none' || !bounded(h.Memory, APP_RESOURCES.memory) ||
    h.MemorySwap !== h.Memory || !bounded(h.PidsLimit, APP_RESOURCES.pids_limit) ||
    !bounded(h.NanoCpus, APP_RESOURCES.nano_cpus)) fail('app_runtime_limits_or_image_changed');
  verifyTmpfs(info, m.app.tmpfs);
  const mounts = info.Mounts.filter(x => x.Type !== 'tmpfs');
  if (mounts.length !== m.app.allowed_mounts.length) fail('app_mount_set_changed');
  for (const mount of mounts) if (!m.app.allowed_mounts.some(x => x.name === mount.Name && x.destination === mount.Destination && x.rw === mount.RW)) fail('app_mount_access_changed');
  return true;
}
function verifyTmpfs(info, expected) {
  const tmpfs = info.HostConfig.Tmpfs || {};
  if (!same(Object.keys(tmpfs).sort(), [...expected].sort())) fail('tmpfs_set_changed');
  for (const [destination, options] of Object.entries(tmpfs)) {
    if (typeof options !== 'string') fail('tmpfs_options_changed');
    const parts = options.split(',');
    if (!['nosuid', 'nodev', 'noexec', 'uid=1000', 'gid=1000'].every(x => parts.includes(x)) ||
      parts.some(x => ['exec', 'suid', 'dev'].includes(x)) || new Set(parts).size !== parts.length) fail('tmpfs_options_changed');
    const sizes = parts.filter(x => x.startsWith('size='));
    const match = sizes.length === 1 && /^size=([1-9][0-9]*)([kmg]?)$/i.exec(sizes[0]);
    const bytes = match && Number(match[1]) * ({'': 1, k: 1024, m: 1048576, g: 1073741824}[match[2].toLowerCase()]);
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > (destination === '/tmp' ? 128 : 64) * 1048576) fail('tmpfs_size_changed');
    if (parts.filter(x => x.startsWith('uid=')).length !== 1 || parts.filter(x => x.startsWith('gid=')).length !== 1) fail('tmpfs_options_changed');
  }
  for (const mount of info.Mounts.filter(x => x.Type === 'tmpfs')) if (!expected.includes(mount.Destination)) fail('unexpected_tmpfs_mount');
}
function dockerArgs(args) { return ['--context', CONTEXT, ...args]; }
function runDocker(args, {spawnImpl, timeoutMs = 15000}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawnImpl(DOCKER_CLI, dockerArgs(args), {cwd: path.dirname(DOCKER_CLI), shell: false, windowsHide: true, env: minimalDockerEnv(), stdio: ['ignore', 'pipe', 'pipe']}); }
    catch { return reject(Object.assign(new Error('docker_cli_spawn_failed'), {code: 'docker_cli_spawn_failed'})); }
    let stdout = '', stderrBytes = 0, done = false;
    const finish = (error, value) => { if (done) return; done = true; clearTimeout(timer); if (error) reject(error); else resolve(value); };
    const stop = code => { child.kill?.(); finish(Object.assign(new Error(code), {code})); };
    const timer = setTimeout(() => stop('docker_cli_timeout'), timeoutMs);
    child.stdout.setEncoding?.('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; if (Buffer.byteLength(stdout) > 1024 * 1024) stop('docker_cli_output_limit'); });
    child.stderr.on('data', chunk => { stderrBytes += Buffer.byteLength(chunk); if (stderrBytes > 65536) stop('docker_cli_output_limit'); });
    child.once('error', () => stop('docker_cli_spawn_failed'));
    child.once('close', code => code === 0 ? finish(null, stdout) : finish(Object.assign(new Error('docker_cli_failed'), {code: 'docker_cli_failed'})));
  });
}
function parseInspect(text) {
  let rows; try { rows = JSON.parse(text); } catch { fail('invalid_docker_inspect_json'); }
  if (!Array.isArray(rows) || rows.length !== 1) fail('invalid_docker_inspect_json');
  return rows[0];
}
// Fixed process guardian; no shell is used. A PID plus an unguessable session
// token in the exact worker command line prevents killing a reused/foreign PID.
const TERMINATE_WORKER = `const fs=require('node:fs');const token=process.argv[1];if(!/^[a-f0-9]{32}$/.test(token))process.exit(2);const rows=fs.readdirSync('/proc').filter(p=>/^[0-9]+$/.test(p));const found=[];for(const p of rows){try{const a=fs.readFileSync('/proc/'+p+'/cmdline','utf8').split('\\0');const s=fs.readFileSync('/proc/'+p+'/status','utf8');if(a.includes('${WORKER_PATH}')&&a.includes('--session-token')&&a[a.indexOf('--session-token')+1]===token&&/^Uid:\\s+1000\\s/m.test(s))found.push(Number(p));}catch{}}if(found.length>1)process.exit(3);const children=new Map();for(const p of rows){try{const s=fs.readFileSync('/proc/'+p+'/status','utf8');const parent=Number(s.match(/^PPid:\\s+(\\d+)/m)?.[1]);if(/^Uid:\\s+1000\\s/m.test(s)){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(Number(p));}}catch{}}const descend=p=>[...(children.get(p)||[]).flatMap(descend),p];for(const p of found){for(const child of descend(p)){try{process.kill(child,'SIGTERM');}catch{}}}setTimeout(()=>{for(const p of found){try{const a=fs.readFileSync('/proc/'+p+'/cmdline','utf8').split('\\0');if(a.includes('${WORKER_PATH}')&&a[a.indexOf('--session-token')+1]===token){for(const child of descend(p)){try{process.kill(child,'SIGKILL');}catch{}}}}catch{}}console.log(JSON.stringify({matched:found.length,owned_session_terminated:true}));},250);`;

async function createContainerKeyboardBrowser(options) {
  if (!options || Object.keys(options).some(k => !['runtimePath', 'runtimeSha256', 'event', 'timeoutMs', 'spawnImpl', 'redactValues'].includes(k))) fail('unsupported_adapter_option');
  const {runtimePath, runtimeSha256, event = () => {}, timeoutMs = 15000, spawnImpl = cp.spawn, redactValues = []} = options;
  if (!/^[a-f0-9]{64}$/.test(runtimeSha256 || '') || typeof event !== 'function' || typeof spawnImpl !== 'function' ||
    !Number.isInteger(timeoutMs) || timeoutMs < 25 || timeoutMs > 30000 || !Array.isArray(redactValues) ||
    redactValues.some(x => typeof x !== 'string' || x.length === 0)) fail('invalid_adapter_options');
  assertPlainFile(runtimePath);
  const bytes = fs.readFileSync(runtimePath); if (sha(bytes) !== runtimeSha256) fail('immutable_runtime_metadata_changed');
  let m; try { m = validateRuntime(JSON.parse(bytes.toString('utf8'))); } catch (e) { if (e.code) throw e; fail('invalid_runtime_metadata_json'); }
  if (m.worker.sha256 !== sha(fs.readFileSync(path.join(__dirname, 'container-keyboard-booking-worker.cjs')))) fail('reviewed_worker_hash_changed');
  const scrub = value => {
    let text = JSON.stringify(value);
    for (const literal of redactValues) text = text.split(literal).join('[REDACTED]');
    text = text.replace(/\b(?:v1\.[A-Za-z0-9_.-]{35,}|sk-[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9_.-]{20,})/g, '[REDACTED]');
    return JSON.parse(text);
  };
  const emit = value => { try { event(scrub(value)); } catch {} };
  const context = parseInspect(await runDocker(['context', 'inspect', CONTEXT], {spawnImpl, timeoutMs}));
  if (context.Name !== CONTEXT || context.Endpoints?.docker?.Host !== ENDPOINT) fail('local_desktop_linux_context_required');
  verifyAppInfo(parseInspect(await runDocker(['container', 'inspect', m.app.id], {spawnImpl, timeoutMs})), m);
  verifyContainerInfo(parseInspect(await runDocker(['container', 'inspect', m.container.id], {spawnImpl, timeoutMs})), m);
  const sum = await runDocker(['exec', '--user', '1000:1000', m.container.id, 'sha256sum', WORKER_PATH], {spawnImpl, timeoutMs});
  if (sum.trim() !== m.worker.sha256 + '  ' + WORKER_PATH) fail('container_worker_hash_changed');
  emit({kind: 'container_keyboard_boundary_verified', run_id: m.id, container_id: m.container.id, worker_sha256: m.worker.sha256});
  const token = crypto.randomBytes(16).toString('hex');
  let child;
  try { child = spawnImpl(DOCKER_CLI, dockerArgs(['exec', '-i', '--user', '1000:1000', m.container.id, 'node', WORKER_PATH, '--session-token', token]),
    {cwd: path.dirname(DOCKER_CLI), shell: false, windowsHide: true, env: minimalDockerEnv(), stdio: ['pipe', 'pipe', 'pipe']}); }
  catch { fail('docker_worker_spawn_failed'); }
  let buffer = '', stderrBytes = 0, hello = false, pending = null, fatal = null, closing = false, closed = false,
    tail = Promise.resolve(), nextId = 0, queuedCount = 0, cleanupPromise = null, helloResolve, helloReject;
  const ready = new Promise((resolve, reject) => { helloResolve = resolve; helloReject = reject; });
  const helloTimer = setTimeout(() => poison('worker_handshake_timeout'), timeoutMs);
  const terminate = () => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      try { child.stdin.end(); } catch {}
      // Never stop a container or another run. Terminate only this exact session.
      try { await runDocker(['exec', '--user', '1000:1000', m.container.id, 'node', '-e', TERMINATE_WORKER, token],
        {spawnImpl, timeoutMs: Math.max(1000, Math.min(timeoutMs, 5000))}); } catch { emit({kind: 'container_keyboard_cleanup_unverified', run_id: m.id}); }
      child.kill?.();
    })();
    return cleanupPromise;
  };
  function poison(code) {
    if (fatal) return; fatal = Object.assign(new Error(code), {code}); closing = true;
    clearTimeout(helloTimer); helloReject(fatal);
    if (pending) { clearTimeout(pending.timer); pending.reject(fatal); pending = null; }
    emit({kind: 'container_keyboard_stopped', reason: code}); terminate().catch(() => {});
  }
  function packet(value) {
    if (!hello) {
      const h = value?.result;
      if (value?.id !== 0 || value.ok !== true || h?.protocol !== worker.PROTOCOL || h.worker_sha256 !== m.worker.sha256 ||
        h.session_token !== token || !Number.isSafeInteger(h.worker_pid) || h.worker_pid < 2) return poison('invalid_worker_handshake');
      hello = true; clearTimeout(helloTimer); helloResolve(); return;
    }
    if (!pending || value?.id !== pending.id || typeof value.ok !== 'boolean') return poison('unexpected_worker_response');
    const current = pending; pending = null; clearTimeout(current.timer);
    if (!value.ok) {
      if (typeof value.error !== 'string' || !/^[a-z_]{1,80}$/.test(value.error)) { current.reject(Object.assign(new Error('invalid_worker_error'), {code: 'invalid_worker_error'})); return poison('invalid_worker_error'); }
      current.reject(Object.assign(new Error(value.error), {code: value.error})); return;
    }
    let result;
    try {
      if (current.command === 'close') {
        if (value.result?.closed !== true || Object.keys(value.result).length !== 1) fail('invalid_worker_close');
        result = {closed: true};
      } else result = worker.diagnosticShape(value.result);
    } catch { current.reject(Object.assign(new Error('invalid_worker_diagnostic'), {code: 'invalid_worker_diagnostic'})); return poison('invalid_worker_diagnostic'); }
    current.resolve(scrub(result));
  }
  child.stdout.setEncoding?.('utf8');
  child.stdout.on('data', chunk => {
    if (fatal) return; buffer += chunk;
    if (Buffer.byteLength(buffer) > worker.MAX_RESPONSE_BYTES && !buffer.includes('\n')) return poison('worker_response_size_limit');
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      if (!line || Buffer.byteLength(line) > worker.MAX_RESPONSE_BYTES) return poison('worker_response_size_limit');
      let value; try { value = JSON.parse(line); } catch { return poison('invalid_worker_json'); }
      packet(value); if (fatal) return;
    }
    if (Buffer.byteLength(buffer) > worker.MAX_RESPONSE_BYTES) poison('worker_response_size_limit');
  });
  child.stderr.on('data', chunk => { stderrBytes += Buffer.byteLength(chunk); if (stderrBytes > 65536) poison('worker_stderr_size_limit'); });
  child.once('error', () => poison('worker_process_error'));
  child.once('close', () => { if (!closed && !fatal) poison('worker_process_closed'); });
  try { await ready; } catch (e) { await terminate(); throw e; }
  function dispatch(command, extra = {}) {
    if (fatal) return Promise.reject(fatal);
    if (closed) return Promise.reject(Object.assign(new Error('browser_closed'), {code: 'browser_closed'}));
    return new Promise((resolve, reject) => {
      const id = ++nextId, message = {id, command, ...extra};
      worker.validateCommand(message);
      const timer = setTimeout(() => poison('browser_command_timeout'), timeoutMs);
      pending = {id, command, resolve, reject, timer};
      try { child.stdin.write(JSON.stringify(message) + '\n'); } catch { poison('worker_stdin_failed'); }
    });
  }
  function enqueue(command, extra = {}) {
    try { worker.validateCommand({id: 1, command, ...extra}); } catch (e) { return Promise.reject(e); }
    if (fatal) return Promise.reject(fatal);
    if (closing || closed) return Promise.reject(Object.assign(new Error('browser_closed'), {code: 'browser_closed'}));
    if (queuedCount >= 16) return Promise.reject(Object.assign(new Error('browser_queue_limit'), {code: 'browser_queue_limit'}));
    queuedCount++;
    const operation = tail.then(() => dispatch(command, extra)).finally(() => { queuedCount--; }); tail = operation.catch(() => {}); return operation;
  }
  const inspectEvent = async (kind, operation, extra = {}) => {
    const state = await operation; emit({kind, ...extra, state}); return state;
  };
  return {
    start: () => inspectEvent('browser_initial_navigation', enqueue('start'), {url: worker.TASK_URL}),
    inspect: () => inspectEvent('browser_diagnostic', enqueue('inspect')),
    press: key => inspectEvent('keyboard_press', enqueue('press', {key}), {key}),
    type: text => inspectEvent('keyboard_type', enqueue('type', {text}), {characters: typeof text === 'string' ? text.length : null}),
    reload: () => inspectEvent('browser_reload', enqueue('reload')),
    // Operator-only; never include this method in model tool definitions.
    reopen: hash => inspectEvent('operator_booking_reopen', enqueue('reopen', {hash})),
    async close() {
      if (closed) return;
      if (closing) { if (fatal) await terminate(); else await tail; return; }
      closing = true;
      const operation = tail.then(() => dispatch('close')); tail = operation.catch(() => {});
      try { await operation; closed = true; clearTimeout(helloTimer); child.stdin.end(); emit({kind: 'container_keyboard_closed'}); }
      catch (e) { await terminate(); throw e; }
    },
    async abort() { if (closed) return; poison('browser_aborted'); closed = true; await terminate(); }
  };
}
module.exports = {createContainerKeyboardBrowser, createKeyboardBrowser: createContainerKeyboardBrowser,
  createContainerKeyboardBookingBrowser: createContainerKeyboardBrowser,
  validateRuntime, verifyContainerInfo, verifyAppInfo, minimalDockerEnv, assertPlainFile, OWNER_LABEL, WORKER_PATH, TERMINATE_WORKER};
