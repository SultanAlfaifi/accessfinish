'use strict';
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const {PATHS, sha} = require('./repair.cjs');
function originalFiles() {
  const base = path.join(__dirname, '../integration/portable'), lock = require('../integration/portable/source-lock.json');
  const compressed = fs.readFileSync(path.join(base, lock.archive));
  if (sha(compressed) !== lock.sha256) throw Error('The pinned source archive changed.');
  const tar = zlib.gunzipSync(compressed, {maxOutputLength: 64 * 1024 * 1024}), found = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512); if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim(), 8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw Error('Invalid pinned source archive.');
    if (PATHS.includes(name)) found.set(name, tar.subarray(offset + 512, offset + 512 + size).toString('utf8'));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (found.size !== PATHS.length) throw Error('The pinned booking source files are missing.');
  return PATHS.map(path => ({path, content: found.get(path)}));
}
function contextForCase() {
  // Complete pinned files only. Artificial excerpt markers are not source and
  // must never be available as candidate replacement anchors.
  return originalFiles();
}
module.exports = {originalFiles, contextForCase};
