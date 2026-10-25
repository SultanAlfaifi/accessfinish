"""Narrated product film using actual audio timings and retained project evidence.

--contact-sheet prepares visual studies without generating speech or inventing
timestamps. Final rendering requires the accepted narration timeline and WAV.
"""
import argparse
import hashlib
import json
import math
import pathlib
import subprocess
import textwrap
from PIL import Image,ImageDraw,ImageFont

ROOT=pathlib.Path(__file__).resolve().parents[1]
MEDIA=ROOT/'media/v03'
RAW=ROOT/'media/raw/v02'
W,H,FPS=1600,900,30
PAPER,INK,MUTED,BLUE,RED,GREEN,LINE='#F5F0E7','#152127','#59656A','#264BC8','#B94431','#20715C','#D7D5CD'
FONT_CACHE={}
IMAGE_CACHE={}
PANEL_CACHE={}
brief=json.loads((MEDIA/'brief.json').read_text())
plan=json.loads((MEDIA/'narration-beats.json').read_text())
capture=json.loads((ROOT/'media/capture-v02.json').read_text())
trials=[json.loads((ROOT/f'web/records/evaluation-{i}.json').read_text()) for i in range(1,6)]
assert sum(t['claim']['state']=='verified' for t in trials)==2
assert trials[0]['execution']['keyboard_booking_verified'] is True
assert 'Calendar navigation' in trials[0]['claim']['error']
assert trials[3]['claim']['proposal_sha256']==brief['proposal_sha256']
assert capture['proposal_sha256']==brief['proposal_sha256']

def font(size,serif=False,bold=False):
    key=size,serif,bold
    if key not in FONT_CACHE:
        name=('georgiab.ttf' if bold else 'georgia.ttf') if serif else ('seguisb.ttf' if bold else 'segoeui.ttf')
        FONT_CACHE[key]=ImageFont.truetype('C:/Windows/Fonts/'+name,size)
    return FONT_CACHE[key]
def ease(x):
    return 1-(1-min(1,max(0,x)))**3
def txt(d,xy,value,size=30,color=INK,serif=False,bold=False):
    d.text(xy,value,font=font(size,serif,bold),fill=color)
def tag(d,xy,value,color=BLUE):
    f=font(17,bold=True)
    width=d.textlength(value,font=f)+28
    x,y=xy
    d.rounded_rectangle((x,y,x+width,y+34),radius=5,fill=color)
    txt(d,(x+14,y+6),value,17,'white',bold=True)
def image(name):
    if name not in IMAGE_CACHE:
        IMAGE_CACHE[name]=Image.open(RAW/name).convert('RGB')
    return IMAGE_CACHE[name]
def panel(im,name,box,crop=None):
    x,y,x2,y2=box
    key=(name,tuple(box),tuple(crop) if crop else None)
    if key not in PANEL_CACHE:
        source=image(name)
        if crop:
            source=source.crop(crop)
        scale=min((x2-x-32)/source.width,(y2-y-24)/source.height)
        PANEL_CACHE[key]=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.LANCZOS)
    resized=PANEL_CACHE[key]
    d=ImageDraw.Draw(im)
    d.rounded_rectangle(box,radius=10,fill='white',outline=LINE,width=2)
    im.paste(resized,(round((x+x2-resized.width)/2),round((y+y2-resized.height)/2)))
def card(d,box,passed=False,compact=False):
    x,y,x2,y2=box
    d.rounded_rectangle(box,radius=16,fill='white',outline=GREEN if passed else LINE,width=2)
    if compact:
        txt(d,(x+22,y+16),'NOV 2 / 2026',24,serif=True)
        txt(d,(x+22,y+54),'09:00–09:30 Riyadh',18,MUTED)
        return
    tag(d,(x+34,y+28),'VERIFIED TASK' if passed else 'THE TASK',GREEN if passed else BLUE)
    txt(d,(x+34,y+102),'November 2',52,serif=True)
    txt(d,(x+36,y+169),'2026',30,MUTED)
    d.line((x+34,y+230,x2-34,y+230),fill=LINE,width=2)
    txt(d,(x+34,y+258),'09:00 — 09:30',39,bold=True)
    txt(d,(x+36,y+315),'Riyadh time',25,MUTED)
    txt(d,(x+36,y+388),'Keyboard only',24,GREEN if passed else BLUE,bold=True)
def caption(im,text):
    d=ImageDraw.Draw(im)
    d.rectangle((0,740,W,H),fill=INK)
    lines=textwrap.wrap(text,width=66,break_long_words=False,break_on_hyphens=False)
    line_height=39
    top=740+(160-len(lines)*line_height)/2-3
    for i,line in enumerate(lines):
        width=d.textlength(line,font=font(30))
        txt(d,((W-width)/2,top+i*line_height),line,30,'#FFFDF8')
