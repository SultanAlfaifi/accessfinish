'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const file=path.join(root,'server.cjs');let s=fs.readFileSync(file,'utf8'),start=s.indexOf('function createServer()'),end=s.indexOf('module.exports=');let part=s.slice(start,end);part=part.replace('try{const host=','try{const activePort=req.socket.localPort;const host=').replaceAll('${HOST}:${PORT}','${HOST}:${activePort}').replaceAll('localhost:${PORT}','localhost:${activePort}');s=s.slice(0,start)+part+s.slice(end);fs.writeFileSync(file,s);
const app=path.join(root,'web/app.js');s=fs.readFileSync(app,'utf8').replace('evidence=await r.json();renderProposal','evidence=await r.json();document.querySelector("#booking-id").textContent="#"+evidence.booking.id;renderProposal');fs.writeFileSync(app,s);
for(const f of fs.readdirSync(path.join(root,'web')))if(fs.statSync(path.join(root,'web',f)).isFile())fs.copyFileSync(path.join(root,'web',f),path.join(root,'docs',f));
console.log('SOURCE_AND_HOSTED_REPLAY_SYNCED');
