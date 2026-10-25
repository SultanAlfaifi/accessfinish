"""Stage a LOCAL presentation update, preserving the reviewed functional build."""
import datetime
import hashlib
import json
import pathlib
import shutil
import zipfile

root=pathlib.Path(__file__).resolve().parents[1]
output=root/'artifacts/release-v0.2.0-v03-preparation-r2'
if output.exists(): raise SystemExit('Preparation already exists; preserve it and choose a new directory')
output.mkdir(parents=True)
old=root/'artifacts/release-v0.2.0'
previous=json.loads((old/'release-manifest.json').read_text(encoding='utf-8'))
build=old/'accessfinish-test-build.zip'
build_record=next(a for a in previous['assets'] if a['name']==build.name)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(build)==build_record['sha256']
shutil.copy2(build,output/build.name)
for source,name in [('media/v03/accessfinish-demo-v03.mp4','accessfinish-demo.mp4'),
                    ('media/v03/narration-aiden/narration.srt','accessfinish-demo.srt')]:
    shutil.copy2(root/source,output/name)
media_files=[root/name for name in [
    'LICENSE','THIRD_PARTY_NOTICES.md','scripts/render-demo-v03.py',
    'scripts/mix-v03-audio.py','scripts/review-demo-v03.py','media/capture-v02.json',
    'media/v03/brief.json','media/v03/scene-plan.json','media/v03/narration.txt',
    'media/v03/narration-beats.json','media/v03/narration-aiden/narration.wav',
    'media/v03/narration-aiden/narration-timeline.json',
    'media/v03/narration-aiden/narration.srt','media/v03/narration-aiden/resource-report.json']]
media_files+=sorted((root/'media/raw/v02').glob('*.jpg'))
media_files += [root/f'web/records/evaluation-{i}.json' for i in range(1,6)]
media_files += sorted(path for path in (root/'third_party').rglob('*') if path.is_file())
with zipfile.ZipFile(output/'accessfinish-media-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in media_files: archive.write(file,'accessfinish/'+file.relative_to(root).as_posix())
    archive.writestr('accessfinish/RENDER-INSTRUCTIONS.txt',
        'AccessFinish v03 presentation sources\n\n'
        'The accepted 117-second Aiden narration is included. Rendering does not need model weights, GPU, API key or new inference.\n'
        'Use Python with Pillow, NumPy and SoundFile, and FFmpeg/ffprobe in PATH. The compositor uses Segoe UI and Georgia from C:/Windows/Fonts; other systems need font paths adapted. Tested locally on Windows.\n\n'
        'From the extracted accessfinish folder:\n'
        'python scripts/mix-v03-audio.py --timeline media/v03/narration-aiden/narration-timeline.json\n'
        'python scripts/render-demo-v03.py --timeline media/v03/narration-aiden/narration-timeline.json --mix-manifest media/v03/narration-aiden/audio-mix.json\n\n'
        'Actual recorded workbench captures and explanatory task illustrations are labelled. No fresh model request or execution occurs in this film.\n'
        'Speech regeneration separately requires the installed pinned Qwen3-TTS 0.6B model and accepted Aiden configuration. Weights/runtime are not bundled.\n')
with zipfile.ZipFile(output/'accessfinish-submission-copy.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root/'submission').glob('*')):
        if file.is_file(): archive.write(file,'submission/'+file.name)
shutil.copy2(root/'submission/release-notes-v02.md',output/'release-notes.md')
names=['accessfinish-test-build.zip','accessfinish-demo.mp4','accessfinish-demo.srt',
       'accessfinish-media-source.zip','accessfinish-submission-copy.zip','release-notes.md']
assets=[{'name':name,'bytes':(output/name).stat().st_size,'sha256':sha(output/name)} for name in names]
checks=json.loads((root/'media/v03/final-checks.json').read_text(encoding='utf-8'))
assert next(a['sha256'] for a in assets if a['name']=='accessfinish-demo.mp4')==checks['video_sha256']
manifest={'schema_version':1,'version':'0.2.0','presentation_revision':'v03',
    'state':'LOCAL_PREPARATION_AWAITING_TWO_REVIEWER_RESPONSES',
    'prepared_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'application_source_commit':previous['source_commit'],'application_source_tree':previous['source_tree'],
    'functional_build_reused_unchanged':True,
    'functional_build_note':'Embedded submission files predate this presentation update; updated submission copy is separate. Rebuild the final functional source archive after reviewer fixes and source commit.',
    'presentation_source':'Local uncommitted snapshot; file hashes below',
    'presentation_source_sha256':{p.relative_to(root).as_posix():sha(p) for p in media_files},
    'assets':assets,'model_experiment':previous['model_experiment'],
    'video':{'seconds':117.8,'width':1600,'height':900,'fps':30,'frames':3534,'audio_streams':1,
        'voice':'Aiden','language':'English','new_model_request':False,'new_isolated_execution':False,
        'actual_ui_captures':True,'labelled_task_illustrations':True,'edited_timing':True,
        'entrant_playback_approved':False},
    'private_youtube_url':'https://youtu.be/Ma9cEARXV2g','public_youtube_url':None,
    'human_browser_reviews_completed':0,'devpost_receipt':None,
    'github_draft_release_changed':False,'licenses':previous['licenses']}
(output/'release-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
checksums=assets+[{'name':'release-manifest.json','sha256':sha(output/'release-manifest.json')}]
(output/'SHA256SUMS.txt').write_text(''.join(a['sha256']+'  '+a['name']+'\n' for a in checksums),encoding='utf-8')
for name in ['accessfinish-test-build.zip','accessfinish-media-source.zip','accessfinish-submission-copy.zip']:
    with zipfile.ZipFile(output/name) as archive:
        assert archive.testzip() is None
print(json.dumps({'state':manifest['state'],'assets':len(assets),'media_source_bytes':(output/'accessfinish-media-source.zip').stat().st_size,
    'application_source_commit':previous['source_commit'],'new_model_requests':0}))