def base():
    im=Image.new('RGB',(W,H),PAPER)
    d=ImageDraw.Draw(im)
    d.rectangle((0,0,14,H),fill=BLUE)
    txt(d,(78,42),'ACCESSFINISH',25,bold=True)
    txt(d,(1180,48),'REVIEW. VERIFY. FINISH.',17,MUTED,bold=True)
    d.line((78,98,1522,98),fill=LINE,width=2)
    return im,d

def frame(paragraph,progress,beat_text,beat_progress=.5,global_progress=0,scene_seconds=None):
    im,d=base()
    if paragraph==1:
        rise=round(18*(1-ease(progress*4)))
        txt(d,(78,161+rise),'One appointment.',83,serif=True)
        txt(d,(78,268+rise),'One date.',83,serif=True)
        txt(d,(82,417),'Can you finish it',41)
        txt(d,(82,472),'using only a keyboard?',41)
        tag(d,(82,650),'TASK ILLUSTRATION')
        card(d,(914,158,1522,686))
    elif paragraph==2:
        txt(d,(78,136),'Focus skips the date.',65,serif=True)
        tag(d,(78,234),'KEYBOARD BLOCKED',RED)
        # A labelled diagram explains the defect; the real source remains visible.
        for label,x in [('Service',82),('Date',307),('Continue',532)]:
            d.rounded_rectangle((x,313,x+182,374),radius=8,outline=LINE,width=2)
            txt(d,(x+20,326),label,23,MUTED)
        x=82 if progress<.20 else 532
        d.rounded_rectangle((x-5,308,x+187,379),radius=12,outline=BLUE,width=4)
        arrow=round(173+450*ease((progress-.14)/.3))
        d.line((173,291,arrow,291),fill=BLUE,width=3)
        if progress>.3:
            d.line((320,326,472,363),fill=RED,width=3)
        txt(d,(82,397),'Task illustration',17,MUTED)
        card(d,(1222,134,1522,239),compact=True)
        panel(im,'02-blockage.jpg',(82,442,1522,677),(412,231,1249,363))
        txt(d,(82,690),'ACTUAL RECORDED WORKBENCH / ORIGINAL SOURCE',17,MUTED)
    elif paragraph==3:
        txt(d,(78,137),'Review the repair.',66,serif=True)
        txt(d,(78,222),'Verify the outcome.',66,serif=True)
        card(d,(1222,134,1522,239),compact=True)
        panel(im,'01-opening.jpg',(82,328,1522,682),(144,441,1505,849))
        txt(d,(82,693),'ACTUAL RECORDED WORKBENCH / GUIDED CASE',17,MUTED)
    elif paragraph==4:
        txt(d,(78,132),'A retained model proposal.',61,serif=True)
        tag(d,(82,220),'DIAGNOSIS + REPAIR DIRECTION SUPPLIED')
        panel(im,'03-model-record.jpg',(82,282,1522,646),(413,337,1251,547))
        txt(d,(82,668),'NVIDIA Nemotron 3 Super  /  Nebius Token Factory',28,bold=True)
        txt(d,(82,709),'RECORDED RESPONSE / NO NEW MODEL REQUEST IN THIS FILM',17,MUTED)
    elif paragraph==5:
        approval='Approval' in beat_text
        txt(d,(78,132),'Approve the exact change.' if approval else 'Inspect the source repair.',60,serif=True)
        if approval:
            panel(im,'07-approved-hash.jpg',(82,235,1522,633),(413,148,1250,401))
            txt(d,(82,660),'PATCH SHA-256',17,BLUE,bold=True)
            txt(d,(82,691),brief['proposal_sha256'],20,MUTED)
        else:
            name='04-date-input.jpg' if beat_progress<.5 else '06-preserve-date.jpg'
            panel(im,name,(82,235,1522,647),(413,250,1250,523))
            txt(d,(82,673),'Editable date input. Preserve the typed date during refresh.',27,bold=True)
        tag(d,(1135,195),'ACTUAL SOURCE REVIEW')
    elif paragraph==6:
        txt(d,(78,131),'Put the proposal to the test.',60,serif=True)
        tag(d,(82,216),'RECORDED EXECUTION / EDITED TIMING')
        index=min(49,round(progress*49))
        actual_flag=capture['execution_frames'][index]['flag']
        stage={'QUEUED':0,'PREPARING':0,'BUILDING':1,'BOOKING':2,'VERIFYING':3,'VERIFIED':4}.get(actual_flag,0)
        tag(d,(1175,216),actual_flag,GREEN if actual_flag=='VERIFIED' else BLUE)
        names=['Fresh fixture','Build','Keyboard task','Storage reader','Fresh browser']
        for i,name in enumerate(names):
            x=82+i*290
            if i<4:
                d.line((x+249,298,x+286,298),fill=LINE,width=3)
            d.rounded_rectangle((x,267,x+249,331),radius=9,
                fill=BLUE if i==stage else 'white',outline=BLUE if i==stage else LINE,width=2)
            txt(d,(x+14,284),name,23,'white' if i==stage else INK,bold=True)
        panel(im,f'live-{index:03}.jpg',(82,355,1522,709),(413,322,1248,518))
    elif paragraph==7:
        txt(d,(78,130),'Saved. Independently reopened.',58,serif=True)
        tag(d,(82,215),'MATCHED EXPECTED BOOKING',GREEN)
        panel(im,'09-verified-outcome.jpg',(82,280,1522,565),(414,144,1247,382))
        for i,(name,detail) in enumerate([('Keyboard task','Completed'),('Storage reader','Matching date and time'),('Fresh browser','Reopened independently')]):
            x=82+i*485
            color=GREEN if progress>(i*.17) else MUTED
            d.rounded_rectangle((x,591,x+455,700),radius=10,fill='white',outline=LINE,width=2)
            txt(d,(x+20,606),name,28,color,bold=True)
            txt(d,(x+20,650),detail,20,MUTED)
    elif paragraph==8:
        txt(d,(78,132),'Keyboard passed.',66,serif=True)
        txt(d,(78,218),'Calendar failed.',66,RED,serif=True)
        tag(d,(1130,155),'TRIAL 1 / REJECTED',RED)
        panel(im,'10-all-outcomes.jpg',(82,345,1522,558),(145,60,1505,151))
        txt(d,(82,608),'A successful booking alone is not enough.',37,bold=True)
        txt(d,(82,668),'The full frozen procedure decides.',28,MUTED)
    elif paragraph==9:
        tag(d,(1190,108),'FROZEN ATTEMPTS')
        txt(d,(78,129),'2 of 5',100,GREEN,serif=True)
        txt(d,(79,252),'complete passes',31,bold=True)
        txt(d,(80,319),'One guided,',27,MUTED)
        txt(d,(80,361),'exposed case.',27,MUTED)
        outcomes=['Calendar control failed','Build failed','Passed','Passed','Build failed']
        for i,label in enumerate(outcomes):
            x,y=566,156+i*88
            good=trials[i]['claim']['state']=='verified'
            reveal=ease(progress*4-i*.30)
            offset=round(28*(1-reveal))
            row=Image.new('RGBA',(980,76),(0,0,0,0))
            rd=ImageDraw.Draw(row)
            rd.rounded_rectangle((0,0,954,73),radius=9,fill='white',outline=LINE,width=2)
            txt(rd,(24,18),f'{i+1:02}',26,MUTED)
            txt(rd,(110,18),label,28,GREEN if good else RED,bold=True)
            row.putalpha(row.getchannel('A').point(lambda a:round(a*reveal)))
            im.paste(row,(x+offset,y),row)
        d=ImageDraw.Draw(im)
        txt(d,(82,622),'Every failure is retained.',31,bold=True)
        txt(d,(82,674),'Broader repair accuracy and screen-reader validation remain open.',25,MUTED)
    elif paragraph==10:
        txt(d,(78,154),'Did the user finish',65,serif=True)
        txt(d,(78,239),'with the right data?',65,serif=True)
        txt(d,(82,410),'For developers and',33)
        txt(d,(82,458),'accessibility QA.',33)
        tag(d,(82,624),'REVIEW. APPROVE. VERIFY.',GREEN)
        card(d,(914,142,1522,687),passed=True)
    else:
        txt(d,(78,167),'AccessFinish.',110,serif=True)
        txt(d,(82,359),'Review the repair.',48)
        txt(d,(82,427),'Verify the outcome.',48)
        txt(d,(82,596),'sultalfaifi.com/accessfinish/',34,BLUE,bold=True)
        tag(d,(82,674),'SOURCE + RETAINED OUTCOMES')
    if scene_seconds is not None and scene_seconds<.32:
        # Brief body entrance; keep the brand, captions and source pixels stable.
        amount=ease(scene_seconds/.32)
        body=im.crop((40,112,W,730))
        canvas=Image.new('RGB',body.size,PAPER)
        shifted=Image.new('RGB',body.size,PAPER)
        shifted.paste(body,(round(12*(1-amount)),0))
        im.paste(Image.blend(canvas,shifted,amount),(40,112))
    d=ImageDraw.Draw(im)
    d.rectangle((78,732,78+round(1444*global_progress),736),fill=BLUE)
    caption(im,beat_text)
    return im

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--contact-sheet',action='store_true')
    parser.add_argument('--timeline',type=pathlib.Path)
    parser.add_argument('--mix-manifest',type=pathlib.Path)
    parser.add_argument('--output',type=pathlib.Path,default=MEDIA/'accessfinish-demo-v03.mp4')
    args=parser.parse_args()
    if args.contact_sheet:
        sheet=Image.new('RGB',(2400,1800),'#DDDDDD')
        for p in range(1,12):
            beat=next(b for b in plan['beats'] if b['paragraph']==p)
            im=frame(p,.62,beat['text'],.62,p/11)
            im.save(MEDIA/f'scene-{p:02}-study.png')
            sheet.paste(im.resize((800,450)),(((p-1)%3)*800,((p-1)//3)*450))
        sheet.save(MEDIA/'story-contact-sheet.jpg')
        print('Visual studies prepared; no narration or final timing generated.')
        return
    if not args.timeline:
        raise SystemExit('Final rendering requires an actual accepted narration timeline.')
    timeline=json.loads(args.timeline.read_text())
    audio=args.timeline.parent/timeline['narration_file']
    if hashlib.sha256(audio.read_bytes()).hexdigest()!=timeline['narration_sha256']:
        raise SystemExit('Narration does not match its measured timeline.')
    if not timeline.get('default_voice_accepted_by_user'):
        raise SystemExit('Finish listening acceptance before final narration rendering.')
    mix=None
    if args.mix_manifest:
        mix=json.loads(args.mix_manifest.read_text())
        mixed=args.mix_manifest.parent/mix['mixed_file']
        if mix['narration_sha256']!=timeline['narration_sha256'] or hashlib.sha256(mixed.read_bytes()).hexdigest()!=mix['mixed_sha256']:
            raise SystemExit('Audio mix does not match the accepted narration and retained manifest.')
        audio=mixed
    if args.output.exists():
        raise SystemExit('Preserve existing output; choose a new filename.')
    beats=timeline['beats']
    phases={p:(min(b['start_seconds'] for b in beats if b['paragraph']==p),
               max(b['end_seconds'] for b in beats if b['paragraph']==p)) for p in range(1,12)}
    duration=timeline['duration_seconds']+.8
    frames=math.ceil(duration*FPS)
    visual=args.output.with_suffix('.silent.mp4')
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24',
         '-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-crf','20',
         '-preset','fast','-pix_fmt','yuv420p','-threads','2',str(visual)]
    child=subprocess.Popen(cmd,stdin=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    for i in range(frames):
        t=i/FPS
        beat=max((b for b in beats if b['start_seconds']<=t),key=lambda b:b['start_seconds'],default=beats[0])
        p=beat['paragraph']
        start,end=phases[p]
        progress=min(1,max(0,(t-start)/max(.01,end-start)))
        bp=min(1,max(0,(t-beat['start_seconds'])/max(.01,beat['end_seconds']-beat['start_seconds'])))
        child.stdin.write(frame(p,progress,beat['text'],bp,t/duration,t-start).tobytes())
        if i%(FPS*10)==0:
            print(json.dumps({'rendered_seconds':round(t,1),'total_seconds':round(duration,2)}),flush=True)
    child.stdin.close()
    if child.wait():
        raise SystemExit('Visual render failed')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(visual),'-i',str(audio),
        '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k',
        '-af','apad=pad_dur=0.8','-t',str(frames/FPS),'-movflags','+faststart',str(args.output)],check=True,
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    subprocess.run(['ffmpeg','-v','error','-i',str(args.output),'-f','null','-'],check=True,
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    (args.output.with_suffix('.manifest.json')).write_text(json.dumps({
        'version':'v03','narration_timeline':str(args.timeline),'voice':timeline['voice'],
        'duration_seconds':frames/FPS,'width':W,'height':H,'fps':FPS,
        'audio':'Local accepted English narration with original procedural UI accents; music-free' if mix else 'Local accepted English narration; music-free',
        'mix_manifest':str(args.mix_manifest) if mix else None,'full_decode_passed':True,
        'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),
        'claim_boundary':brief['claim_boundary'],'not_published':True},indent=2)+'\n')
    print(str(args.output))

if __name__=='__main__':
    main()
