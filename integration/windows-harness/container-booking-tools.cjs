'use strict';
// Host dispatcher: fixed Docker arguments only. No host application-file reads.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const source = require('./container-source-worker.cjs');
const {definitions: existingDefinitions, validate} = require('../agent/tools.cjs');
const CONTEXT = 'desktop-linux', ENDPOINT = 'npipe:////./pipe/dockerDesktopLinuxEngine', LABEL = 'org.accessfinish.isolation.run';
const DOCKER_CLI = 'C:/Users/EXAMPLE/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const ROLES = ['source_worker', 'build', 'evaluator', 'database', 'app'];
const SOURCE_COMMANDS = ['list_source', 'read_source', 'search_source', 'replace_source'];
const TOOL_NAMES = [...SOURCE_COMMANDS, 'show_diff', 'rebuild', 'development_check', 'browser_start', 'browser_inspect', 'browser_press', 'browser_type', 'browser_reload'];
const definitions = existingDefinitions.filter(x => TOOL_NAMES.includes(x.function.name)).map(x => {
  const copy = structuredClone(x);
  if (SOURCE_COMMANDS.includes(copy.function.name)) copy.function.description += ' Only booking.js and components/booking_time_step.php are accessible.';
  if (copy.function.name === 'development_check') copy.function.description = 'Return the last trusted build-artifacts result only.';
  return copy;
});
const sha = source.sha;
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function fail(code) { const e = new Error(code); e.code = code; throw e; }
const EDIT_REJECTIONS = Object.freeze(['replacement_anchor_not_found', 'replacement_anchor_not_unique', 'replacement_line_ending_ambiguous']);
const EDIT_GUIDANCE = 'No source bytes were changed. Read or search the allowed file, use a unique fragment with unambiguous line endings, and submit a new tool call within the remaining budgets.';
function exactKeys(value, names) {
  return value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...names].sort());
}
function validEditRejection(value, error, file, expectedHash) {
  if (!EDIT_REJECTIONS.includes(error) || !source.ALLOWED_PATHS.includes(file) || !/^[a-f0-9]{64}$/.test(expectedHash || '') ||
    !exactKeys(value, ['stage', 'written', 'path', 'source_sha256', 'raw_match_count', 'normalized_match_count', 'source_line_endings', 'reason', 'line_ending_issue']) ||
    value.stage !== 'prewrite' || value.written !== false || value.path !== file || value.source_sha256 !== expectedHash || value.reason !== error ||
    !['raw_match_count', 'normalized_match_count'].every(k => Number.isSafeInteger(value[k]) && value[k] >= 0 && value[k] <= source.MAX_FILE_BYTES) ||
    ![null, 'source_mixed', 'source_bare_cr', 'old_mixed', 'old_bare_cr', 'new_mixed', 'new_bare_cr'].includes(value.line_ending_issue) ||
    (error === 'replacement_line_ending_ambiguous') !== (value.line_ending_issue !== null)) return false;
  const endings = value.source_line_endings;
  if (!exactKeys(endings, ['style', 'crlf', 'lf', 'cr']) ||
    !['crlf', 'lf', 'cr'].every(k => Number.isSafeInteger(endings[k]) && endings[k] >= 0 && endings[k] <= source.MAX_FILE_BYTES) ||
    endings.crlf * 2 + endings.lf + endings.cr > source.MAX_FILE_BYTES || value.raw_match_count > value.normalized_match_count) return false;
  const kinds = Number(endings.crlf > 0) + Number(endings.lf > 0) + Number(endings.cr > 0);
  const style = kinds > 1 ? 'mixed' : endings.crlf ? 'crlf' : endings.lf ? 'lf' : endings.cr ? 'cr' : 'none';
  if (endings.style !== style) return false;
  if (error === 'replacement_anchor_not_found' && value.normalized_match_count !== 0 ||
    error === 'replacement_anchor_not_unique' && value.normalized_match_count < 2) return false;
  if (error !== 'replacement_line_ending_ambiguous' && (endings.cr || style === 'mixed')) return false;
  if (value.line_ending_issue === 'source_bare_cr' && !endings.cr ||
    value.line_ending_issue === 'source_mixed' && (style !== 'mixed' || endings.cr)) return false;
  return true;
}
function isRecoverableEditRejection(value, file) {
  return exactKeys(value, ['changed', 'recoverable', 'error', 'path', 'before_sha256', 'after_sha256', 'rejection', 'guidance']) &&
    value.changed === false && value.recoverable === true && value.path === file && value.before_sha256 === value.after_sha256 &&
    value.guidance === EDIT_GUIDANCE && validEditRejection(value.rejection, value.error, file, value.before_sha256);
}
function roleContract(id, role) {
  if (!/^afiso-[a-f0-9]{16}$/.test(id) || !ROLES.includes(role)) fail('invalid_runtime_role');
  const mounts = {
    source_worker: [['source', '/app', true]], build: [['source', '/app', true]],
    evaluator: [['db-socket', '/run/mysqld', false], ['eval-config', '/eval-config', false]],
    database: [['db-data', '/var/lib/mysql', true], ['db-socket', '/run/mysqld', true], ['db-seed', '/seed', false], ['db-seed', '/docker-entrypoint-initdb.d', false]],
    app: [['source', '/app', false], ['db-socket', '/run/mysqld', false]]
  };
  const memory = ['source_worker', 'build', 'database'].includes(role) ? 768 * 1048576 : 512 * 1048576;
  return {name: id + '-' + role.replace('_', '-'), user: role === 'database' ? '999:999' : '1000:1000', network_mode: 'none',
    allowed_mounts: mounts[role].map(([suffix, destination, rw]) => ({name: id + '-' + suffix, destination, rw})),
    tmpfs: role === 'app' ? ['/tmp', '/app/storage'] : ['/tmp'],
    resources: {memory, memory_swap: memory, nano_cpus: 1000000000, pids_limit: role === 'database' ? 256 : 128}};
}
function validateRuntime(m) {
  if (!m || m.schema_version !== 1 || m.state !== 'LOCAL_CONTAINER_BOOKING_TOOLS_PREPARED' ||
    !/^afiso-[a-f0-9]{16}$/.test(m.id) || m.docker_context !== CONTEXT || m.ownership_label !== LABEL ||
    m.task_url !== 'http://127.0.0.1:8080/booking' || m.source_volume !== m.id + '-source' ||
    m.worker?.path !== source.WORKER_PATH || !/^[a-f0-9]{64}$/.test(m.worker?.sha256 || '') ||
    !same(m.limits, {patch_cycles: 2}) || m.model_calls !== 0 || m.paid_calls !== 0 ||
    m.counts_as_original_G3 !== false || m.live_repair_ready !== false) fail('invalid_booking_runtime');
  if (!m.baseline_source_sha256 || !same(Object.keys(m.baseline_source_sha256).sort(), [...source.ALLOWED_PATHS].sort()) ||
    Object.values(m.baseline_source_sha256).some(x => !/^[a-f0-9]{64}$/.test(x))) fail('invalid_baseline_source_hashes');
  const ids = [];
  for (const role of ROLES) {
    const t = m[role], contract = roleContract(m.id, role);
    if (!t || !/^[a-f0-9]{64}$/.test(t.id || '') || !/^sha256:[a-f0-9]{64}$/.test(t.image_id || '') ||
      Object.entries(contract).some(([key, value]) => !same(t[key], value))) fail('invalid_booking_runtime_tuple');
    ids.push(t.id);
  }
  if (new Set(ids).size !== ROLES.length) fail('runtime_container_ids_not_unique');
  return m;
}
function assertPlainFile(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) fail('absolute_runtime_metadata_required');
  let p = path.resolve(file);
  while (true) {
    const s = fs.lstatSync(p);
    if (s.isSymbolicLink() || (p === path.resolve(file) && (!s.isFile() || s.nlink !== 1 || s.size > 32768))) fail('runtime_metadata_link_or_size_denied');
    const parent = path.dirname(p); if (parent === p) break; p = parent;
  }
}
const COMMANDS = {
  source_worker: ['node', '-e', 'setInterval(()=>{},100000)'],
  build: ['node', '/trusted/trusted-build.cjs'],
  evaluator: ['php', '/trusted/select-evaluator.php'],
  database: ['mariadbd', '--skip-networking', '--socket=/run/mysqld/mysqld.sock'],
  app: ['php', '-d', 'mysqli.default_socket=/run/mysqld/mysqld.sock', '-d', 'sendmail_path=/bin/true',
    '-d', 'SMTP=127.0.0.1', '-d', 'smtp_port=10251', '-S', '127.0.0.1:8080', '/trusted/trusted-router.php']
};
function verifyContainerInfo(info, m, role, running) {
  const t = m[role], h = info?.HostConfig, c = info?.Config;
  if (!t || !h || !c || info.Id !== t.id || info.Name !== '/' + t.name || c.Labels?.[LABEL] !== m.id ||
    info.Image !== t.image_id || c.User !== t.user || (running !== undefined && info.State?.Running !== running) ||
    !same(c.Cmd, COMMANDS[role]) || h.NetworkMode !== 'none' || h.Privileged || h.ReadonlyRootfs !== true ||
    !same(h.CapDrop, ['ALL']) || h.CapAdd?.length ||
    !h.SecurityOpt?.some(x => x === 'no-new-privileges=true' || x === 'no-new-privileges') ||
    h.SecurityOpt?.some(x => /unconfined/i.test(x)) || h.Binds?.length || h.ExtraHosts?.length || h.Devices?.length ||
    (h.PortBindings && Object.keys(h.PortBindings).length) || h.PidMode || h.IpcMode !== 'private' ||
    h.UsernsMode === 'host' || h.CgroupnsMode === 'host') fail('booking_container_boundary_changed');
  const q = t.resources;
  if (h.Memory !== q.memory || h.MemorySwap !== q.memory_swap || h.NanoCpus !== q.nano_cpus ||
    h.PidsLimit !== q.pids_limit || h.ShmSize !== 67108864) fail('booking_container_limits_changed');
  if (!Array.isArray(info.Mounts) || info.Mounts.some(x => x.Type !== 'volume' && x.Type !== 'tmpfs') ||
    !same(info.Mounts.filter(x => x.Type !== 'tmpfs').map(x => ({name: x.Name, destination: x.Destination, rw: x.RW})).sort((a, b) => a.destination.localeCompare(b.destination)),
      [...t.allowed_mounts].sort((a, b) => a.destination.localeCompare(b.destination)))) fail('booking_mounts_changed');
  const expectedTmpfs = Object.fromEntries(t.tmpfs.map(dst => [dst, 'rw,nosuid,nodev,noexec,size=' +
    (dst === '/app/storage' ? '64m' : '128m') + ',uid=1000,gid=1000']));
  if (!same(h.Tmpfs, expectedTmpfs) || info.Mounts.filter(x => x.Type === 'tmpfs').some(x => !t.tmpfs.includes(x.Destination))) fail('booking_tmpfs_changed');
  if ((c.Env || []).some(x => /^(?:NEBIUS|OPENAI|TOKENFACTORY|API_KEY|AF_HOST_SECRET_SENTINEL|DOCKER_)/i.test(x))) fail('booking_provider_environment_denied');
  return info;
}
function minimalEnv() {
  const e = {}; for (const k of ['SystemRoot', 'PATH', 'TEMP', 'TMP', 'USERPROFILE']) if (typeof process.env[k] === 'string') e[k] = process.env[k];
  return e;
}
function inspectJSON(text) {
  let rows; try { rows = JSON.parse(text); } catch { fail('invalid_booking_inspect'); }
  if (!Array.isArray(rows) || rows.length !== 1) fail('invalid_booking_inspect'); return rows[0];
}
const GUARDIAN = "const fs=require('node:fs');const token=process.argv[1];if(!/^[a-f0-9]{32}$/.test(token))process.exit(2);for(const p of fs.readdirSync('/proc').filter(x=>/^[0-9]+$/.test(x))){try{const a=fs.readFileSync('/proc/'+p+'/cmdline','utf8').split('\\0'),s=fs.readFileSync('/proc/'+p+'/status','utf8');if(a.includes('/trusted/container-source-worker.cjs')&&a.includes('--session-token')&&a[a.indexOf('--session-token')+1]===token&&/^Uid:\\s+1000\\s/m.test(s))process.kill(Number(p),'SIGKILL');}catch{}}";
async function createContainerBookingTools(options) {
  if (!options || Object.keys(options).some(k => !['runtimePath', 'runtimeSha256', 'browser', 'event', 'spawnImpl', 'timeoutMs'].includes(k))) fail('unsupported_booking_option');
  const {runtimePath, runtimeSha256, browser = null, event = () => {}, spawnImpl = cp.spawn, timeoutMs = 15000} = options;
  if (!/^[a-f0-9]{64}$/.test(runtimeSha256 || '') || typeof event !== 'function' || typeof spawnImpl !== 'function' ||
    !Number.isInteger(timeoutMs) || timeoutMs < 25 || timeoutMs > 60000) fail('invalid_booking_options');
  assertPlainFile(runtimePath);
  const bytes = fs.readFileSync(runtimePath); if (sha(bytes) !== runtimeSha256) fail('immutable_booking_runtime_changed');
  let m; try { m = validateRuntime(JSON.parse(bytes.toString('utf8'))); } catch (e) { if (e.code) throw e; fail('invalid_booking_runtime_json'); }
  if (m.worker.sha256 !== sha(fs.readFileSync(path.join(__dirname, 'container-source-worker.cjs')))) fail('reviewed_source_worker_changed');
  const active = new Set(), patches = []; let tail = Promise.resolve(), queued = 0, aborted = false, buildCycles = 0, lastBuild = null, patchBytes = 0;
  let knownHashes = {...m.baseline_source_sha256};
  function emit(value) { try { event(value); } catch {} }
  function run(args, {input, maxBytes = 1048576, signal, internal = false} = {}) {
    if ((aborted && !internal) || signal?.aborted) return Promise.reject(Object.assign(new Error('booking_tools_aborted'), {code: 'booking_tools_aborted'}));
    return new Promise((resolve, reject) => {
      let child; try { child = spawnImpl(DOCKER_CLI, ['--context', CONTEXT, ...args], {cwd: path.dirname(DOCKER_CLI), shell: false, windowsHide: true, env: minimalEnv(), stdio: ['pipe', 'pipe', 'pipe']}); }
      catch { return reject(Object.assign(new Error('booking_docker_spawn_failed'), {code: 'booking_docker_spawn_failed'})); }
      let stdout = '', stderrBytes = 0, settled = false;
      const operation = {child, cancel: () => stop('booking_tools_aborted')}; active.add(operation);
      const done = (e, text) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', operation.cancel); active.delete(operation); e ? reject(e) : resolve(text); };
      function stop(code) { child.kill?.(); done(Object.assign(new Error(code), {code})); }
      const timer = setTimeout(() => stop('booking_docker_timeout'), timeoutMs);
      signal?.addEventListener('abort', operation.cancel, {once: true});
      child.stdout.setEncoding?.('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; if (Buffer.byteLength(stdout) > maxBytes) stop('booking_output_limit'); });
      child.stderr.on('data', chunk => { stderrBytes += Buffer.byteLength(chunk); if (stderrBytes > 65536) stop('booking_output_limit'); });
      child.once('error', () => stop('booking_docker_spawn_failed'));
      child.once('close', code => code === 0 ? done(null, stdout) : done(Object.assign(new Error('booking_docker_failed'), {code: 'booking_docker_failed'})));
      try { child.stdin.end(input === undefined ? undefined : input); } catch { stop('booking_docker_stdin_failed'); }
    });
  }
  async function inspect(role, running, opts) { return verifyContainerInfo(inspectJSON(await run(['container', 'inspect', m[role].id], opts)), m, role, running); }
  async function guard(opts) {
    const context = inspectJSON(await run(['context', 'inspect', CONTEXT], opts));
    if (context.Name !== CONTEXT || context.Endpoints?.docker?.Host !== ENDPOINT) fail('local_booking_context_required');
    for (const role of ['source_worker', 'database', 'app']) await inspect(role, true, opts);
    for (const mount of new Map(ROLES.flatMap(role => m[role].allowed_mounts).map(x => [x.name, x])).values()) {
      const v = inspectJSON(await run(['volume', 'inspect', mount.name], opts));
      if (v.Name !== mount.name || v.Labels?.[LABEL] !== m.id || v.Driver !== 'local' || (v.Options && Object.keys(v.Options).length)) fail('booking_volume_boundary_changed');
    }
  }
  async function rpc(command, args, opts = {}) {
    await guard(opts);
    const sum = await run(['exec', '--user', '1000:1000', m.source_worker.id, 'sha256sum', source.WORKER_PATH], opts);
    if (sum.trim() !== m.worker.sha256 + '  ' + source.WORKER_PATH) fail('container_source_worker_changed');
    const token = crypto.randomBytes(16).toString('hex'), packet = {protocol: source.PROTOCOL, id: token, command, args};
    source.validatePacket(packet, token);
    const input = JSON.stringify(packet) + '\n'; if (Buffer.byteLength(input) > source.MAX_REQUEST_BYTES) fail('source_request_too_large');
    let text;
    try { text = await run(['exec', '-i', '--user', '1000:1000', m.source_worker.id, 'node', source.WORKER_PATH, '--session-token', token],
      {...opts, input, maxBytes: source.MAX_RESPONSE_BYTES}); }
    catch (e) {
      try { await inspect('source_worker', true, {internal: true}); await run(['exec', '--user', '1000:1000', m.source_worker.id, 'node', '-e', GUARDIAN, token], {internal: true}); } catch { emit({kind: 'source_worker_cleanup_unverified'}); }
      throw e;
    }
    let reply; try { reply = JSON.parse(text); } catch { fail('invalid_source_worker_reply'); }
    if (reply.protocol !== source.PROTOCOL || reply.id !== token || reply.worker_sha256 !== m.worker.sha256 || typeof reply.ok !== 'boolean' ||
      Object.keys(reply).some(k => !['protocol', 'id', 'ok', 'result', 'error', 'worker_sha256'].includes(k))) fail('invalid_source_worker_reply');
    if (!reply.ok) {
      if (typeof reply.error !== 'string' || !/^[a-z_]{1,80}$/.test(reply.error)) fail('invalid_source_worker_reply');
      // Only reviewed, authenticated prewrite edit rejections may continue.
      // Hash, identity, limit, transport and write failures remain fatal.
      if (command === 'replace_source' && EDIT_REJECTIONS.includes(reply.error)) {
        if (!exactKeys(reply.result, ['rejection']) || !validEditRejection(reply.result.rejection, reply.error, args.path, args.expected_sha256)) fail('invalid_source_edit_rejection');
        return {changed: false, recoverable: true, error: reply.error, path: args.path, before_sha256: args.expected_sha256,
          after_sha256: args.expected_sha256, rejection: reply.result.rejection, guidance: EDIT_GUIDANCE};
      }
      fail(reply.error);
    }
    return reply.result;
  }
  async function checkSourceHashes(opts) {
    const hashes = await rpc('hash_sources', {}, opts);
    if (!same(hashes, knownHashes)) fail('attempt_source_changed_outside_tools');
  }
  await checkSourceHashes();
  async function startTrusted(role, opts) {
    await guard(opts); await inspect(role, false, opts); await checkSourceHashes(opts);
    let output;
    try { output = await run(['start', '-a', m[role].id], opts); }
    catch (e) {
      try { const info = await inspect(role, undefined, {internal: true}); if (info.State.Running) await run(['stop', '--time', '3', m[role].id], {internal: true}); } catch { emit({kind: 'trusted_container_cleanup_unverified', role}); }
      throw e;
    }
    const ended = await inspect(role, false, opts);
    if (ended.State.ExitCode !== 0) fail('trusted_container_nonzero_exit');
    let result; try { result = JSON.parse(output); } catch { fail('invalid_trusted_container_output'); }
    return result;
  }
  function enqueue(fn, opts = {}) {
    if (aborted || opts.signal?.aborted) return Promise.reject(Object.assign(new Error('booking_tools_aborted'), {code: 'booking_tools_aborted'}));
    if (queued >= 16) return Promise.reject(Object.assign(new Error('booking_tools_queue_limit'), {code: 'booking_tools_queue_limit'}));
    queued++;
    const operation = tail.then(() => { if (aborted || opts.signal?.aborted) fail('booking_tools_aborted'); return fn(); }).finally(() => { queued--; });
    tail = operation.catch(() => {}); return operation;
  }
  async function dispatch(name, args, opts) {
    if (SOURCE_COMMANDS.includes(name)) {
      await checkSourceHashes(opts);
      if (name === 'replace_source') {
        if (buildCycles >= 2) fail('patch_cycle_budget');
        if (patchBytes + Buffer.byteLength(args.old) + Buffer.byteLength(args.new) > 131072 || patches.length >= 16) fail('patch_artifact_budget');
        const result = await rpc(name, {...args, expected_sha256: knownHashes[args.path]}, opts);
        if (isRecoverableEditRejection(result, args.path)) {
          // Rejection metadata alone is insufficient: authenticate the full
          // current source hashes again before sending feedback to the model.
          await checkSourceHashes(opts);
          emit({kind: 'source_edit_rejected', path: args.path, error: result.error, written: false});
          return result;
        }
        if (!result || result.changed !== true || result.path !== args.path || result.before_sha256 !== knownHashes[args.path] ||
          !/^[a-f0-9]{64}$/.test(result.after_sha256 || '')) fail('invalid_source_replace_result');
        knownHashes[args.path] = result.after_sha256; patchBytes += Buffer.byteLength(args.old) + Buffer.byteLength(args.new);
        patches.push({...args, before_sha256: result.before_sha256, after_sha256: result.after_sha256});
        lastBuild = null; emit({kind: 'source_fragment_replaced', path: args.path, before_sha256: result.before_sha256, after_sha256: result.after_sha256});
        return {...result, patch_index: patches.length};
      }
      return rpc(name, name === 'read_source' ? {...args, expected_sha256: knownHashes[args.path]} : args, opts);
    }
    if (name === 'show_diff') return structuredClone(patches);
    if (name === 'rebuild') {
      if (buildCycles >= 2) fail('patch_cycle_budget');
      buildCycles++; const result = await startTrusted('build', opts);
      if (result.status !== 'TRUSTED_BUILD_PASS' || result.candidate_configuration_executed !== false || !Array.isArray(result.rows) || result.rows.length !== 83) fail('invalid_trusted_build_result');
      await checkSourceHashes(opts); lastBuild = {status: 'pass', files: result.rows.length, build_sha256: sha(JSON.stringify(result)), patch_cycles: buildCycles};
      emit({kind: 'trusted_container_build', ...lastBuild}); return {...lastBuild, candidate_configuration_executed: false};
    }
    if (name === 'development_check') {
      if (args.id !== 'build-artifacts') fail('public_check_not_allowed');
      return lastBuild ? {development_only: true, ...lastBuild} : {development_only: true, status: 'not_tested', reason: 'rebuild_required'};
    }
    if (name.startsWith('browser_')) {
      if (!browser) fail('browser_adapter_missing');
      const op = {browser_start: () => browser.start(), browser_inspect: () => browser.inspect(), browser_press: () => browser.press(args.key),
        browser_type: () => browser.type(args.text), browser_reload: () => browser.reload()};
      return op[name]();
    }
    fail('unknown_booking_tool');
  }
  return {definitions, patches,
    invoke(name, args, opts = {}) {
      if (!TOOL_NAMES.includes(name)) return Promise.reject(Object.assign(new Error('unknown_booking_tool'), {code: 'unknown_booking_tool'}));
      try { validate(name, args); } catch (e) { return Promise.reject(e); }
      return enqueue(() => dispatch(name, args, opts), opts);
    },
    // Deliberately absent from model definitions/invoke. Caller retains snapshots.
    operatorEvaluate(opts = {}) { return enqueue(async () => {
      const result = await startTrusted('evaluator', opts);
      if (result.uid !== 1000 || result.reader_write_denied !== true || result.reader_system_schema_denied !== true ||
        !result.snapshot || ['appointments', 'customers', 'services', 'providers'].some(k => !Array.isArray(result.snapshot[k]))) fail('invalid_operator_evaluator_result');
      emit({kind: 'operator_select_evaluator', reader_write_denied: true, reader_system_schema_denied: true}); return result;
    }, opts); },
    async abort() { if (aborted) return; aborted = true; for (const operation of [...active]) operation.cancel(); await browser?.abort?.(); await tail; },
    async close() { await tail; if (browser?.close) await browser.close(); },
    get patchCycles() { return buildCycles; }
  };
}
module.exports = {createContainerBookingTools, validateRuntime, verifyContainerInfo, roleContract, COMMANDS, definitions, LABEL, CONTEXT, ENDPOINT, DOCKER_CLI, isRecoverableEditRejection};
