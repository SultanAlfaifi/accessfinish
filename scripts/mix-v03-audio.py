"""Original nonmusical UI accents, aligned to known visual events and real beats."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import numpy as np
import soundfile as sf

parser=argparse.ArgumentParser()
parser.add_argument('--timeline',type=pathlib.Path,required=True)
args=parser.parse_args()
timeline=json.loads(args.timeline.read_text())
folder=args.timeline.parent
narration=folder/timeline['narration_file']
if hashlib.sha256(narration.read_bytes()).hexdigest()!=timeline['narration_sha256']:
    raise SystemExit('Narration hash mismatch')
target=folder/'narration-ui-mix.wav'
if target.exists(): raise SystemExit('Preserve previous mix; choose a fresh output directory')
voice,rate=sf.read(narration,dtype='float32')
if voice.ndim!=1: raise SystemExit('Expected mono narration')
beats=timeline['beats']
phases={p:(min(b['start_seconds'] for b in beats if b['paragraph']==p),
           max(b['end_seconds'] for b in beats if b['paragraph']==p)) for p in range(1,12)}
cues=[]
def cue(p,fraction,label,peak):
    start,end=phases[p]
    cues.append({'seconds':round(start+(end-start)*fraction,6),'purpose':label,'peak_amplitude':peak})
cue(2,.03,'Tab focus on Service in labelled task illustration',.025)
cue(2,.20,'Tab focus skips Date to Continue in labelled task illustration',.030)
approval=next(b for b in beats if b['id']=='beat-07')
cues.append({'seconds':round(approval['start_seconds']+.15,6),
             'purpose':'Show exact approval hash source crop','peak_amplitude':.020})
for i,label in enumerate(['Keyboard task confirmed','Storage-reader check confirmed','Fresh-browser reopen confirmed']):
    cue(7,.01+i*.17,label,.019)
effects=np.zeros_like(voice)
rng=np.random.default_rng(4284)
for item in cues:
    # A short, damped burst of low-pass noise; no oscillators, melody or bed.
    count=round(rate*.045)
    noise=rng.normal(size=count)
    smooth=np.convolve(noise,np.ones(9)/9,mode='same')
    seconds=np.arange(count)/rate
    envelope=(1-np.exp(-seconds/.0008))*np.exp(-seconds/.006)
    click=smooth*envelope
    click=click/max(1e-12,np.max(np.abs(click)))*item['peak_amplitude']
    index=round(item['seconds']*rate)
    end=min(index+count,len(effects))
    effects[index:end]+=click[:end-index]
mixed=voice+effects
peak=float(np.max(np.abs(mixed)))
if peak>=.98: raise SystemExit('Mix peak too high; reduce accents before encoding')
sf.write(folder/'original-ui-accents.wav',effects,rate,subtype='PCM_16')
sf.write(target,mixed,rate,subtype='PCM_16')
check=subprocess.run(['ffmpeg','-hide_banner','-i',str(target),'-af',
    'loudnorm=I=-16:TP=-1:LRA=9:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
measure=json.JSONDecoder().raw_decode(check.stderr[check.stderr.rfind('{'):])[0]
manifest={'mixed_file':target.name,'mixed_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
    'narration_sha256':timeline['narration_sha256'],'sample_rate':rate,
    'duration_seconds':len(mixed)/rate,'peak_amplitude':peak,'cues':cues,
    'provenance':'Original procedural noise synthesis in scripts/mix-v03-audio.py; no external samples',
    'music':False,'word_timestamps':False,
    'timing_source':'Actual narration beat boundaries and the renderer visual-event fractions; no inferred word alignment',
    'loudness_measurement':measure,'listening_review':'pending_user'}
(folder/'audio-mix.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'mix':str(target),'cue_count':len(cues),'loudness':measure['input_i']}))
