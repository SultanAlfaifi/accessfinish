'use strict';
// Versions local asset references and copies the reviewed static build.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
for (const name of ['index.html', 'review.html']) {
  const file = path.join(root, 'web', name);
  const html = fs.readFileSync(file, 'utf8').replace(/\b(src|href)="([a-zA-Z0-9_./-]+\.(?:js|css|json))(?:\?v=[a-f0-9]+)?"/g, (match, attribute, asset) => {
    const input = path.resolve(root, 'web', asset);
    if (!input.startsWith(path.join(root, 'web') + path.sep)) throw Error('Asset must stay within the static build.');
    const version = crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex').slice(0, 16);
    return `${attribute}="${asset}?v=${version}"`;
  });
  fs.writeFileSync(file, html);
}
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
