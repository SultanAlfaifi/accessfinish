'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compareReplay}=require('../scripts/replay-expectation.cjs');
const report=require('../evidence/reproduction-variation-20261024/attempt-1-replays.json');
const execution=require('../evidence/reproduction-variation-20261024/attempt-1-evaluation-1.json');
const row=require('../web/trial-report.json').trials.find(row=>row.phase==='evaluation'&&row.index===1);
function record(value=execution){return {id:value.run_id,case_id:value.case_id,proposal_sha256:value.proposal_sha256,source_sha256:value.source_sha256,
 state:'failed',booking_verified:false,stages:[{state:'verifying'}]};}
test('retains a known negative decision without claiming its exact recorded stage was reproduced',()=>{
 const result=compareReplay(row,record(),execution);assert.equal(report.expected_outcomes_matched,4);
 assert.equal(result.expected_outcome_observed,false);assert.equal(result.acceptance_decision_observed,true);
 assert.equal(result.known_negative_stage_variation,true);assert.equal(result.observed.overall_pass,false);
});
test('other errors, writes, forged identities, non-native interaction and failed positive repairs are not accepted as this variation',()=>{
 const mutations=[value=>value.keyboard.workflow.reason='browser_operation_failed',value=>value.evaluation.nochangecontrols.snapshots_unchanged=false,
  value=>value.proposal_sha256='0'.repeat(64),value=>value.native_keyboard_only=false,value=>value.keyboard.submissions=1,value=>value.case_id='customer-phone'];
 for(const mutate of mutations){const value=structuredClone(execution);mutate(value);assert.equal(compareReplay(row,record(),value).acceptance_decision_observed,false);}
 assert.equal(compareReplay({...row,index:3,overall_pass:true},record(),execution).acceptance_decision_observed,false);
});
test('the second retained failure has the same bounded rejection and remains an exact-stage mismatch',()=>{
 const value=require('../evidence/reproduction-variation-20261024/attempt-2-evaluation-1.json');
 const result=compareReplay(row,record(value),value);assert.equal(result.acceptance_decision_observed,true);assert.equal(result.expected_outcome_observed,false);
});
