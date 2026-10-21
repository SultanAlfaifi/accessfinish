'use strict';
// Copies the reviewed static assets only. Never rewrites the backend or UI code.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
function copyDirectory(source, destination) {
  fs.mkdirSync(destination, {recursive: true});
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    const input = path.join(source, entry.name), output = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(input, output);
    else if (entry.isFile()) fs.writeFileSync(output, fs.readFileSync(input));
    else throw Error('Static publication does not follow filesystem links.');
  }
}
// Read/write explicitly: Windows cloud-file reparse points can break native copy fast paths.
copyDirectory(path.join(root, 'web'), path.join(root, 'docs'));
console.log('STATIC_REVIEW_ASSETS_PREPARED_LOCALLY; publication not performed');
