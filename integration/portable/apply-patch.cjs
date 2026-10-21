'use strict';
const fs = require('node:fs');
const {preview, PATHS, sha} = require('./repair.cjs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; if (Buffer.byteLength(input) > 150000) process.exit(1); });
process.stdin.on('end', () => {
  try {
    const proposal = JSON.parse(input), files = PATHS.map(path => {
      const file = '/app/' + path, stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw Error('Candidate source links are forbidden.');
      return {path, content: fs.readFileSync(file, 'utf8')};
    });
    const result = preview(files, proposal);
    for (const file of result.files) fs.writeFileSync('/app/' + file.path, file.content);
    console.log(JSON.stringify({state: 'source_applied', files: result.files.map(f => ({path: f.path, sha256: sha(f.content)})), changes: result.changes}));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
});
