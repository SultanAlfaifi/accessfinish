'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {preview, sha} = require('./repair.cjs');

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => sha(JSON.stringify(canonical(value)));
const runtimeRoot = () => path.resolve(process.env.AF_RUNTIME_DIR || path.join(
  process.env.LOCALAPPDATA || process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'),
  'AccessFinish', 'v0.2'));
const terminal = new Set(['verified', 'failed', 'interrupted']);

function createRunStore({root = runtimeRoot(), execute} = {}) {
  fs.mkdirSync(root, {recursive: true});
  const lockFile = path.join(root, 'server.lock');
  function claim() {
    try { fs.writeFileSync(lockFile, JSON.stringify({pid: process.pid}), {flag: 'wx', mode: 0o600}); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const previous = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      let live = true; try { process.kill(previous.pid, 0); } catch (probe) { if (probe.code === 'ESRCH') live = false; }
      if (live) throw Error('Another AccessFinish process owns this runtime. Stop it before using the same evidence directory.');
      fs.unlinkSync(lockFile); fs.writeFileSync(lockFile, JSON.stringify({pid: process.pid}), {flag: 'wx', mode: 0o600});
    }
  }
  claim();
  for (const name of ['proposals', 'runs']) fs.mkdirSync(path.join(root, name), {recursive: true});
  const location = (kind, id) => {
    const pattern = kind === 'proposals' ? /^proposal-[a-f0-9]{32}$/ : /^run-[a-f0-9]{32}$/;
    if (!pattern.test(id || '')) throw Error('Invalid evidence identifier.');
    const file = path.join(root, kind, id + '.json');
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw Error('Evidence links are not allowed.');
    return file;
  };
  const read = (kind, id) => JSON.parse(fs.readFileSync(location(kind, id), 'utf8'));
  const save = (kind, item) => {
    const file = location(kind, item.id), temporary = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(item, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    fs.renameSync(temporary, file);
  };
  let active = null;
  let releaseRequested = false;
  const release = () => {
    releaseRequested = true;
    if (!active && fs.existsSync(lockFile) && JSON.parse(fs.readFileSync(lockFile, 'utf8')).pid === process.pid) fs.unlinkSync(lockFile);
  };
  // The process lock has proved the previous owner is absent.
  // Interrupted runs retain their evidence and never become a verified result.
  for (const file of fs.readdirSync(path.join(root, 'runs'))) {
    if (!/^run-[a-f0-9]{32}\.json$/.test(file)) continue;
    const run = read('runs', file.slice(0, -5));
    if (!terminal.has(run.state)) {
      run.state = 'interrupted'; run.error = 'The server stopped before verification completed.';
      run.finished_at_utc = new Date().toISOString(); save('runs', run);
    }
  }
  function register({files, proposal, origin, model = null, usage = null, estimated_cost_usd_excluding_tax = null, case_id = 'keyboard-date'}) {
    if (!['recorded', 'nebius', 'operator_reference'].includes(origin)) throw Error('Unknown proposal provenance.');
    if (!['keyboard-date', 'customer-phone'].includes(case_id)) throw Error('Unknown repair case.');
    const checked = preview(files, proposal);
    const item = {
      id: 'proposal-' + crypto.randomBytes(16).toString('hex'), created_at_utc: new Date().toISOString(),
      origin, model, usage, estimated_cost_usd_excluding_tax, case_id,
      diagnosis: 'operator_supplied', source_sha256: digest(files), proposal_sha256: digest(proposal),
      files, proposal, preview: checked, applied_to_host: false,
    };
    save('proposals', item); return item;
  }
  function getProposal(id) {
    const item = read('proposals', id);
    if (digest(item.files) !== item.source_sha256 || digest(item.proposal) !== item.proposal_sha256)
      throw Error('The stored proposal or source changed. Request a new proposal.');
    preview(item.files, item.proposal);
    return item;
  }
  function start({proposal_id, approved_proposal_sha256, reviewed}) {
    if (active) throw Error('Another repair is running. Wait for its result.');
    if (typeof execute !== 'function') throw Error('The isolated executor is unavailable. Run npm run demo:setup.');
    const proposal = getProposal(proposal_id);
    if (reviewed !== true || approved_proposal_sha256 !== proposal.proposal_sha256)
      throw Error('Review and approve these exact changes before execution.');
    const run = {
      schema_version: 1, id: 'run-' + crypto.randomBytes(16).toString('hex'), proposal_id,
      proposal_sha256: proposal.proposal_sha256, source_sha256: proposal.source_sha256,
      proposal_origin: proposal.origin, case_id: proposal.case_id || 'keyboard-date', approval: {reviewed: true, proposal_sha256: approved_proposal_sha256,
        at_utc: new Date().toISOString()}, state: 'queued', booking_verified: false,
      started_at_utc: new Date().toISOString(), stages: [],
    };
    save('runs', run); active = run.id;
    const update = (state, detail = {}) => {
      if (!['preparing', 'building', 'booking', 'verifying'].includes(state)) throw Error('Unknown execution stage.');
      run.state = state; run.stages.push({state, at_utc: new Date().toISOString(), ...detail}); save('runs', run);
    };
    setImmediate(async () => {
      try {
        const result = await execute({run: structuredClone(run), proposal: structuredClone(proposal), update, root});
        if (result?.run_id !== run.id || result?.proposal_sha256 !== run.proposal_sha256 ||
            result?.source_sha256 !== run.source_sha256 || (result?.case_id || 'keyboard-date') !== run.case_id) throw Error('The executor returned evidence for a different repair.');
        run.result = result;
        run.booking_verified = result.booking_verified === true;
        run.state = run.booking_verified ? 'verified' : 'failed';
        if (!run.booking_verified) run.error = result.error || 'The independent outcome checks did not pass.';
      } catch (error) {
        run.state = 'failed'; run.booking_verified = false;
        run.error = String(error.message || 'Execution failed.').slice(0, 1000);
      } finally {
        run.finished_at_utc = new Date().toISOString();
        run.duration_ms = Date.parse(run.finished_at_utc) - Date.parse(run.started_at_utc);
        save('runs', run); active = null; if (releaseRequested) release();
      }
    });
    return structuredClone(run);
  }
  function getRun(id) {
    const run = read('runs', id), proposal = getProposal(run.proposal_id);
    if ((run.case_id || 'keyboard-date') !== (proposal.case_id || 'keyboard-date') || run.proposal_sha256 !== proposal.proposal_sha256 || run.source_sha256 !== proposal.source_sha256 ||
        run.approval?.proposal_sha256 !== proposal.proposal_sha256 || run.approval?.reviewed !== true)
      throw Error('Run evidence is not bound to the approved proposal.');
    return run;
  }
  return {register, getProposal, start, getRun, busy: () => active !== null, close: release, root};
}

module.exports = {createRunStore, runtimeRoot, digest};
