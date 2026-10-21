'use strict';
(function (root) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  async function digest(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function validate({featured, files, run}) {
    const proposalHash = await digest(featured.proposal), sourceHash = await digest(files);
    if (featured.proposal_sha256 !== proposalHash || run.proposal_sha256 !== proposalHash || run.source_sha256 !== sourceHash ||
        run.approval?.proposal_sha256 !== proposalHash || run.approval?.reviewed !== true ||
        !['verified', 'failed', 'interrupted'].includes(run.state)) throw Error('The recorded evidence does not match this exact proposal and source.');
    if (run.result && (run.result.run_id !== run.id || run.result.proposal_sha256 !== proposalHash || run.result.source_sha256 !== sourceHash)) throw Error('The recorded result belongs to a different execution.');
    if (run.state === 'verified' && (run.booking_verified !== true || run.result?.booking_verified !== true)) throw Error('The recorded result did not pass verification.');
    return true;
  }
  const api = {digest, validate};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AccessFinishRecording = api;
})(globalThis);
