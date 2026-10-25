'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {digest}=require('../lib/runs.cjs');
const root=path.resolve(__dirname,'..'),read=name=>JSON.parse(fs.readFileSync(path.join(root,name)));
test('new-model bundle preserves exact retained evidence and authorship',()=>{
 const bundle=read('web/cases/customer-phone.json'),record=read('evidence/phone-model-20261023/execution-accessfinish.json');
 const attempt=read('evidence/phone-model-20261023/attempt-'+record.model_attempt_id+'.json');
 assert.equal(bundle.featured.authorship,'model');assert.deepEqual(bundle.featured.proposal,attempt.proposal);
 assert.equal(bundle.featured.proposal_sha256,digest(attempt.proposal));assert.deepEqual(bundle.run,record);
 assert.deepEqual(read('web/records/phone-model-accessfinish.json'),record);
 assert.equal(read('web/cases/customer-phone-reference.json').featured.authorship,'operator_reference');
});
