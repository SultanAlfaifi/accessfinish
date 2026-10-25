"""Package the current committed two-case build and separate editable v04 media.

No reused old build, network access, upload, release publication or submission.
"""
import datetime,hashlib,io,json,pathlib,shutil,subprocess,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
output=root/'artifacts/release-v0.2.0-v04-preparation'
output.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
prefixes=('lib/','web/','scripts/','test/','integration/','evidence/','submission/','docs/','third_party/')
names=[name for name in tracked if name and (name.startswith(prefixes) or name in ['server.cjs','package.json','README.md','LICENSE','THIRD_PARTY_NOTICES.md','.gitattributes'])]
names=[name for name in names if '__pycache__' not in name]
assert all(name in names for name in ['lib/cases.cjs','web/cases/customer-phone.json','third_party/EasyAppointments-LICENSE'])
snapshot=zipfile.ZipFile(io.BytesIO(subprocess.check_output(['git','archive','--format=zip',head],cwd=root)))
source_hashes={name:hashlib.sha256(snapshot.read(name)).hexdigest() for name in names}
with zipfile.ZipFile(output/'accessfinish-test-build.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for name in names:archive.writestr('accessfinish/'+name,snapshot.read(name))
media_names=['scripts/render-demo-v04.py','scripts/review-demo-v04.py','media/v04/brief.json','media/v04/narration.txt',
 'media/v04/assets/opening.png','media/v04/narration-aiden/narration.wav','media/v04/narration-aiden/narration.srt',
 'media/v04/narration-aiden/narration-timeline.json','media/v04/render-manifest.json','media/v04/technical-review.json',
 'web/comparison.json','web/phone-model-report.json','web/cases/customer-phone.json',
 'web/records/comparison-customer-phone-original-accessfinish.json','web/records/comparison-customer-phone-hardcoded-accessfinish.json',
 'LICENSE','THIRD_PARTY_NOTICES.md','third_party/EasyAppointments-LICENSE',
 'integration/portable/easyappointments-source.tar.gz','integration/portable/source-lock.json']
with zipfile.ZipFile(output/'accessfinish-media-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for name in media_names:archive.writestr('accessfinish/'+name,snapshot.read(name))
 archive.writestr('accessfinish/RENDER.txt','Requirements: Python with Pillow, FFmpeg and ffprobe. Windows Georgia and Segoe UI fonts; adapt paths on other systems.\nRun python scripts/render-demo-v04.py from the extracted folder. Audio is already generated; rendering makes no model request.\nLocal synthetic Aiden narration is included; Qwen weights/runtime are not bundled.\nNo music. Actual source/evidence is labelled. Full entrant playback remains pending.\n')
shutil.copy2(root/'media/v04/accessfinish-demo-v04.mp4',output/'accessfinish-demo.mp4')
shutil.copy2(root/'media/v04/narration-aiden/narration.srt',output/'accessfinish-demo.srt')
with zipfile.ZipFile(output/'accessfinish-submission-copy.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for file in sorted((root/'submission').glob('*')):
  if file.is_file():archive.write(file,'submission/'+file.name)
shutil.copy2(root/'submission/release-notes-v02.md',output/'release-notes.md')
files=['accessfinish-test-build.zip','accessfinish-demo.mp4','accessfinish-demo.srt','accessfinish-media-source.zip','accessfinish-submission-copy.zip','release-notes.md']
assets=[{'name':name,'bytes':(output/name).stat().st_size,'sha256':sha(output/name)} for name in files]
manifest={'version':'0.2.0','presentation_revision':'v04','state':'LOCAL_REVIEW_PREPARATION',
 'prepared_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_commit':head,
 'functional_build_reused_unchanged':False,'source_files_sha256':source_hashes,'assets':assets,
 'media_source_sha256':{name:hashlib.sha256(snapshot.read(name)).hexdigest() for name in media_names},
 'video':{'seconds':109.5,'frames':3285,'width':1600,'height':900,'fps':30,'new_model_request':False,'voice':'Aiden','entrant_playback_approved':False},
 'comparison':{'pairs':6,'executions':12,'equal_correctness_outcomes':True},
 'new_phone_model':{'generations':1,'execution_replays':2,'estimated_cost_usd_excluding_tax':0.0041457},
 'original_model_evaluation':{'attempts':5,'complete_passes':2,'exposed_cases':1},
 'human_browser_reviews_completed':0,'public_demo_updated':False,'new_video_uploaded':False,'release_published':False,'devpost_submitted':False}
(output/'release-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
checksums=assets+[{'name':'release-manifest.json','sha256':sha(output/'release-manifest.json')}]
(output/'SHA256SUMS.txt').write_text(''.join(a['sha256']+'  '+a['name']+'\n' for a in checksums),encoding='utf-8')
for name in ['accessfinish-test-build.zip','accessfinish-media-source.zip','accessfinish-submission-copy.zip']:
 with zipfile.ZipFile(output/name) as archive:assert archive.testzip() is None
for name in ['accessfinish-test-build.zip','accessfinish-media-source.zip']:
 with zipfile.ZipFile(output/name) as archive:
  for required in ['LICENSE','THIRD_PARTY_NOTICES.md','third_party/EasyAppointments-LICENSE','integration/portable/easyappointments-source.tar.gz']:
   assert archive.read('accessfinish/'+required)==snapshot.read(required),'Missing or changed attribution/source: '+required
print(json.dumps({'state':manifest['state'],'source_commit':head,'assets':len(assets),'functional_files':len(names)}))
