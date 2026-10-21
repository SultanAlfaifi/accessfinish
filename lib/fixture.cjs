'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {docker, inspect, localEngine} = require('./docker.cjs');
const {runtimeRoot, digest} = require('./runs.cjs');
const {sha} = require('./repair.cjs');
const PROJECT = path.resolve(__dirname, '..'), PORTABLE = path.join(PROJECT, 'integration', 'portable');
const LABEL = 'org.accessfinish.run';
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', {mode: 0o600});
function fixtureFingerprint() {
  return digest([...fs.readdirSync(PORTABLE).filter(name => !name.endsWith('.md')).sort().map(name =>
    [name, sha(fs.readFileSync(path.join(PORTABLE, name)))]), ['lib/repair.cjs', sha(fs.readFileSync(path.join(__dirname, 'repair.cjs')))]]);
}
function preparation(root = runtimeRoot()) {
  const file = path.join(root, 'fixture', 'prepared.json');
  if (!fs.existsSync(file)) throw Error('The fixture is not prepared. Run npm run demo:setup with Docker running.');
  const prepared = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (prepared.fingerprint !== fixtureFingerprint()) throw Error('Fixture code changed. Run npm run demo:setup again.');
  return prepared;
}
async function setup({root = runtimeRoot(), progress = console.log} = {}) {
  const engine = await localEngine(), lock = require('../integration/portable/source-lock.json');
  if (sha(fs.readFileSync(path.join(PORTABLE, lock.archive))) !== lock.sha256) throw Error('The pinned source archive changed.');
  const fixtureDir = path.join(root, 'fixture'); fs.mkdirSync(fixtureDir, {recursive: true});
  const officialFile = path.join(PORTABLE, 'images.lock.json');
  const tags = {node: 'node:22-bookworm-slim', php: 'php:8.4.24-cli-bookworm', composer: 'composer:2', browser: 'mcr.microsoft.com/playwright:v1.62.1-noble', database: 'mariadb:11.4.8'};
  const official = fs.existsSync(officialFile) ? JSON.parse(fs.readFileSync(officialFile, 'utf8')) : {};
  for (const [role, tag] of Object.entries(tags)) {
    const reference = official[role]?.digest || tag;
    let image;
    try { image = await inspect('image', reference); }
    catch { progress('Pulling ' + reference); await docker(['pull', reference], {timeout: 600000, progress}); image = await inspect('image', reference); }
    const immutable = image.RepoDigests?.find(value => value.includes('@sha256:'));
    if (!immutable) throw Error('Missing official image digest for ' + role);
    if (official[role] && immutable !== official[role].digest && !image.RepoDigests.includes(official[role].digest)) throw Error('Official image identity changed.');
    official[role] = {tag, digest: official[role]?.digest || immutable};
  }
  if (!fs.existsSync(officialFile)) write(officialFile, official);
  const fingerprint = fixtureFingerprint(), images = {database: official.database.digest};
  for (const role of ['php', 'compiler', 'browser']) {
    const tag = 'accessfinish-v02-' + role + ':' + fingerprint.slice(0, 12);
    progress('Building the trusted ' + role + ' image.');
    const args = ['build', '--target', role, '-f', path.join(PORTABLE, 'Dockerfile'), '-t', tag];
    for (const [name, value] of Object.entries({NODE_IMAGE: official.node.digest, PHP_IMAGE: official.php.digest, COMPOSER_IMAGE: official.composer.digest, BROWSER_IMAGE: official.browser.digest})) args.push('--build-arg', name + '=' + value);
    await docker([...args, PROJECT], {timeout: 1200000, progress});
    images[role] = (await inspect('image', tag)).Id;
  }
  const result = {schema_version: 1, prepared_at_utc: new Date().toISOString(), fingerprint, source: lock, official_images: official, images, engine};
  write(path.join(fixtureDir, 'prepared.json'), result); progress('Isolated fixture images are ready. No model call was made.');
  return result;
}
function scenario(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
  const date = new Date(today + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + 7);
  date.setUTCDate(date.getUTCDate() + (8 - date.getUTCDay()) % 7);
  return {date: date.toISOString().slice(0, 10), start: '09:00', end: '09:30', timezone: 'Asia/Riyadh', service_id: 1, provider_id: 2,
    customer: {first_name: 'Synthetic', last_name: 'ExploratoryBooking', email: 'exploratory-booking@example.invalid', phone_number: '0000000000'}};
}
const volume = (name, destination, readonly = false) => ['--mount', `type=volume,src=${name},dst=${destination}${readonly ? ',readonly' : ''}`];
function common(id, name, {user = '1000:1000', network = 'none', memory = '768m', pids = '256'} = {}) {
  return ['--name', name, '--label', LABEL + '=' + id, '--user', user, '--network', network, '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges=true', '--ipc', 'private', '--pids-limit', pids, '--memory', memory, '--memory-swap', memory,
    '--cpus', '1', '--init', '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=128m,uid=1000,gid=1000', '--env', 'HOME=/tmp', '--env', 'TZ=UTC'];
}
async function execute({run, proposal, update, root = runtimeRoot(), original = false}) {
  await localEngine(); const prepared = preparation(root), id = run.id;
  if (!/^run-[a-f0-9]{32}$/.test(id)) throw Error('Invalid isolated run ID.');
  const dir = path.join(root, 'execution', id); fs.mkdirSync(dir, {recursive: true});
  const secretDir = path.join(dir, 'private'); fs.mkdirSync(secretDir, {mode: 0o700});
  const containers = [], volumes = [], manifest = {run_id: id, proposal_sha256: run.proposal_sha256, source_sha256: run.source_sha256,
    fixture_fingerprint: prepared.fingerprint, source_commit: prepared.source.commit, scenario: scenario(), booking_verified: false,
    proposal_origin: proposal.origin, native_keyboard_only: false, model_calls_during_execution: 0, execution_started_at_utc: new Date().toISOString()};
  const save = () => write(path.join(dir, 'evidence.json'), manifest);
  const create = async (role, args, image, command, options = {}) => {
    const name = id + '-' + role;
    const container = await docker(['create', ...common(id, name, options), ...args, image, ...command]);
    containers.push({role, name, id: container}); return container;
  };
  const start = async (container, input) => {
    const output = await docker(['start', '-a', ...(input ? ['-i'] : []), container], {timeout: 180000, ...(input ? {input} : {})});
    const info = await inspect('container', container);
    if (info.State.ExitCode !== 0) throw Error('Isolated worker failed: ' + info.Name);
    return output;
  };
  const snapshot = async container => {
    const result = JSON.parse(await start(container));
    if (result.reader_write_denied !== true || result.reader_system_schema_denied !== true || result.uid !== 1000) throw Error('Independent reader boundary failed.');
    return result.snapshot;
  };
  try {
    update('preparing');
    const v = {};
    for (const role of ['source', 'db-data', 'db-socket', 'seed', 'reader', 'payload']) {
      v[role] = await docker(['volume', 'create', '--label', LABEL + '=' + id, id + '-' + role]); volumes.push(v[role]);
    }
    const passwords = {root: crypto.randomBytes(24).toString('hex'), app: crypto.randomBytes(24).toString('hex'), reader: crypto.randomBytes(24).toString('hex')};
    const payload = path.join(secretDir, 'payload'); fs.mkdirSync(payload);
    fs.writeFileSync(path.join(payload, 'config.php'), `<?php\nclass Config { const BASE_URL='http://127.0.0.1:8080'; const LANGUAGE='english'; const DEBUG_MODE=false; const DB_HOST='localhost'; const DB_NAME='af_fixture'; const DB_USERNAME='af_app'; const DB_PASSWORD='${passwords.app}'; }\n`);
    fs.writeFileSync(path.join(payload, 'root-password'), passwords.root);
    write(path.join(payload, 'reader.json'), {user: 'af_reader', password: passwords.reader});
    const seed = fs.readFileSync(path.join(PORTABLE, 'fixture.sql'), 'utf8');
    if (/(?:CREATE|DROP)\s+(?:DATABASE|USER)|\bUSE\s+|\bGRANT\s+/i.test(seed)) throw Error('Fixture SQL escaped its schema.');
    const reserved = `INSERT INTO ea_users(id,first_name,last_name,email,phone_number,id_roles) VALUES(900,'Reserved','Synthetic','reserved@example.invalid','0000000000',3);\nINSERT INTO ea_appointments(id,start_datetime,end_datetime,id_users_provider,id_users_customer,id_services,is_unavailability,hash,color,status,notes) VALUES(900,'${manifest.scenario.date} 10:00:00','${manifest.scenario.date} 10:30:00',2,900,1,0,'SyntheticReservedSlot','#7cbae8','Booked','Preservation control');\n`;
    fs.writeFileSync(path.join(payload, '01-init.sql'), `USE af_fixture;\n${seed}\n${reserved}\nCREATE USER 'af_app'@'localhost' IDENTIFIED BY '${passwords.app}'; GRANT SELECT,INSERT,UPDATE,DELETE ON af_fixture.* TO 'af_app'@'localhost';\nCREATE USER 'af_reader'@'localhost' IDENTIFIED BY '${passwords.reader}'; GRANT SELECT ON af_fixture.* TO 'af_reader'@'localhost';\n`);
    const init = await create('import', [...volume(v.source, '/vol/source'), ...volume(v['db-data'], '/vol/db-data'), ...volume(v['db-socket'], '/vol/db-socket'),
      ...volume(v.seed, '/vol/seed'), ...volume(v.reader, '/vol/reader'), ...volume(v.payload, '/payload'), '--cap-add', 'CHOWN'], prepared.images.php,
    ['sh', '-eu', '-c', 'chown -R 0:0 /payload; cp -a /opt/original/. /vol/source/; cp /payload/config.php /vol/source/config.php; mkdir -p /vol/source/storage; cp /payload/01-init.sql /payload/root-password /vol/seed/; cp /payload/reader.json /vol/reader/reader.json; chmod 777 /vol/db-socket; chown -R 1000:1000 /vol/source /vol/reader; chown -R 999:999 /vol/db-data /vol/db-socket /vol/seed'], {user: '0:0'});
    await docker(['cp', payload + path.sep + '.', init + ':/payload']); await start(init);
    if (!original) {
      const applied = await docker(['run', '-i', '--rm', ...common(id, id + '-apply'), ...volume(v.source, '/app'), prepared.images.compiler, 'node', '/trusted/apply-patch.cjs'], {input: JSON.stringify(proposal.proposal), timeout: 60000});
      manifest.applied_source = JSON.parse(applied);
    }
    update('building');
    const build = await create('build', volume(v.source, '/app'), prepared.images.compiler, ['node', '/trusted/trusted-build.cjs']);
    manifest.build = JSON.parse(await start(build));
    const db = await create('database', [...volume(v['db-data'], '/var/lib/mysql'), ...volume(v['db-socket'], '/run/mysqld'), ...volume(v.seed, '/seed', true),
      ...volume(v.seed, '/docker-entrypoint-initdb.d', true), '--env', 'MARIADB_DATABASE=af_fixture', '--env', 'MARIADB_ROOT_PASSWORD_FILE=/seed/root-password'], prepared.images.database,
    ['mariadbd', '--skip-networking', '--socket=/run/mysqld/mysqld.sock'], {user: '999:999'});
    await docker(['start', db]); let ready = false;
    for (let count = 0; count < 90; count++) {
      try {
        await docker(['exec', db, 'sh', '-eu', '-c', 'mariadb --socket=/run/mysqld/mysqld.sock -uroot --password="$(cat /seed/root-password)" --batch --skip-column-names -e "SELECT COUNT(*) FROM af_fixture.ea_users;"'], {timeout: 3000}); ready = true; break;
      } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    if (!ready) throw Error('The isolated database did not become ready. Inspect the retained run resources.');
    const evaluator = await create('evaluator', [...volume(v['db-socket'], '/run/mysqld', true), ...volume(v.reader, '/eval-config', true)], prepared.images.php, ['php', '/trusted/select-evaluator.php']);
    manifest.before = await snapshot(evaluator);
    const app = await create('app', [...volume(v.source, '/app', true), ...volume(v['db-socket'], '/run/mysqld', true), '--tmpfs', '/app/storage:rw,nosuid,nodev,noexec,size=64m,uid=1000,gid=1000'], prepared.images.php,
      ['php', '-d', 'mysqli.default_socket=/run/mysqld/mysqld.sock', '-d', 'sendmail_path=/bin/true', '-S', '127.0.0.1:8080', '/trusted/trusted-router.php']);
    await docker(['start', app]);
    for (let count = 0; count < 30; count++) {
      try { await docker(['exec', app, 'php', '-r', "$s=@file_get_contents('http://127.0.0.1:8080/booking');exit(is_string($s)&&str_contains($s,'select-service')?0:1);"]); break; }
      catch (error) { if (count === 29) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    const browser = async (role, operation, payload) => {
      const container = await create(role, ['-i', '--shm-size', '256m', '--security-opt', 'seccomp=' + path.join(PORTABLE, 'browser-seccomp-profile.json')], prepared.images.browser,
        ['node', '/trusted/case-worker.cjs', operation], {network: 'container:' + app, memory: '1536m'});
      return JSON.parse(await start(container, JSON.stringify(payload)));
    };
    const reopenedRecord = async (before, after, customer, role) => {
      const addedRows = after.appointments.filter(row => !before.appointments.some(old => String(old.id) === String(row.id)));
      if (addedRows.length !== 1) return null;
      const observation = await browser(role, 'observe', {booking_hash: addedRows[0].hash}), postReopen = await snapshot(evaluator);
      const observedCustomer = observation.after_next2?.customer;
      return {observation, post_reopen: postReopen, booking: addedRows[0], contact_matches: observedCustomer?.email === customer.email && observedCustomer?.['phone-number'] === customer.phone_number,
        reopened: {url: observation.after_next2?.url, selected_date_iso: observation.after_next1?.date?.selected_date_iso,
          customer: observedCustomer?.['first-name'], last: observedCustomer?.['last-name'], db_unchanged: digest(postReopen) === digest(after)}};
    };
    update('booking');
    manifest.keyboard = await browser('keyboard', 'keyboard', {scenario: manifest.scenario});
    manifest.native_keyboard_only = manifest.keyboard.native_keyboard_only === true;
    update('verifying'); manifest.after = await snapshot(evaluator);
    const mainReopen = await reopenedRecord(manifest.before, manifest.after, manifest.scenario.customer, 'observer');
    if (mainReopen) Object.assign(manifest, {observer: mainReopen.observation, post_reopen: mainReopen.post_reopen, booking: mainReopen.booking});
    const {evaluate} = require('../integration/portable/outcome-evaluator.cjs');
    const violations = [];
    if (!manifest.native_keyboard_only || manifest.keyboard.workflow?.status !== 'confirmation_observed') violations.push('keyboard_task_incomplete');
    if (manifest.observer?.after_next1?.date?.ambiguous) violations.push('ambiguous_reopen_date');
    if (mainReopen && !mainReopen.contact_matches) violations.push('reopened_contact_mismatch');
    manifest.evaluation = evaluate({before: manifest.before, after: manifest.after,
      task: {kind: 'booking', target_date: manifest.scenario.date, start_time: '09:00:00', duration_minutes: 30, customer: manifest.scenario.customer}, reopened: mainReopen?.reopened, violations});
    manifest.keyboard_booking_verified = manifest.evaluation.pass && manifest.build.status === 'TRUSTED_BUILD_PASS';
    if (manifest.keyboard_booking_verified) {
      const pointerDate = new Date(manifest.scenario.date + 'T12:00:00Z'); pointerDate.setUTCDate(pointerDate.getUTCDate() + 7);
      const pointerCustomer = {...manifest.scenario.customer, last_name: 'PointerControl', email: 'pointer-control@example.invalid'};
      manifest.controls = {before: manifest.post_reopen, pointer_date: pointerDate.toISOString().slice(0, 10), pointer_customer: pointerCustomer};
      manifest.controls.browser = await browser('controls', 'controls', {scenario: {...manifest.scenario, pointer_date: manifest.controls.pointer_date, pointer_customer: pointerCustomer}});
      manifest.controls.after = await snapshot(evaluator);
      const pointerReopen = await reopenedRecord(manifest.controls.before, manifest.controls.after, pointerCustomer, 'pointer-observer');
      manifest.controls.reopen = pointerReopen;
      manifest.controls.evaluation = evaluate({before: manifest.controls.before, after: manifest.controls.after,
        task: {kind: 'booking', target_date: manifest.controls.pointer_date, start_time: '09:00:00', duration_minutes: 30, customer: pointerCustomer},
        reopened: pointerReopen?.reopened, violations: pointerReopen?.contact_matches && !pointerReopen.observation.after_next1?.date?.ambiguous ? [] : ['pointer_reopen_mismatch']});
      manifest.controls.pass = manifest.controls.browser.pass && manifest.controls.evaluation.pass;
    }
    manifest.boundaries = await Promise.all(containers.map(async resource => {
      const info = await inspect('container', resource.id), host = info.HostConfig;
      const report = {role: resource.role, user: info.Config.User, network: host.NetworkMode, root_readonly: host.ReadonlyRootfs,
        dropped_capabilities: (host.CapDrop || []).map(capability => capability.replace(/^CAP_/, '')),
        added_capabilities: (host.CapAdd || []).map(capability => capability.replace(/^CAP_/, '')), security_options: host.SecurityOpt || [],
        memory_limit_bytes: host.Memory, cpu_limit_nanocpus: host.NanoCpus, pid_limit: host.PidsLimit,
        mounts: info.Mounts.map(mount => ({destination: mount.Destination, type: mount.Type, writable: mount.RW})),
        model_key_environment_present: info.Config.Env.some(entry => /^(?:NEBIUS|OPENAI|ANTHROPIC).*KEY=/i.test(entry))};
      report.pass = report.root_readonly && report.dropped_capabilities.includes('ALL') && report.security_options.some(option => option.startsWith('no-new-privileges')) &&
        report.memory_limit_bytes > 0 && report.cpu_limit_nanocpus > 0 && report.pid_limit > 0 && !report.model_key_environment_present &&
        (report.network === 'none' || report.network === 'container:' + app) &&
        (resource.role === 'import' ? report.user === '0:0' && report.added_capabilities.every(capability => capability === 'CHOWN') : report.user === (resource.role === 'database' ? '999:999' : '1000:1000') && report.added_capabilities.length === 0);
      return report;
    }));
    manifest.boundaries_verified = manifest.boundaries.every(report => report.pass);
    manifest.booking_verified = manifest.keyboard_booking_verified && manifest.controls?.pass === true && manifest.boundaries_verified;
    if (!manifest.booking_verified) manifest.error = 'Outcome verification failed: ' + (manifest.evaluation.reasons.join(', ') || 'regression controls or runtime boundaries did not pass');
    save(); return manifest;
  } catch (error) {
    manifest.booking_verified = false; manifest.error = error.message; save(); throw error;
  } finally {
    manifest.execution_finished_at_utc = new Date().toISOString();
    manifest.execution_duration_ms = Date.parse(manifest.execution_finished_at_utc) - Date.parse(manifest.execution_started_at_utc);
    manifest.resources = {containers, volumes, label: LABEL, run_id: id}; save();
    // Stop only this run's verified owned application/database; retain resources for diagnosis.
    for (const resource of containers) {
      try { const info = await inspect('container', resource.id); if (info.Config.Labels?.[LABEL] === id && info.State.Running) await docker(['stop', '-t', '3', resource.id]); } catch {}
    }
  }
}
module.exports = {setup, preparation, fixtureFingerprint, scenario, execute, PORTABLE};
