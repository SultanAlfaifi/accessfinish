"""Verify final media and prepare event-driven frames for human visual inspection."""
import hashlib
import json
import pathlib
import subprocess
from PIL import Image,ImageDraw

root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'media/v03'
video=folder/'accessfinish-demo-v03.mp4'
timeline=json.loads((folder/'narration-aiden/narration-timeline.json').read_text())
manifest=json.loads(video.with_suffix('.manifest.json').read_text())
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames',
    '-show_streams','-show_format','-of','json',str(video)]))
visual=next(s for s in probe['streams'] if s['codec_type']=='video')
audio=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (visual['width'],visual['height'])==(1600,900)
assert visual['avg_frame_rate']=='30/1'
assert int(visual['nb_read_frames'])==round(manifest['duration_seconds']*30)
assert audio['codec_name']=='aac' and int(audio['sample_rate'])==48000
assert manifest['duration_seconds']<180
assert hashlib.sha256(video.read_bytes()).hexdigest()==manifest['sha256']
phases={p:(min(b['start_seconds'] for b in timeline['beats'] if b['paragraph']==p),
    max(b['end_seconds'] for b in timeline['beats'] if b['paragraph']==p)) for p in range(1,12)}
samples=[(f'scene-{p:02}',a+(b-a)*.62) for p,(a,b) in phases.items()]
samples += [('approval',next(b['start_seconds']+.5 for b in timeline['beats'] if b['id']=='beat-07')),
            ('first-frame',0),('last-frame',manifest['duration_seconds']-1/30)]
review=folder/'review-frames'
review.mkdir(exist_ok=True)
sheet=Image.new('RGB',(2400,5*470),'#DDDDDD')
draw=ImageDraw.Draw(sheet)
for i,(name,t) in enumerate(samples):
    path=review/(name+'.png')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(t),'-i',str(video),
        '-frames:v','1','-update','1','-y',str(path)],check=True)
    frame=Image.open(path).convert('RGB')
    x,y=(i%3)*800,(i//3)*470
    sheet.paste(frame.resize((800,450)),(x,y+20))
    draw.text((x+8,y+3),f'{name} @ {t:.2f}s',fill='black')
sheet.save(folder/'final-contact-sheet.jpg',quality=94)
source_files=['scripts/render-demo-v03.py','scripts/mix-v03-audio.py','media/v03/brief.json',
    'media/v03/narration-beats.json','media/capture-v02.json',
    'media/v03/narration-aiden/narration-timeline.json','media/v03/narration-aiden/audio-mix.json']
checks={'video_sha256':manifest['sha256'],'duration_seconds':manifest['duration_seconds'],
    'decoded_frame_count':int(visual['nb_read_frames']),'expected_frame_count':round(manifest['duration_seconds']*30),
    'width':visual['width'],'height':visual['height'],'fps':30,'audio_codec':audio['codec_name'],
    'audio_sample_rate':audio['sample_rate'],'full_decode_passed':manifest['full_decode_passed'],
    'source_sha256':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in source_files},
    'sampled_frames':[{'name':name,'seconds':round(t,4)} for name,t in samples],
    'visual_frame_review':'pending','normal_speed_end_to_end_playback':'not_performed_by_agent',
    'listening_review':'pending_user','publication':'local_only'}
(folder/'final-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({k:checks[k] for k in ['duration_seconds','decoded_frame_count','audio_codec','full_decode_passed']}))
