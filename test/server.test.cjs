'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createServer}=require('../server.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');

test('phone proposal API keeps model identity and rejects an approval for the date repair',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'accessfinish-phone-http-'));let executed=false;
 const server=createServer({root,execute:async()=>{executed=true;throw Error('Must not execute without matching approval');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 const post=(route,value)=>fetch(url+route,{method:'POST',body:JSON.stringify(value)});
 try{
  const response=await post('/api/proposals/recorded',{case_id:'customer-phone'});assert.equal(response.status,201);
  const phone=await response.json(),bundle=require('../web/cases/customer-phone.json');
  assert.equal(phone.case_id,'customer-phone');assert.equal(phone.origin,'recorded');
  assert.equal(phone.model,bundle.featured.model);assert.equal(phone.proposal_sha256,bundle.featured.proposal_sha256);
  const date=await(await post('/api/proposals/recorded',{case_id:'keyboard-date'})).json();
  const stale=await post('/api/runs',{proposal_id:phone.id,reviewed:true,approved_proposal_sha256:date.proposal_sha256});
  assert.equal(stale.status,400);assert.equal(executed,false);
  const missing=await post('/api/runs',{proposal_id:phone.id,reviewed:false,approved_proposal_sha256:phone.proposal_sha256});
  assert.equal(missing.status,400);assert.equal(executed,false);
  assert.equal((await post('/api/proposals/recorded',{case_id:'unknown'})).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
});
test('serves the page and rejects cross-origin writes and private file paths',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'accessfinish-http-')),s=createServer({root});await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;try{const home=await fetch(url+'/');assert.equal(home.status,200);assert.ok(home.headers.get('content-security-policy').includes("object-src 'none'"));assert.ok((await home.text()).includes('AccessFinish'));const rejected=await fetch(url+'/api/preview',{method:'POST',headers:{Origin:'https://untrusted.invalid'},body:'{}'});assert.equal(rejected.status,403);const secret=await fetch(url+'/server.cjs');assert.equal(secret.status,404);const status=await(await fetch(url+'/api/status')).json();assert.equal(status.model,'nvidia/nemotron-3-super-120b-a12b');const noKey=await fetch(url+'/api/analyze',{method:'POST',body:'{}'});assert.equal(noKey.status,400);assert.ok((await noKey.json()).error.includes('No paid call'));}finally{await new Promise(r=>s.close(r));fs.rmSync(root,{recursive:true,force:true});}});
