'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const web = path.resolve(__dirname, '../web'), port = 4178;
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'};
http.createServer((request, response) => {
  try {
    if (request.method !== 'GET' || !['127.0.0.1:' + port, 'localhost:' + port].includes(request.headers.host)) throw Error();
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Recorded runs only: tell the page there is no live agent, as server.cjs would without a key.
    if (pathname === '/api/status') { response.writeHead(200, {'Content-Type': 'application/json'}); return response.end('{"agent_ready":false}'); }
    const file = path.resolve(web, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(web + path.sep) || !types[path.extname(file)] || fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile()) throw Error();
    response.writeHead(200, {'Content-Type': types[path.extname(file)], 'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'});
    fs.createReadStream(file).pipe(response);
  } catch { response.writeHead(404, {'Content-Type': 'text/plain'}); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log('Recorded runs preview http://127.0.0.1:' + port));
