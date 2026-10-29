"""Edit the screen-recorded film: cut the recorded scenes to the narration, add captions and labels.

  python3 scripts/film/render-live-film.py [--draft]  ->  media/accessfinish-live-demo.mp4

The footage is the take chosen by the film workflow (media/live-film/takes.json): before.mp4, live.mp4
and after.mp4 with their event logs, recorded on a GitHub Actions runner by scripts/film/shoot.cjs.
Every shot is a span between two logged events. Speed-ups are labelled on screen; nothing is
redrawn or re-enacted. Beat lengths come from media/live-film/timeline.json (scripts/narrate.py with
AF_NARRATION_DIR=media/live-film); --draft estimates them from the word count and renders silent.
"""
import json, pathlib, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
FILM = ROOT / 'media/live-film'
OUT = ROOT / 'media/accessfinish-live-demo.mp4'
W, H, FPS, LEAD, TAIL = 1920, 1080, 30, 0.8, 1.6
DRAFT = '--draft' in sys.argv
FONTS = pathlib.Path('/usr/share/fonts/opentype/inter')
font = lambda name, size: ImageFont.truetype(str(FONTS / f'Inter-{name}.otf'), size)

takes = json.loads((FILM / 'takes.json').read_text())
TAKE = FILM / 'takes' / takes['chosen']
SOURCE = {name: TAKE for name in ('before', 'live', 'after')}
for name in ('before', 'after'):
    retake = FILM / f'retake-{name}.json'
    if retake.exists():
        SOURCE[name] = FILM / f'retake-{name}' / json.loads(retake.read_text())['chosen']
scenes = {name: json.loads((SOURCE[name] / f'{name}.json').read_text()) for name in SOURCE}
trace = json.loads((TAKE / 'trace.json').read_text()) if (TAKE / 'trace.json').exists() else None
narration = json.loads((FILM / 'narration.json').read_text())
timeline = None if DRAFT else json.loads((FILM / 'timeline.json').read_text())


def at(scene, event, offset=0.0, nth=0):
    """Seconds into a scene's video when its nth `event` was logged, plus an offset."""
    hits = [e for e in scenes[scene]['events'] if e['event'] == event]
    if len(hits) <= nth:
        raise SystemExit(f'{scene}: no event {event!r} (#{nth})')
    return hits[nth]['t'] + offset


LABEL = {'before': 'Easy!Appointments · original source', 'live': 'AccessFinish · live run · Nemotron 3 Super on Nebius Token Factory',
         'after': 'Easy!Appointments · with the patch AccessFinish verified'}


def verify_at(attempt):
    """When the live page showed the result of an attempt's verification."""
    hits = [e for e in scenes['live']['events'] if e['event'] == 'step' and e['kind'] == 'verify' and e['attempt'] == attempt]
    if not hits:
        raise SystemExit(f'live: no verify step for attempt {attempt}')
    return hits[0]['t']


def shots(beat):
    """The footage for a beat: (scene, start, end, speed); speed 'fit' shares the beat's remaining time."""
    if beat == 'intro':
        return [('before', 0.3, at('before', 'date-step', 1.0), 'fit')]
    if beat == 'stuck':
        return [('before', at('before', 'date-step', 1.0), at('before', 'calendar-reached', 1.5), 'fit')]
    if beat == 'start':
        return [('live', 0.3, at('live', 'server-terminal', 0.3), 1.0),
                ('live', at('live', 'page-hero', -0.4), at('live', 'run-live', 2.0), 'fit')]
    # The live run, cut where its verifications land on the page; each result is shown at real speed.
    if beat == 'sandbox':
        peek = at('live', 'peek')
        return [('live', at('live', 'run-live', 2.0), peek + 0.4, 'fit'), ('live', peek + 0.4, peek + 6.0, 1.0),
                ('live', at('live', 'peek-end', 0.1), verify_at(1) + 1.2, 'fit')]
    if beat == 'wrong':
        return [('live', verify_at(1) + 1.2, verify_at(2) - 0.4, 'fit'), ('live', verify_at(2) - 0.4, verify_at(2) + 7.0, 1.0)]
    if beat == 'today':
        return [('live', verify_at(2) + 7.0, verify_at(4) - 0.4, 'fit'), ('live', verify_at(4) - 0.4, verify_at(4) + 6.0, 1.0)]
    if beat == 'verified':
        return [('live', verify_at(4) + 6.0, verify_at(5) - 0.4, 'fit'), ('live', verify_at(5) - 0.4, verify_at(5) + 5.0, 1.0),
                ('live', at('live', 'show-step', -0.6, nth=2), at('live', 'show-step', 5.0, nth=2), 1.0)]
    if beat == 'book':
        return [('after', at('after', 'booking-page', -1.0), at('after', 'confirmation', 1.5), 'fit')]
    if beat == 'saved':
        return [('after', at('after', 'rows-command', -0.4), at('after', 'rows-command', 7.0), 'fit')]
    if beat == 'reopen':
        return [('after', at('after', 'reopened', -0.8), at('after', 'reopened-date', 3.0), 'fit')]
    if beat == 'close':
        return []
    raise SystemExit('No shots for beat ' + beat)


