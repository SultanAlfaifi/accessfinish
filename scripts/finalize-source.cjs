'use strict';
// Versions local asset references in every page of web/ and mirrors web/ into docs/ (the GitHub Pages source).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
for (const name of fs.readdirSync(path.join(root, 'web')).filter(name => name.endsWith('.html'))) {
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
// docs/ mirrors web/ exactly (plus .nojekyll and any CNAME), so a page or asset removed from web/ leaves the site too.
const docs = path.join(root, 'docs');
for (const entry of fs.existsSync(docs) ? fs.readdirSync(docs) : []) if (!['.nojekyll', 'CNAME'].includes(entry)) fs.rmSync(path.join(docs, entry), {recursive: true, force: true});
// Read/write explicitly: Windows cloud-file reparse points can break native copy fast paths.
copyDirectory(path.join(root, 'web'), docs);
console.log('STATIC_REVIEW_ASSETS_PREPARED_LOCALLY; publication not performed');
