'use strict';
// Local review only: serves the prepared film, with no model or application execution.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const file = path.resolve(__dirname, '../media/accessfinish-demo-v02.mp4');
if (!fs.existsSync(file)) throw Error('Place the release film at media/accessfinish-demo-v02.mp4, or render it from the editable media-source bundle first.');
const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AccessFinish · review the 2:20 demo</title><style>body{margin:24px;background:#101829;color:#f5f7ff;font:16px system-ui}main{max-width:1600px;margin:auto}h1{font-size:22px}video{width:100%;max-height:75vh;background:#000}button{padding:10px 18px;margin:8px 12px 8px 0}p{line-height:1.5}output{display:block}</style><main><h1>AccessFinish · 2:20 English demonstration</h1><p>Actual UI captures with edited timing. A fresh isolated execution of a recorded Nemotron proposal. Silent; no new model request.</p><video id="demo" controls playsinline preload="metadata" src="/demo.mp4"></video><div><button id="start">Play from the beginning</button><button id="pause">Pause</button></div><output id="progress" role="status">Ready for playback.</output><p>Technical and sampled-frame checks have passed. Entrant review and publication approval remain separate.</p></main><script src="/player.js"></script></html>';
const js = 'const video=document.querySelector("video"),status=document.querySelector("output");document.querySelector("#start").onclick=()=>{video.currentTime=0;video.play()};document.querySelector("#pause").onclick=()=>video.pause();video.ontimeupdate=()=>{status.textContent=video.currentTime.toFixed(1)+" / "+video.duration.toFixed(1)+" seconds; playback "+video.playbackRate+"x"};video.onended=()=>{status.textContent="Playback reached the end. 140 seconds. This does not record entrant approval."};';
http.createServer((req,res)=>{
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);return res.end();}
  const url = new URL(req.url, 'http://127.0.0.1:4180');
  if (url.pathname==='/' || url.pathname==='/player.js') {res.writeHead(200,{'Content-Type':url.pathname==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?'':url.pathname==='/'?html:js);}
  if (url.pathname!=='/demo.mp4') {res.writeHead(404);return res.end();}
  const size=fs.statSync(file).size,range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
  if (range) {
    const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),size-1):size-1;
    if (start>end || start>=size) {res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end();}
    res.writeHead(206,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});
    return req.method==='HEAD'?res.end():fs.createReadStream(file,{start,end}).pipe(res);
  }
  res.writeHead(200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':size});
  return req.method==='HEAD'?res.end():fs.createReadStream(file).pipe(res);
}).listen(4180,'127.0.0.1',()=>console.log('Local film review http://127.0.0.1:4180/; no model requests'));