def chip(draw, x, y, text, fill, ink, size=24, dot=None):
    f = font('SemiBold', size)
    w = int(f.getlength(text)) + (46 if dot else 24)
    draw.rounded_rectangle((x, y, x + w, y + size + 20), radius=(size + 20) // 2, fill=fill)
    if dot:
        draw.ellipse((x + 14, y + (size + 20) // 2 - 6, x + 26, y + (size + 20) // 2 + 6), fill=dot)
    draw.text((x + (36 if dot else 12), y + 9), text, font=f, fill=ink)
    return w


def label_png(path, scene, speed):
    """Top labels in the browser's empty tab strip: what is on screen, and the speed when it isn't real time."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = 500
    x += chip(d, x, 6, 'SCREEN RECORDING', (15, 23, 42, 235), (255, 255, 255), size=20, dot=(239, 68, 68)) + 10
    x += chip(d, x, 6, LABEL[scene], (241, 245, 249, 240), (15, 23, 42), size=20) + 10
    if speed > 1.05:
        chip(d, x, 6, f'▶▶ {speed:.0f}× speed' if speed >= 2 else f'▶▶ {speed:.1f}× speed', (245, 158, 11, 245), (15, 23, 42), size=20)
    img.save(path)


def caption_png(path, text, bottom=H - 70):
    """A caption box whose bottom edge sits at `bottom` (raised in the app scenes, above the on-screen keys)."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f, maxw = font('SemiBold', 40), 1480
    lines, line = [], ''
    for word in text.split():
        test = (line + ' ' + word).strip()
        if f.getlength(test) <= maxw or not line:
            line = test
        else:
            lines.append(line); line = word
    lines.append(line)
    widest = max(f.getlength(l) for l in lines)
    top = bottom - len(lines) * 54
    d.rounded_rectangle((W / 2 - widest / 2 - 30, top - 18, W / 2 + widest / 2 + 30, bottom + 14), radius=18, fill=(8, 12, 26, 215))
    for i, l in enumerate(lines):
        d.text((W / 2 - f.getlength(l) / 2, top + i * 54), l, font=f, fill=(255, 255, 255))
    img.save(path)


def chunks(text):
    """Caption chunks: sentences, long ones split at a comma."""
    out = []
    for sentence in [s.strip() + ('' if s.strip().endswith(('.', '?', '!')) else '.') for s in text.replace('? ', '?|').replace('. ', '.|').replace('! ', '!|').split('|') if s.strip()]:
        if len(sentence) > 95 and ', ' in sentence:
            mid = sentence.rfind(', ', 0, len(sentence) // 2 + 20)
            out += [sentence[:mid + 1], sentence[mid + 2:]]
        else:
            out.append(sentence)
    return out


def run(args):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *args], check=True)


def end_card(path, duration):
    img = Image.new('RGB', (W, H), (11, 16, 32))
    d = ImageDraw.Draw(img)
    d.text((160, 200), 'AccessFinish', font=font('Bold', 92), fill=(255, 255, 255))
    d.text((160, 320), 'The AI says “fixed.” We check the user can finish.', font=font('Medium', 46), fill=(147, 197, 253))
    facts = narration.get('facts', [])
    for i, (big, small) in enumerate(facts):
        y = 470 + i * 96
        d.text((160, y), big, font=font('Bold', 52), fill=(52, 211, 153))
        d.text((520, y + 12), small, font=font('Regular', 32), fill=(203, 213, 225))
    if trace:
        when = trace['started_at_utc'][:10]
        d.text((160, 820), f"This film: live run {trace['id'][6:14]} on {when}, recorded on a GitHub Actions runner · traces in media/live-film/",
               font=font('Regular', 26), fill=(148, 163, 184))
    d.text((160, 900), 'github.com/SultanAlfaifi/accessfinish  ·  sultalfaifi.com/accessfinish', font=font('Medium', 30), fill=(148, 163, 184))
    png = path.with_suffix('.png'); img.save(png)
    run(['-loop', '1', '-i', str(png), '-t', f'{duration:.3f}', '-vf', f'fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.6', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', str(path)])


# Seconds of footage held after a beat's voice ends, before the next beat speaks: room for the
# live run's results on screen. Every other beat follows the next after the narration's own gap.
HOLD = {'stuck': 0.8, 'sandbox': 1.0, 'wrong': 1.6, 'today': 1.6, 'verified': 1.4, 'book': 0.5, 'saved': 1.0}


def main():
    beats = narration['beats']
    if timeline:
        spoken = {b['id']: b['end_seconds'] - b['start_seconds'] for b in timeline['beats']}
    else:
        spoken = {b['id']: len(b['text'].split()) / 2.4 for b in beats}
    # When each beat's voice starts in the film: the lead-in, then each beat, the narration's gap and its hold.
    starts, cursor = {}, LEAD
    for b in beats:
        starts[b['id']] = cursor; cursor += spoken[b['id']] + narration['gap_seconds'] + HOLD.get(b['id'], 0.0)
    total = starts[beats[-1]['id']] + spoken[beats[-1]['id']] + TAIL
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='af-film-'))
    pieces, report = [], []
    for i, beat in enumerate(beats):
        begin = 0.0 if i == 0 else starts[beat['id']]
        stop = starts[beats[i + 1]['id']] if i + 1 < len(beats) else total
        duration, voice_at = stop - begin, starts[beat['id']] - begin
        piece = tmp / f'{i:02d}-{beat["id"]}.mp4'
        plan = shots(beat['id'])
        if not plan:
            end_card(piece, duration)
        else:
            fixed = sum((b - a) / s for _, a, b, s in plan if s != 'fit')
            source = sum(b - a for _, a, b, s in plan if s == 'fit')
            speed = max(1.0, source / max(0.1, duration - fixed)) if source else 1.0
            parts = []
            for j, (scene, a, b, s) in enumerate(plan):
                rate = speed if s == 'fit' else s
                label = tmp / f'{i:02d}-{j}-label.png'; label_png(label, scene, rate)
                part = tmp / f'{i:02d}-{j}.mp4'
                run(['-ss', f'{max(0, a):.3f}', '-t', f'{b - a:.3f}', '-i', str(SOURCE[scene] / f'{scene}.mp4'), '-i', str(label), '-filter_complex',
                     f'[0:v]setpts=(PTS-STARTPTS)/{rate:.4f},fps={FPS},scale={W}:{H}[v];[v][1:v]overlay=0:0,format=yuv420p', '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', str(part)])
                parts.append(part); report.append(f'{beat["id"]:>9} {scene:>6} {a:7.1f}–{b:7.1f}s  ×{rate:.2f}')
            listing = tmp / f'{i:02d}-list.txt'; listing.write_text(''.join(f"file '{p}'\n" for p in parts))
            joined = tmp / f'{i:02d}-joined.mp4'
            run(['-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy', str(joined)])
            # Captions: the beat's sentences, each shown for its share of the spoken beat.
            bottom = H - 150 if plan[0][0] in ('before', 'after') else H - 70
            text_chunks = chunks(beat['text']); words = [len(c.split()) for c in text_chunks]
            inputs, graph, prev, cursor = ['-i', str(joined)], '[0:v]tpad=stop_mode=clone:stop_duration=30[base];', 'base', voice_at
            for k, c in enumerate(text_chunks):
                png = tmp / f'{i:02d}-cap{k}.png'; caption_png(png, c, bottom); inputs += ['-i', str(png)]
                length = spoken[beat['id']] * words[k] / sum(words)
                end = cursor + length + (0.35 if k + 1 < len(text_chunks) else max(0.3, duration - cursor - length - 0.05))
                graph += f"[{prev}][{k + 1}:v]overlay=0:0:enable='between(t,{cursor:.3f},{end:.3f})'[c{k}];"
                prev, cursor = f'c{k}', cursor + length
            run([*inputs, '-filter_complex', graph + f'[{prev}]format=yuv420p[out]', '-map', '[out]', '-t', f'{duration:.3f}', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', str(piece)])
        pieces.append(piece)
    listing = tmp / 'film.txt'; listing.write_text(''.join(f"file '{p}'\n" for p in pieces))
    silent = tmp / 'silent.mp4'
    run(['-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy', str(silent)])
    if DRAFT:
        out = OUT.with_name(OUT.stem + '-draft.mp4'); run(['-i', str(silent), '-c', 'copy', '-movflags', '+faststart', str(out)])
    else:
        # The voice, beat by beat at the film's own schedule, then loudness-normalised as one track.
        out, inputs, graph = OUT, ['-i', str(silent)], ''
        for k, b in enumerate(timeline['beats']):
            inputs += ['-i', str(FILM / b['file'])]
            graph += f"[{k + 1}:a]atrim=start={b.get('trim_start_seconds', 0)},asetpts=PTS-STARTPTS,adelay={int(starts[b['id']] * 1000)}:all=1[a{k}];"
        graph += ''.join(f'[a{k}]' for k in range(len(timeline['beats']))) + f"amix=inputs={len(timeline['beats'])}:normalize=0,apad,loudnorm=I=-16:TP=-1.5:LRA=7[a]"
        run([*inputs, '-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-t', f'{total:.3f}', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow',
             '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', str(out)])
    print('\n'.join(report)); print(f'{out.relative_to(ROOT)}: {total:.1f} s')


main()
