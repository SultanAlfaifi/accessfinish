"""Technical and sampled-frame review; does not claim listening or full playback."""
import hashlib,json,pathlib,re,subprocess
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'media/v04'; video=out/'accessfinish-demo-v04.mp4'
timeline=json.loads((out/'narration-aiden/narration-timeline.json').read_text())
manifest=json.loads((out/'render-manifest.json').read_text())
assert hashlib.sha256(video.read_bytes()).hexdigest()==manifest['sha256']
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(video)]))
v=next(s for s in probe['streams'] if s['codec_type']=='video'); a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['avg_frame_rate'],int(v['nb_read_frames']))==(1600,900,'30/1',3285)
decoded=subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],capture_output=True,text=True)
assert decoded.returncode==0 and not decoded.stderr.strip()
volume=subprocess.run(['ffmpeg','-v','info','-i',str(video),'-vn','-af','loudnorm=I=-16:TP=-1:LRA=8:print_format=json','-f','null','-'],capture_output=True,text=True)
loudness=json.loads(re.search(r'\{\s*"input_i"[\s\S]+?\}',volume.stderr).group())
assert -18<float(loudness['input_i'])<-14
assert float(loudness['input_tp'])<0
moments=[0,2,4.5]+[round((b['start_seconds']+b['end_seconds'])/2,3) for b in timeline['beats']]+[109.4]
review=root/'media/review/v04';review.mkdir(parents=True,exist_ok=True)
sheet=Image.new('RGB',(1600,5*330),'#DAD7CE');draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
for n,t in enumerate(moments):
 target=review/f'{n:02}-{t:.3f}.jpg'
 subprocess.run(['ffmpeg','-y','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1',str(target)],check=True)
 image=Image.open(target).convert('RGB').resize((520,293),Image.Resampling.LANCZOS)
 x,y=(n%3)*533,(n//3)*330;sheet.paste(image,(x,y));draw.text((x+8,y+298),f'{t:.3f}s',font=font,fill='#152127')
sheet.save(out/'encoded-contact-sheet.jpg',quality=94)
result={'video_sha256':manifest['sha256'],'technical':'passed','full_decode':'passed','decoded_frames':3285,
 'duration_seconds':109.5,'audio_streams':1,'audio_loudness':loudness,'sampled_encoded_frames':moments,
 'visual_review':'contact sheet prepared; human or agent visual inspection recorded separately',
 'continuous_playback':'not performed','listening':'not performed','entrant_playback_approved':False,
 'narration_engine':'Local Qwen3-TTS 0.6B CustomVoice / Aiden','new_model_requests_during_render':0,
 'music':False,'audio_provenance':'Local synthetic narration only; no imported music or effects'}
(out/'technical-review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
