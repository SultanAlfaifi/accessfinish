'use strict';
// Serve the pinned Easy!Appointments app on http://127.0.0.1:8080 for the screen-recorded film, so a
// visible browser can use it. The source is the original, or a proposal applied to it, built by the
// same trusted images as the verifier, with a fresh synthetic database. This is not verification: the
// app has a published port here, and nothing it records is evidence.
//   node scripts/film/serve-app.cjs --original
//   node scripts/film/serve-app.cjs --trace <agent trace.json>   (applies the trace's accepted proposal)
//   node scripts/film/serve-app.cjs --rows                       (the saved appointments, read-only account)
//   node scripts/film/serve-app.cjs --stop
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {docker} = require('../../lib/docker.cjs');
const {runtimeRoot} = require('../../lib/runs.cjs');
const fixture = require('../../lib/fixture.cjs');

const LABEL = 'org.accessfinish.film', ORIGIN = 'http://127.0.0.1:8080';
const root = runtimeRoot(), state = path.join(root, 'film', 'app.json');
const argument = flag => process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;
const hardened = (name, user = '1000:1000') => ['--name', name, '--label', LABEL + '=1', '--user', user, '--read-only', '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges=true', '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=128m,uid=1000,gid=1000', '--env', 'HOME=/tmp', '--env', 'TZ=UTC'];
const mount = (name, destination, readonly) => ['--mount', `type=volume,src=${name},dst=${destination}${readonly ? ',readonly' : ''}`];

async function stop() {
  const containers = (await docker(['ps', '-aq', '--filter', 'label=' + LABEL])).split('\n').filter(Boolean);
  if (containers.length) await docker(['rm', '-f', ...containers]);
  const volumes = (await docker(['volume', 'ls', '-q', '--filter', 'label=' + LABEL])).split('\n').filter(Boolean);
  if (volumes.length) await docker(['volume', 'rm', ...volumes]);
  fs.rmSync(path.dirname(state), {recursive: true, force: true});
}

