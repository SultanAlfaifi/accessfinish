'use strict';
// One fixed request, two fixed source files, no shell or candidate imports.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const PROTOCOL = 'accessfinish-container-source-v1';
const WORKER_PATH = '/trusted/container-source-worker.cjs';
const ALLOWED_PATHS = Object.freeze([
  'assets/js/pages/booking.js',
  'application/views/components/booking_time_step.php'
]);
const MAX_FILE_BYTES = 256000, MAX_TEXT_BYTES = 50000, MAX_REQUEST_BYTES = 131072, MAX_RESPONSE_BYTES = 262144;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function object(value, keys, required = keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some(k => !keys.includes(k)) || required.some(k => !Object.hasOwn(value, k))) fail('invalid_source_arguments');
}
function literal(value, max) {
  if (typeof value !== 'string' || value.includes('\0') || Buffer.byteLength(value) > max) fail('invalid_source_text');
  // JSON can carry lone UTF-16 surrogates. Reject them before calculating byte
  // spans so a fragment cannot match half of a valid UTF-8 astral character.
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('invalid_source_text');
    } else if (unit >= 0xdc00 && unit <= 0xdfff) fail('invalid_source_text');
  }
}
function allowedPath(value) {
  if (typeof value !== 'string' || !ALLOWED_PATHS.includes(value)) fail('source_path_not_allowed');
  return value;
}
function validateCommand(command, args) {
  if (command === 'list_source' || command === 'hash_sources') object(args, []);
  else if (command === 'read_source') {
    object(args, ['path', 'expected_sha256'], ['path']); allowedPath(args.path);
    if (args.expected_sha256 !== undefined && !/^[a-f0-9]{64}$/.test(args.expected_sha256)) fail('invalid_source_hash');
  } else if (command === 'search_source') {
    object(args, ['query']); literal(args.query, 800);
    if (!args.query || args.query.length > 200) fail('invalid_source_search');
  } else if (command === 'replace_source') {
    object(args, ['path', 'old', 'new', 'expected_sha256']);
    allowedPath(args.path); literal(args.old, MAX_TEXT_BYTES); literal(args.new, MAX_TEXT_BYTES);
    if (!args.old || args.old === args.new) fail('invalid_source_replacement');
    if (!/^[a-f0-9]{64}$/.test(args.expected_sha256)) fail('invalid_source_hash');
  } else fail('unknown_source_command');
}
function decode(buffer) {
  try { return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buffer); }
  catch { fail('source_utf8_required'); }
}
function lineEndings(text) {
  let crlf = 0, lf = 0, cr = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r') { if (text[i + 1] === '\n') { crlf++; i++; } else cr++; }
    else if (text[i] === '\n') lf++;
  }
  const kinds = Number(crlf > 0) + Number(lf > 0) + Number(cr > 0);
  return {style: kinds > 1 ? 'mixed' : crlf ? 'crlf' : lf ? 'lf' : cr ? 'cr' : 'none', crlf, lf, cr};
}
// This normalization is for matching only. Writes splice the original bytes;
// neither the rest of the file nor unrelated whitespace is normalized.
const normalizedLines = text => text.replace(/\r\n/g, '\n');
function matchPositions(text, anchor) {
  const positions = [];
  for (let from = 0;;) {
    const at = text.indexOf(anchor, from);
    if (at < 0) return positions;
    positions.push(at); from = at + 1; // Count overlapping matches as ambiguous.
  }
}
function rawPosition(text, normalizedPosition) {
  let raw = 0, normalized = 0;
  while (normalized < normalizedPosition) {
    raw += text[raw] === '\r' && text[raw + 1] === '\n' ? 2 : 1;
    normalized++;
  }
  return raw;
}
function replacementPlan(bytes, text, args) {
  const sourceLines = lineEndings(text), oldLines = lineEndings(args.old), newLines = lineEndings(args.new);
  const rawMatches = matchPositions(text, args.old);
  const normalizedText = normalizedLines(text), normalizedOld = normalizedLines(args.old);
  const normalizedMatches = matchPositions(normalizedText, normalizedOld);
  function reject(code, issue = null) {
    const e = new Error(code); e.code = code;
    e.rejection = {stage: 'prewrite', written: false, path: args.path, source_sha256: sha(bytes),
      raw_match_count: rawMatches.length, normalized_match_count: normalizedMatches.length,
      source_line_endings: sourceLines, reason: code, line_ending_issue: issue};
    throw e;
  }
  for (const [location, endings] of [['source', sourceLines], ['old', oldLines], ['new', newLines]]) {
    if (endings.cr) reject('replacement_line_ending_ambiguous', location + '_bare_cr');
    if (endings.style === 'mixed') reject('replacement_line_ending_ambiguous', location + '_mixed');
  }
  if (!normalizedMatches.length) reject('replacement_anchor_not_found');
  if (normalizedMatches.length !== 1) reject('replacement_anchor_not_unique');
  const start = rawPosition(text, normalizedMatches[0]), end = rawPosition(text, normalizedMatches[0] + normalizedOld.length);
  const startByte = Buffer.byteLength(text.slice(0, start)), endByte = Buffer.byteLength(text.slice(0, end));
  const style = sourceLines.style !== 'none' ? sourceLines.style : newLines.style;
  const replacement = Buffer.from(style === 'crlf' ? normalizedLines(args.new).replace(/\n/g, '\r\n') : normalizedLines(args.new), 'utf8');
  if (bytes.subarray(startByte, endByte).equals(replacement)) fail('invalid_source_replacement');
  const output = Buffer.concat([bytes.subarray(0, startByte), replacement, bytes.subarray(endByte)]);
  if (output.length > MAX_FILE_BYTES) fail('source_file_too_large');
  return {output, match: {mode: text.slice(start, end) === args.old ? 'literal' : 'line_endings',
    raw_match_count: rawMatches.length, normalized_match_count: normalizedMatches.length,
    line_ending_style: style, applied_old_bytes: endByte - startByte, applied_new_bytes: replacement.length}};
}
// The root override exists only for bounded local unit fixtures. The stdio entry
// point below always uses /app and never accepts a root from its input.
function createSourceOperations(root = '/app') {
  root = path.resolve(root);
  function opened(rel, write, fn) {
    allowedPath(rel);
    let current = root;
    const rootStat = fs.lstatSync(current);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('source_link_denied');
    for (const part of rel.split('/')) {
      current = path.join(current, part);
      const s = fs.lstatSync(current);
      if (s.isSymbolicLink()) fail('source_link_denied');
      if (current !== path.join(root, rel) && !s.isDirectory()) fail('source_parent_not_directory');
    }
    const initial = fs.lstatSync(current);
    if (!initial.isFile() || initial.nlink !== 1) fail('source_link_denied');
    if (initial.size > MAX_FILE_BYTES) fail('source_file_too_large');
    const fd = fs.openSync(current, (write ? fs.constants.O_RDWR : fs.constants.O_RDONLY) | (fs.constants.O_NOFOLLOW || 0));
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1 || stat.dev !== initial.dev || stat.ino !== initial.ino) fail('source_identity_changed');
      if (stat.size > MAX_FILE_BYTES) fail('source_file_too_large');
      const buf = Buffer.alloc(MAX_FILE_BYTES + 1); let length = 0;
      while (length < buf.length) {
        const n = fs.readSync(fd, buf, length, buf.length - length, length);
        if (!n) break; length += n;
      }
      if (length > MAX_FILE_BYTES) fail('source_file_too_large');
      const bytes = buf.subarray(0, length), text = decode(bytes);
      return fn({fd, bytes, text, stat});
    } finally { fs.closeSync(fd); }
  }
  function read(rel, expected) {
    return opened(rel, false, ({bytes, text}) => {
      const hash = sha(bytes);
      if (expected !== undefined && expected !== hash) fail('source_hash_changed');
      return {path: rel, sha256: hash, bytes: bytes.length, content: text.slice(0, 24000), truncated: text.length > 24000,
        line_endings: lineEndings(text)};
    });
  }
  const handlers = {
    list_source: () => ALLOWED_PATHS.map(p => { opened(p, false, () => {}); return p; }),
    hash_sources: () => Object.fromEntries(ALLOWED_PATHS.map(p => [p, opened(p, false, ({bytes}) => sha(bytes))])),
    read_source: a => read(a.path, a.expected_sha256),
    search_source: a => {
      const matches = [];
      for (const rel of ALLOWED_PATHS) opened(rel, false, ({text}) => {
        for (const [i, line] of text.split(/\r?\n/).entries()) {
          if (line.includes(a.query) && matches.length < 100) matches.push({path: rel, line: i + 1, text: line.slice(0, 400)});
        }
      });
      return matches;
    },
    replace_source: a => opened(a.path, true, ({fd, bytes, text}) => {
      if (sha(bytes) !== a.expected_sha256) fail('source_hash_changed');
      const {output, match} = replacementPlan(bytes, text, a);
      let offset = 0;
      while (offset < output.length) offset += fs.writeSync(fd, output, offset, output.length - offset, offset);
      fs.ftruncateSync(fd, output.length); fs.fsyncSync(fd);
      const finalStat = fs.fstatSync(fd);
      if (finalStat.nlink !== 1 || !finalStat.isFile()) fail('source_identity_changed');
      return {changed: true, path: a.path, before_sha256: sha(bytes), after_sha256: sha(output), bytes: output.length, match};
    })
  };
  return {invoke(command, args) { validateCommand(command, args); return handlers[command](args); }};
}
function validatePacket(packet, token) {
  object(packet, ['protocol', 'id', 'command', 'args']);
  if (packet.protocol !== PROTOCOL || packet.id !== token || !/^[a-f0-9]{32}$/.test(token)) fail('invalid_source_packet');
  validateCommand(packet.command, packet.args); return packet;
}
async function main() {
  if (typeof process.getuid !== 'function' || process.getuid() !== 1000) fail('source_uid_required');
  if (process.argv.length !== 4 || process.argv[2] !== '--session-token' || !/^[a-f0-9]{32}$/.test(process.argv[3])) fail('invalid_source_session');
  const token = process.argv[3]; let bytes = 0, chunks = [];
  const timer = setTimeout(() => { process.exitCode = 1; process.stdin.destroy(); }, 5000);
  try {
    for await (const chunk of process.stdin) {
      bytes += chunk.length; if (bytes > MAX_REQUEST_BYTES) fail('source_request_too_large'); chunks.push(chunk);
    }
    clearTimeout(timer);
    let packet;
    try { packet = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('invalid_source_json'); }
    validatePacket(packet, token);
    let response;
    try { response = {protocol: PROTOCOL, id: token, ok: true, result: createSourceOperations('/app').invoke(packet.command, packet.args)}; }
    catch (e) {
      response = {protocol: PROTOCOL, id: token, ok: false, error: /^[a-z_]{1,80}$/.test(e.code || '') ? e.code : 'source_operation_failed'};
      if (e.rejection) response.result = {rejection: e.rejection};
    }
    response.worker_sha256 = sha(fs.readFileSync(WORKER_PATH));
    const output = JSON.stringify(response) + '\n';
    if (Buffer.byteLength(output) > MAX_RESPONSE_BYTES) fail('source_response_too_large');
    process.stdout.write(output);
  } finally { clearTimeout(timer); }
}
if (require.main === module) main().catch(e => { process.stderr.write(/^[a-z_]{1,80}$/.test(e.code || '') ? e.code + '\n' : 'source_worker_failed\n'); process.exitCode = 1; });
module.exports = {PROTOCOL, WORKER_PATH, ALLOWED_PATHS, MAX_FILE_BYTES, MAX_TEXT_BYTES, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES, sha, validateCommand, validatePacket, createSourceOperations};
