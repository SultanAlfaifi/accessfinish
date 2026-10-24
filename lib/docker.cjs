'use strict';
const cp = require('node:child_process');

function docker(args, {input, timeout = 30000, limit = 8 * 1024 * 1024, progress} = {}) {
  return new Promise((resolve, reject) => {
    const env = {};
    for (const key of ['PATH', 'SystemRoot', 'USERPROFILE', 'HOME', 'TEMP', 'TMP', 'DOCKER_CONTEXT', 'DOCKER_CONFIG'])
      if (process.env[key]) env[key] = process.env[key];
    const child = cp.spawn('docker', args, {shell: false, windowsHide: true, env, stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '', stderr = '', head = '', settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child.kill(); finish(Error('Docker operation timed out. Inspect the owned run before retrying.')); }, timeout);
    child.stdout.on('data', chunk => { stdout += chunk; progress?.(chunk.toString()); if (Buffer.byteLength(stdout) > limit) { child.kill(); finish(Error('Docker output exceeded its limit.')); } });
    child.stderr.on('data', chunk => { if (head.length < 1200) head += chunk; stderr = (stderr + chunk).slice(-12000); progress?.(chunk.toString()); });
    child.once('error', () => finish(Error('Docker could not start. Install/start Docker and use its local Linux engine.')));
    child.once('close', code => finish(code === 0 ? null : Error('Docker operation failed: ' + (stderr.length > 3500 ? head.slice(0, 1200) + '\n…\n' + stderr.slice(-2300) : stderr)), stdout.trim()));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
async function inspect(kind, name) { return JSON.parse(await docker([kind, 'inspect', name]))[0]; }
async function localEngine() {
  if (process.env.DOCKER_HOST) throw Error('Unset DOCKER_HOST; this fixture requires a local Docker context.');
  const name = await docker(['context', 'show']);
  const context = JSON.parse(await docker(['context', 'inspect', name]))[0];
  if (!/^(?:npipe:\/\/|unix:\/\/)/.test(context.Endpoints?.docker?.Host || '')) throw Error('A local Docker context is required.');
  const version = JSON.parse(await docker(['version', '--format', '{{json .Server}}']));
  if (version.Os !== 'linux') throw Error('Switch Docker to its Linux engine.');
  return {context: name, os: version.Os, arch: version.Arch, version: version.Version};
}
module.exports = {docker, inspect, localEngine};
