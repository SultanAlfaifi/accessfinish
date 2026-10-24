"""Eight-second visual study only; narration and final film remain pending."""
import json
import math
import pathlib
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/v03'
OUT.mkdir(exist_ok=True)
W, H, FPS, SECONDS = 1600, 900, 30, 8
PAPER, INK, MUTED = '#F5F0E7', '#152127', '#59656A'
BLUE, RED, LINE = '#264BC8', '#B94431', '#D7D5CD'
fonts = {}
def font(size, serif=False, bold=False):
    key = size, serif, bold
    if key not in fonts:
        name = ('georgiab.ttf' if bold else 'georgia.ttf') if serif else ('seguisb.ttf' if bold else 'segoeui.ttf')
        fonts[key] = ImageFont.truetype('C:/Windows/Fonts/' + name, size)
    return fonts[key]
def ease(x):
    x = min(1, max(0, x))
    return 1 - (1-x)**3
def text(d, xy, value, size, color=INK, serif=False, bold=False):
    d.text(xy, value, fill=color, font=font(size, serif, bold))
def pill(d, box, label, fill=BLUE, color='white', size=18):
    d.rounded_rectangle(box, radius=8, fill=fill)
    bb = d.textbbox((0,0), label, font=font(size, bold=True))
    x = (box[0]+box[2]-(bb[2]-bb[0]))/2
    y = (box[1]+box[3]-(bb[3]-bb[1]))/2-bb[1]
    text(d, (x,y), label, size, color, bold=True)

source = Image.open(ROOT / 'media/raw/v02/02-blockage.jpg').convert('RGB')
crop = source.crop((410, 40, 1252, 363))
def frame(t):
    im = Image.new('RGB', (W,H), PAPER)
    d = ImageDraw.Draw(im)
    d.rectangle((0,0,14,H), fill=BLUE)
    text(d, (78,48), 'ACCESSFINISH', 25, bold=True)
    text(d, (1192,52), 'REVIEW. VERIFY. FINISH.', 17, MUTED, bold=True)
    d.line((78,111,1522,111), fill=LINE, width=2)
    if t < 4.6:
        rise = int(24*(1-ease(t/.8)))
        text(d,(78,173+rise),'One appointment.',83,serif=True)
        text(d,(78,281+rise),'One date.',83,serif=True)
        text(d,(82,427),'Can you finish it',41)
        text(d,(82,481),'using only a keyboard?',41)
        # A labelled explanatory task card, not a fabricated application capture.
        x,y = 914,192
        d.rounded_rectangle((x,y,1522,710),radius=22,fill='white',outline=LINE,width=2)
        pill(d,(x+34,y+30,x+196,y+70),'THE TASK',size=16)
        text(d,(x+34,y+104),'November 2',53,serif=True)
        text(d,(x+36,y+170),'2026',30,MUTED)
        d.line((x+34,y+238,1486,y+238),fill=LINE,width=2)
        text(d,(x+34,y+267),'09:00 — 09:30',40,bold=True)
        text(d,(x+36,y+327),'Riyadh time',25,MUTED)
        pill(d,(x+34,y+399,1486,y+454),'KEYBOARD ONLY',fill='#E9ECF8',color=BLUE,size=20)
        # Two reachable controls surround the skipped date control.
        labels=[('Service',82,642,False),('Date',307,642,True),('Continue',532,642,False)]
        for label,lx,ly,blocked in labels:
            d.rounded_rectangle((lx,ly,lx+182,ly+66),radius=8,fill=PAPER,outline=LINE,width=2)
            text(d,(lx+20,ly+16),label,23,MUTED)
        progress = ease((t-1.35)/1.4)
        # Keyboard focus jumps between reachable controls; it never lands on Date.
        focusx = 82 if t < 1.6 else 532
        d.rounded_rectangle((focusx-5,637,focusx+187,713),radius=12,outline=BLUE,width=4)
        # The arrow explicitly skips the middle date field.
        if t > 1.3:
            arrowx = int(173 + 450*progress)
            d.line((173,614,arrowx,614),fill=BLUE,width=3)
            d.polygon([(arrowx,614),(arrowx-13,605),(arrowx-13,623)],fill=BLUE)
            pill(d,(76,563,156,602),'Tab',fill=INK,size=20)
        if t > 2.6:
            pulse=1+.06*math.sin((t-2.6)*5)
            d.line((321,656,474,697),fill=RED,width=3)
            text(d,(308,729),'Date skipped.',23,RED,bold=True)
        text(d,(82,812),'TASK ILLUSTRATION  /  Guided Easy!Appointments case',18,MUTED)
    else:
        text(d,(78,160),'The page loads.',70,serif=True)
        text(d,(78,252),'The task is still blocked.',70,serif=True)
        zoom=1+.015*ease((t-4.6)/3.4)
        scale=min(1250/crop.width,390/crop.height)*zoom
        cw,ch=int(crop.width*scale),int(crop.height*scale)
        panel=crop.resize((cw,ch),Image.Resampling.LANCZOS)
        # Crop stays inside a fixed viewport; content remains original.
        viewport=Image.new('RGB',(1300,425),'white')
        viewport.paste(panel, ((1300-cw)//2,(425-ch)//2))
        im.paste(viewport,(82,363))
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((81,362,1383,789),radius=8,outline=LINE,width=2)
        text(d,(82,814),'ACTUAL RECORDED WORKBENCH  /  Original source and keyboard blockage',18,MUTED)
    d.rectangle((78,873,78+int(1444*min(t/SECONDS,1)),877),fill=BLUE)
    return im

movie = OUT / 'motion-study-08s.mp4'
cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}',
     '-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20',
     '-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',str(movie)]
child=subprocess.Popen(cmd,stdin=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
for i in range(FPS*SECONDS):
    child.stdin.write(frame(i/FPS).tobytes())
child.stdin.close()
if child.wait():
    raise SystemExit('Motion study render failed')
frame(3.4).save(OUT/'styleframe-task.png')
frame(6.6).save(OUT/'styleframe-workbench.png')
(OUT/'motion-study.json').write_text(json.dumps({'state':'visual_study_only','seconds':SECONDS,
    'fps':FPS,'width':W,'height':H,'audio':False,'final_video':False,
    'source':'media/raw/v02/02-blockage.jpg','new_model_inference':False,
    'claim':'Labelled task illustration followed by unchanged actual workbench crop.'},indent=2)+'\n')
print(movie)
