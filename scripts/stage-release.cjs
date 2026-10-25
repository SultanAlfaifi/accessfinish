'use strict';
// Creates local release files only. Does not upload, publish, infer, or execute a repair.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/release-v0.2.0');
const git=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(git(['status','--porcelain','--untracked-files=no'])) throw Error('Commit the reviewed source before staging its release.');
const revision=git(['rev-parse','HEAD']),tree=git(['rev-parse','HEAD^{tree}']);
fs.mkdirSync(output,{recursive:true});
const included=['.dockerignore','.gitattributes','README.md','LICENSE','THIRD_PARTY_NOTICES.md','package.json','server.cjs','lib','web','test','scripts','evidence','integration/portable','third_party','submission'];
git(['archive','--format=zip','--prefix=accessfinish/','--output='+path.join(output,'accessfinish-test-build.zip'),revision,...included]);
for(const [source,destination]of [
  ['media/accessfinish-demo-v02.mp4','accessfinish-demo.mp4'],
  ['media/accessfinish-demo-v02.srt','accessfinish-demo.srt'],
  ['artifacts/accessfinish-media-source-v0.2.0.zip','accessfinish-media-source.zip']
]) fs.writeFileSync(path.join(output,destination),fs.readFileSync(path.join(root,source)));
const filenames=['accessfinish-test-build.zip','accessfinish-demo.mp4','accessfinish-demo.srt','accessfinish-media-source.zip'];
const assets=filenames.map(name=>{const bytes=fs.readFileSync(path.join(output,name));return {name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});
const videoReview=JSON.parse(fs.readFileSync(path.join(root,'media/review-v02.json'),'utf8'));
if(assets.find(a=>a.name==='accessfinish-demo.mp4').sha256!==videoReview.render_sha256)throw Error('The staged movie differs from the reviewed render.');
const manifest={schema_version:1,version:'0.2.0',prepared_at_utc:new Date().toISOString(),source_commit:revision,source_tree:tree,
  state:'UNPUBLISHED_RELEASE_CANDIDATE',assets,
  model_experiment:{development:3,frozen_attempts:5,complete_passes:2,exposed_cases:1,total_requests:8,estimated_additional_cost_usd_excluding_tax:0.0394581,new_requests_for_release:0},
  video:{seconds:140,width:1600,height:900,fps:30,frames:4200,audio_streams:0,actual_ui_captures:true,edited_timing:true,new_isolated_execution:true,new_model_request:false,entrant_playback_approved:false},
  human_browser_reviews_completed:0,public_youtube_url:null,devpost_receipt:null,
  licenses:{original:'MIT',upstream:'Easy!Appointments GPL-3.0; full pinned source and notices included'}};
fs.writeFileSync(path.join(output,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const checksumAssets=[...assets,{name:'release-manifest.json',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(output,'release-manifest.json'))).digest('hex')}];
fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),checksumAssets.map(a=>a.sha256+'  '+a.name).join('\n')+'\n');
console.log(JSON.stringify({state:manifest.state,source_commit:revision,assets:assets.map(a=>({name:a.name,bytes:a.bytes})),new_model_requests:0}));
