'use strict';
// Reproduction reporting only. Does not alter the executor or verified status.
const KNOWN_DATE_NEGATIVE='16ea9a86027099fa595177b59fc3d934c7a5e96aefeb50ef74136ab4049a21a9';
function compareReplay(row,run,execution){
 const observed={build_pass:execution.build?.status==='TRUSTED_BUILD_PASS',keyboard_booking_pass:execution.keyboard_booking_verified===true,
  regression_controls_pass:execution.controls?.pass===true,overall_pass:run.booking_verified===true};
 const expectedStage=row.overall_pass||row.keyboard_booking_pass?'verifying':row.build_pass?'booking':'building';
 const bound=execution.run_id===run.id&&execution.proposal_sha256===row.proposal_sha256&&
  run.proposal_sha256===row.proposal_sha256&&execution.source_sha256===run.source_sha256;
 const exact=bound&&Object.entries(observed).every(([key,value])=>value===row[key])&&run.stages.at(-1)?.state===expectedStage;
 const date=execution.scenario?.date?.split('-'),typed=date&&`${date[2]}/${date[1]}/${date[0]}`;
 const unchanged=execution.evaluation?.nochangecontrols;
 const variation=bound&&row.proposal_sha256===KNOWN_DATE_NEGATIVE&&row.index===1&&row.overall_pass===false&&row.keyboard_booking_pass===true&&
  run.case_id==='keyboard-date'&&execution.case_id==='keyboard-date'&&run.state==='failed'&&run.booking_verified===false&&
  run.stages.at(-1)?.state==='verifying'&&observed.build_pass&&!observed.keyboard_booking_pass&&!observed.regression_controls_pass&&
  execution.booking_verified===false&&execution.keyboard?.workflow?.status==='unresolved'&&
  execution.keyboard.workflow.reason==='booking_slot_not_keyboard_reachable'&&execution.keyboard.workflow.submitted===false&&
  execution.keyboard.submissions===0&&execution.native_keyboard_only===true&&execution.keyboard.native_keyboard_only===true&&
  execution.keyboard.last_observation?.inputs?.some(input=>input.id==='select-date'&&input.value===typed)&&
  execution.evaluation?.pass===false&&unchanged?.snapshots_unchanged===true&&unchanged.appointments_unchanged===true&&unchanged.customers_unchanged===true;
 return {observed,expected_last_stage:expectedStage,observed_last_stage:run.stages.at(-1)?.state,
  expected_outcome_observed:exact,acceptance_decision_observed:exact||variation,known_negative_stage_variation:!!variation,
  variation_note:variation?'Known-bad evaluation-1 source rejected before submission at booking_slot_not_keyboard_reachable; stored snapshots unchanged. The exact recorded stage was not reproduced.':null};
}
module.exports={compareReplay};
