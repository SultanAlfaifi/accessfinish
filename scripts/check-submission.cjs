'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const normalized=text=>text.replace(/\r\n/g,'\n');
const fields=read('submission/devpost-fields.json'),status=read('submission/implementation-status.json'),checklist=read('submission/checklist.json');
const records=JSON.parse(cp.execFileSync(process.execPath,[path.join(root,'scripts/check-trials.cjs')],{encoding:'utf8',cwd:root}));
assert.equal(fields.evidence.complete_passes,records.evaluation_passed);
assert.equal(fields.evidence.frozen_attempts,records.evaluation_attempts);
assert.equal(fields.evidence.exposed_cases,records.distinct_cases);
assert.equal(fields.evidence.total_requests,records.evaluation_attempts+records.retained_development_attempts);
assert.equal(normalized(fields.description),normalized(fs.readFileSync(path.join(root,'submission/project-description.md'),'utf8')));
assert.equal(normalized(fields.technology_feedback),normalized(fs.readFileSync(path.join(root,'submission/technology-feedback.md'),'utf8')));
assert.ok(fields.tagline.length>0&&fields.tagline.length<=120);
assert.ok(checklist.video_duration_seconds>0&&checklist.video_duration_seconds<=180);
assert.ok(fs.readFileSync(path.join(root,'submission/youtube-details.txt'),'utf8').includes(`${Math.round(checklist.video_duration_seconds)}-second`));
if(fields.private_youtube_url&&fields.private_youtube_url===fields.public_youtube_url)assert.equal(fields.youtube_public_verified,true);
let stagedAssets=0;
if(process.argv.includes('--local-assets')){
 const directory=checklist.prepared_release_directory||'artifacts/release-v0.2.0';
 const manifest=read(directory+'/release-manifest.json');
 for(const asset of manifest.assets){const bytes=fs.readFileSync(path.join(root,directory,asset.name));assert.equal(bytes.length,asset.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);stagedAssets++}
 assert.equal(manifest.video.seconds,checklist.video_duration_seconds);assert.equal(manifest.video.new_model_request,false);
}
const pending=[];
if(status.independent_browser_reviews_completed!==2)pending.push('Two real independent browser reviews and observed fixes');
if(!fields.entrant_video_playback_approved)pending.push('Entrant full video playback');
if(!fields.public_youtube_url||!fields.youtube_public_verified)pending.push('Verified public YouTube video');
if(!fields.public_test_build_url||!fields.release_download_verified)pending.push('Verified public v0.2 release');
if(!fields.actual_devpost_draft_saved)pending.push('Authenticated Devpost draft');
if(!fields.entrant_fields.eligibility_confirmed||!fields.entrant_fields.ownership_and_licenses_confirmed||!fields.entrant_fields.final_declarations_confirmed)pending.push('Entrant identity, eligibility, rights and declarations');
if(!fields.final_submission_approved)pending.push('Final submission confirmation');
console.log(JSON.stringify({state:pending.length?'PREPARED_PENDING_EXTERNAL_GATES':'READY_FOR_FINAL_SUBMISSION',frozen_evidence:'passed',staged_assets_checked:stagedAssets,pending,new_model_requests:0},null,2));
if(process.argv.includes('--ready')&&pending.length)process.exitCode=2;