async function serve(proposal) {
  await stop();
  const prepared = fixture.preparation(root), id = 'film-' + crypto.randomBytes(4).toString('hex'), v = {};
  for (const role of ['source', 'db-data', 'db-socket', 'seed', 'reader', 'payload'])
    v[role] = await docker(['volume', 'create', '--label', LABEL + '=1', id + '-' + role]);
  const passwords = {root: crypto.randomBytes(24).toString('hex'), app: crypto.randomBytes(24).toString('hex'), reader: crypto.randomBytes(24).toString('hex')};
  const payload = path.join(root, 'film', 'payload'); fs.mkdirSync(payload, {recursive: true, mode: 0o700});
  fs.writeFileSync(path.join(payload, 'config.php'), `<?php\nclass Config { const BASE_URL='${ORIGIN}'; const LANGUAGE='english'; const DEBUG_MODE=false; const DB_HOST='localhost'; const DB_NAME='af_fixture'; const DB_USERNAME='af_app'; const DB_PASSWORD='${passwords.app}'; }\n`);
  fs.writeFileSync(path.join(payload, 'root-password'), passwords.root);
  fs.writeFileSync(path.join(payload, 'reader.json'), JSON.stringify({user: 'af_reader', password: passwords.reader}));
  const seed = fs.readFileSync(path.join(fixture.PORTABLE, 'fixture.sql'), 'utf8');
  fs.writeFileSync(path.join(payload, '01-init.sql'), `USE af_fixture;\n${seed}\nCREATE USER 'af_app'@'localhost' IDENTIFIED BY '${passwords.app}'; GRANT SELECT,INSERT,UPDATE,DELETE ON af_fixture.* TO 'af_app'@'localhost';\nCREATE USER 'af_reader'@'localhost' IDENTIFIED BY '${passwords.reader}'; GRANT SELECT ON af_fixture.* TO 'af_reader'@'localhost';\n`);
  const init = await docker(['create', ...hardened(id + '-import', '0:0'), '--cap-add', 'CHOWN', ...mount(v.source, '/vol/source'), ...mount(v['db-data'], '/vol/db-data'),
    ...mount(v['db-socket'], '/vol/db-socket'), ...mount(v.seed, '/vol/seed'), ...mount(v.reader, '/vol/reader'), ...mount(v.payload, '/payload'), prepared.images.php,
    'sh', '-eu', '-c', 'chown -R 0:0 /payload; cp -a /opt/original/. /vol/source/; cp /payload/config.php /vol/source/config.php; mkdir -p /vol/source/storage; cp /payload/01-init.sql /payload/root-password /vol/seed/; cp /payload/reader.json /vol/reader/reader.json; chmod 777 /vol/db-socket; chown -R 1000:1000 /vol/source /vol/reader; chown -R 999:999 /vol/db-data /vol/db-socket /vol/seed']);
  await docker(['cp', payload + path.sep + '.', init + ':/payload']); await docker(['start', '-a', init], {timeout: 120000});
  fs.rmSync(payload, {recursive: true, force: true});
  if (proposal) console.log(await docker(['run', '-i', '--rm', ...hardened(id + '-apply'), '--network', 'none', ...mount(v.source, '/app'), prepared.images.compiler, 'node', '/trusted/apply-patch.cjs'], {input: JSON.stringify(proposal), timeout: 60000}));
  console.log(await docker(['run', '--rm', ...hardened(id + '-build'), '--network', 'none', ...mount(v.source, '/app'), prepared.images.compiler, 'node', '/trusted/trusted-build.cjs'], {timeout: 300000}));
  const db = await docker(['run', '-d', ...hardened(id + '-database', '999:999'), '--network', 'none', ...mount(v['db-data'], '/var/lib/mysql'), ...mount(v['db-socket'], '/run/mysqld'),
    ...mount(v.seed, '/seed', true), ...mount(v.seed, '/docker-entrypoint-initdb.d', true), '--env', 'MARIADB_DATABASE=af_fixture', '--env', 'MARIADB_ROOT_PASSWORD_FILE=/seed/root-password',
    prepared.images.database, 'mariadbd', '--skip-networking', '--socket=/run/mysqld/mysqld.sock']);
  for (let count = 0; ; count++) {
    try {
      if (!/init process done/i.test(await docker(['logs', db]))) throw Error('initialising');
      await docker(['exec', db, 'sh', '-eu', '-c', 'mariadb --socket=/run/mysqld/mysqld.sock -uroot --password="$(cat /seed/root-password)" -e "SELECT 1"'], {timeout: 3000}); break;
    } catch (error) { if (count === 90) throw Error('The film database did not become ready.'); await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  await docker(['run', '-d', ...hardened(id + '-app'), '--publish', '127.0.0.1:8080:8080', ...mount(v.source, '/app', true), ...mount(v['db-socket'], '/run/mysqld', true),
    '--tmpfs', '/app/storage:rw,nosuid,nodev,noexec,size=64m,uid=1000,gid=1000', prepared.images.php,
    'php', '-d', 'mysqli.default_socket=/run/mysqld/mysqld.sock', '-d', 'sendmail_path=/bin/true', '-S', '0.0.0.0:8080', '/trusted/trusted-router.php']);
  for (let count = 0; ; count++) {
    try { const page = await fetch(ORIGIN + '/booking'); if ((await page.text()).includes('select-service')) break; } catch {}
    if (count === 60) throw Error('The film app did not answer on ' + ORIGIN + '.');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  fs.mkdirSync(path.dirname(state), {recursive: true});
  fs.writeFileSync(state, JSON.stringify({id, source: proposal ? 'proposal' : 'original', volumes: v, images: prepared.images}, null, 2) + '\n');
  console.log('Easy!Appointments (' + (proposal ? 'patched' : 'original source') + ') at ' + ORIGIN + '/booking');
}

// The saved rows, read by the verifier's own read-only evaluator (a SELECT-only database account).
async function rows() {
  const {id, volumes: v, images} = JSON.parse(fs.readFileSync(state, 'utf8'));
  const out = JSON.parse(await docker(['run', '--rm', ...hardened(id + '-reader-' + Date.now()), '--network', 'none', ...mount(v['db-socket'], '/run/mysqld', true),
    ...mount(v.reader, '/eval-config', true), images.php, 'php', '/trusted/select-evaluator.php']));
  const people = new Map(out.snapshot.customers.map(user => [String(user.id), user]));
  const booked = out.snapshot.appointments.filter(row => row.is_unavailability === '0' || row.is_unavailability === 0);
  console.log('Read-only account af_reader · write denied: ' + out.reader_write_denied + '\n');
  console.log('ea_appointments');
  for (const row of booked) {
    const who = people.get(String(row.id_users_customer)) || {};
    console.log('  start ' + row.start_datetime + '   end ' + row.end_datetime.slice(11) + '   ' + who.first_name + ' ' + who.last_name + '   ' + who.email + '   ' + who.phone_number);
  }
  if (!booked.length) console.log('  (no appointments)');
}

(async () => {
  if (process.argv.includes('--stop')) return stop();
  if (process.argv.includes('--rows')) return rows();
  if (process.argv.includes('--original')) return serve(null);
  const trace = argument('--trace');
  if (!trace) throw Error('Pass --original, --trace <file>, --rows or --stop.');
  const accepted = JSON.parse(fs.readFileSync(trace, 'utf8')).accepted;
  if (!accepted?.proposal?.edits) throw Error('The trace has no accepted proposal with edits.');
  return serve(accepted.proposal);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
