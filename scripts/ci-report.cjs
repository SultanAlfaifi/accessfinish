'use strict';
const fs = require('node:fs'), path = require('node:path');
const {runtimeRoot} = require('../lib/runs.cjs');
const root = runtimeRoot(), destination = path.resolve(__dirname, '../artifacts/clean-run');
fs.mkdirSync(destination, {recursive: true});
for (const name of fs.readdirSync(path.join(root, 'runs'))) {
  if (!/^run-[a-f0-9]{32}\.json$/.test(name)) continue;
  const run = JSON.parse(fs.readFileSync(path.join(root, 'runs', name), 'utf8'));
  // Run records contain synthetic outcomes, not the separate private credentials.
  fs.writeFileSync(path.join(destination, name), JSON.stringify(run, null, 2) + '\n');
  const execution = path.join(root, 'execution', run.id, 'evidence.json');
  if (fs.existsSync(execution)) fs.writeFileSync(path.join(destination, 'execution-' + name), fs.readFileSync(execution));
}
const replayReport = path.join(root, 'recorded-proposal-replays.json');
if (fs.existsSync(replayReport)) fs.writeFileSync(path.join(destination, 'recorded-proposal-replays.json'), fs.readFileSync(replayReport));
console.log(JSON.stringify({exported: destination, model_calls: 0, private_runtime_credentials_exported: false}));
