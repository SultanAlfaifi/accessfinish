'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {sha}=require('../lib/repair.cjs'),{digest}=require('../lib/runs.cjs');
const root=path.resolve(__dirname,'..'),read=name=>JSON.parse(fs.readFileSync(path.join(root,name)));
test('public comparison and new-model bundles preserve exact retained evidence and authorship',()=>{
 const raw=read('evidence/extension-20261023-r2/comparison.json'),publicReport=read('web/comparison.json');
 assert.equal(publicReport.records.length,12);
 for(const row of publicReport.records){const original=raw.records.find(value=>value.key===row.key);assert.ok(original);assert.deepEqual(read('web/'+row.evidence),original.record);}
 for(const item of read('evidence/extension-20261023-r2/public-manifest.json').outputs)assert.equal(sha(fs.readFileSync(path.join(root,item.path))),item.sha256,item.path);
 const bundle=read('web/cases/customer-phone.json'),record=read('evidence/phone-model-20261023/execution-accessfinish.json');
 const attempt=read('evidence/phone-model-20261023/attempt-'+record.model_attempt_id+'.json');
 assert.equal(bundle.featured.authorship,'model');assert.deepEqual(bundle.featured.proposal,attempt.proposal);
 assert.equal(bundle.featured.proposal_sha256,digest(attempt.proposal));assert.deepEqual(bundle.run,record);
 assert.deepEqual(read('web/records/phone-model-accessfinish.json'),record);
 assert.deepEqual(read('web/records/phone-model-conventional.json'),read('evidence/phone-model-20261023/execution-conventional.json'));
 assert.equal(read('web/cases/customer-phone-reference.json').featured.authorship,'operator_reference');
});
