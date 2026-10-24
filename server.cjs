'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const {preview} = require('./lib/repair.cjs');
const {createRunStore, runtimeRoot} = require('./lib/runs.cjs');
const model = require('./lib/model.cjs');
const fixture = require('./lib/fixture.cjs');
const web = path.join(__dirname, 'web'), HOST = '127.0.0.1';
function send(res, status, value) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); res.end(JSON.stringify(value));
}
async function body(req) {
  let bytes = 0; const chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 150000) throw Error('Request is too large.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function createServer({root = runtimeRoot(), execute = fixture.execute} = {}) {
  const store = createRunStore({root, execute});
  const server = http.createServer(async (req, res) => {
    try {
      const port = req.socket.localPort, allowed = [HOST + ':' + port, 'localhost:' + port];
      if (!allowed.includes(req.headers.host)) return send(res, 403, {error: 'Local access only.'});
      if (req.method === 'POST' && req.headers.origin && !allowed.map(host => 'http://' + host).includes(req.headers.origin)) return send(res, 403, {error: 'Cross-origin requests are not allowed.'});
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/status') {
        let fixtureReady = false; try { fixture.preparation(root); fixtureReady = true; } catch {}
        return send(res, 200, {mode: 'local', model: model.MODEL, model_ready: model.readiness(), fixture_ready: fixtureReady, execution_busy: store.busy(), new_execution_available: fixtureReady});
      }
      if (req.method === 'POST' && url.pathname === '/api/proposals/recorded') {
        const input = await body(req);
        if (input.case_id === 'customer-phone') {
          const selected = require('./lib/cases.cjs').caseDefinition(input.case_id);
          const bundle = path.join(web, 'cases/customer-phone.json');
          const retained = fs.existsSync(bundle) ? JSON.parse(fs.readFileSync(bundle, 'utf8')) : null;
          return send(res, 201, store.register({files: selected.files, proposal: retained?.featured?.proposal || require('./lib/cases.cjs').phoneReference(),
            origin: retained?.featured?.authorship === 'model' ? 'recorded' : 'operator_reference',
            model: retained?.featured?.model || null, case_id: selected.id}));
        }
        if (input.case_id && input.case_id !== 'keyboard-date') throw Error('Unknown repair case.');
        const files = JSON.parse(fs.readFileSync(path.join(web, 'source-context.json'), 'utf8'));
        const featuredFile = path.join(web, 'featured-case.json');
        const evidence = JSON.parse(fs.readFileSync(fs.existsSync(featuredFile) ? featuredFile : path.join(web, 'evidence.json'), 'utf8'));
        return send(res, 201, store.register({files, proposal: evidence.proposal, origin: 'recorded', model: model.MODEL}));
      }
      if (req.method === 'POST' && url.pathname === '/api/analyze') {
        const input = await body(req), result = await model.analyze(input, {root});
        const proposal = store.register({files: input.files, proposal: result.proposal, origin: 'nebius', model: result.model, usage: result.usage, estimated_cost_usd_excluding_tax: result.estimated_cost_usd_excluding_tax, case_id: result.case_id});
        return send(res, 200, {...result, ...proposal, proposal_id: proposal.id});
      }
      if (req.method === 'POST' && url.pathname === '/api/preview') { const input = await body(req); return send(res, 200, preview(input.files, input.proposal)); }
      if (req.method === 'POST' && url.pathname === '/api/runs') return send(res, 202, store.start(await body(req)));
      const runMatch = /^\/api\/runs\/(run-[a-f0-9]{32})$/.exec(url.pathname);
      if (req.method === 'GET' && runMatch) return send(res, 200, store.getRun(runMatch[1]));
      if (req.method === 'POST' && url.pathname === '/api/verify') {
        const input = await body(req), run = store.getRun(input.run_id);
        if (input.proposal_sha256 !== run.proposal_sha256) throw Error('Select the proposal that belongs to this run.');
        return send(res, 200, {...run, verification_mode: 'execution_record', new_verification_performed: false});
      }
      if (req.method !== 'GET') return send(res, 405, {error: 'Method not allowed.'});
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\//, ''), file = path.resolve(web, relative);
      if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, {error: 'File not found.'});
      const mime = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png'};
      const indexHtml = file === path.join(web, 'index.html') ? fs.readFileSync(file, 'utf8').replace('data-mode="recorded-review"', 'data-mode="local"') : null;
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      if (indexHtml !== null) res.end(indexHtml); else fs.createReadStream(file).pipe(res);
    } catch (error) {
      let message = String(error.message || 'The operation failed.');
      if (process.env.NEBIUS_API_KEY) message = message.replaceAll(process.env.NEBIUS_API_KEY, '[redacted]');
      send(res, 400, {error: /(?:Bearer|v1\.)/i.test(message) ? 'The operation failed; inspect the local server.' : message});
    }
  });
  server.on('close', () => store.close());
  return server;
}
module.exports = {createServer, preview, analyze: model.analyze};
if (require.main === module) createServer().listen(Number(process.env.PORT || 4177), HOST, () => console.log('AccessFinish http://' + HOST + ':' + (process.env.PORT || 4177)));
