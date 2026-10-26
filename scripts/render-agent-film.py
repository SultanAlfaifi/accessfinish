"""Render the AccessFinish demo film: edited scenes built from real close-ups of the
page, timed to the generated narration.

  node scripts/capture-film-assets.cjs     # close-ups → media/agent-demo/shots/
  python3 scripts/render-agent-film.py     # → media/accessfinish-agent-demo.mp4

Numbers come from web/agent-runs/summary.json; scene lengths from
media/agent-demo/timeline.json (the real duration of each spoken beat).
"""
import json, math, pathlib, re, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEMO, SHOTS = ROOT / 'media/agent-demo', ROOT / 'media/agent-demo/shots'
OUT = ROOT / 'media/accessfinish-agent-demo.mp4'
W, H, FPS = 1920, 1080, 30
FONTS = pathlib.Path('/usr/share/fonts/opentype/inter')
font = lambda name, size: ImageFont.truetype(str(FONTS / f'{name}.otf'), size)

INK, PANEL = (11, 16, 32), (255, 255, 255)
WHITE, MUTED, BLUE, GREEN, ORANGE, RED = (241, 245, 249), (148, 163, 184), (110, 150, 255), (52, 211, 153), (251, 146, 60), (239, 68, 68)

timeline = json.loads((DEMO / 'timeline.json').read_text())
summary = json.loads((ROOT / 'web/agent-runs/summary.json').read_text())
phone, keyboard = summary['cases']['customer-phone'], summary['cases']['keyboard-date']
# Keyboard results from the first agent version that verified the case onwards (earlier versions never did).
_versions = sorted((int(v), d['cases'].get('keyboard-date', {})) for v, d in summary['agent_versions'].items())
_since = [(v, k) for v, k in _versions if v >= min((v for v, k in _versions if k.get('verified')), default=10**9)]
kb_fixed, kb_tried = sum(k.get('verified', 0) for v, k in _since), sum(k.get('runs', 0) for v, k in _since)
kb_span = f"agent v{_since[0][0]}–v{_since[-1][0]}" if len(_since) > 1 else (f"agent v{_since[0][0]}" if _since else '')

ease = lambda t: t * t * (3 - 2 * t)
clamp = lambda t: max(0.0, min(1.0, t))


def background():
    img = Image.new('RGB', (W, H), INK)
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((-400, -500, 1300, 900), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    img.paste((40, 60, 140), (0, 0), glow)
    grid = ImageDraw.Draw(img)
    for x in range(0, W, 80):
        grid.line([(x, 0), (x, H)], fill=(18, 25, 48))
    for y in range(0, H, 80):
        grid.line([(0, y), (W, y)], fill=(18, 25, 48))
    return img.convert('RGBA')


BG = background()


def wrap(text, fnt, width):
    lines, line = [], ''
    for word in text.split():
        test = (line + ' ' + word).strip()
        if fnt.getlength(test) <= width or not line:
            line = test
        else:
            lines.append(line); line = word
    return lines + [line]


def text_layer(items, size=(W, H)):
    """items: (xy, text, font, colour, max_width or None, line_gap). Returns an RGBA layer."""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for (x, y), text, fnt, colour, width, gap in items:
        for line in (wrap(text, fnt, width) if width else [text]):
            draw.text((x, y), line, font=fnt, fill=colour)
            y += int(fnt.size * gap)
    return layer


def faded(layer, alpha):
    if alpha >= 1:
        return layer
    out = layer.copy()
    out.putalpha(out.getchannel('A').point(lambda a: int(a * alpha)))
    return out


class Card:
    """A real screenshot in a rounded white panel, with zoom or pan."""
    def __init__(self, name, box, mode='fit', start=(1.0, 0.5, 0.5), end=(1.08, 0.5, 0.5)):
        self.src = Image.open(SHOTS / f'{name}.png').convert('RGB')
        self.box, self.mode, self.start, self.end = box, mode, start, end
        x0, y0, x1, y1 = box
        self.w, self.h = x1 - x0, y1 - y0
        pad = 28
        self.inner = (self.w - 2 * pad, self.h - 2 * pad)
        mask = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, self.w - 1, self.h - 1), 28, fill=255)
        self.mask = mask
        shadow = Image.new('RGBA', (self.w + 160, self.h + 160), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((80, 100, self.w + 80, self.h + 100), 32, fill=(0, 0, 0, 150))
        self.shadow = shadow.filter(ImageFilter.GaussianBlur(36))
        if mode == 'fit':  # pad the screenshot to the panel's aspect ratio
            iw, ih = self.inner
            sw, sh = self.src.size
            scale = max(sw / iw, sh / ih)
            canvas = Image.new('RGB', (int(iw * scale), int(ih * scale)), PANEL)
            canvas.paste(self.src, ((canvas.width - sw) // 2, (canvas.height - sh) // 2))
            self.src = canvas

    def view(self, t):
        iw, ih = self.inner
        sw, sh = self.src.size
        if self.mode == 'pan':  # width-fit, scroll from start[2] to end[2] (fractions of the scrollable height)
            vh = sw * ih / iw
            y = (sh - vh) * (self.start[2] + (self.end[2] - self.start[2]) * t) if sh > vh else 0
            return self.src.crop((0, int(y), sw, int(y + min(vh, sh)))).resize(self.inner, Image.BILINEAR)
        z = self.start[0] + (self.end[0] - self.start[0]) * t
        fx = self.start[1] + (self.end[1] - self.start[1]) * t
        fy = self.start[2] + (self.end[2] - self.start[2]) * t
        vw, vh = sw / z, sh / z
        x, y = (sw - vw) * fx, (sh - vh) * fy
        return self.src.crop((int(x), int(y), int(x + vw), int(y + vh))).resize(self.inner, Image.BILINEAR)

    def draw(self, frame, t, appear):
        x0, y0, _, _ = self.box
        rise = int((1 - appear) * 40)
        panel = Image.new('RGBA', (self.w, self.h), PANEL + (255,))
        panel.paste(self.view(ease(t)), (28, 28))
        panel.putalpha(self.mask.point(lambda a: int(a * appear)))
        frame.alpha_composite(faded(self.shadow, appear), (x0 - 80, y0 - 80 + rise))
        frame.alpha_composite(panel, (x0, y0 + rise))


def headline(kicker, title, colour=WHITE, y=170):
    return text_layer([((120, y), kicker, font('Inter-Bold', 22), BLUE, None, 1),
                       ((120, y + 50), title, font('InterDisplay-Bold', 62), colour, 640, 1.12)])


def stamp(text, colour, size=120, angle=-8):
    fnt = font('InterDisplay-Black', size)
    tw = int(fnt.getlength(text)) + 80
    layer = Image.new('RGBA', (tw, size + 70), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((6, 6, tw - 6, size + 64), 18, outline=colour, width=10)
    draw.text((40, 18), text, font=fnt, fill=colour)
    return layer.rotate(angle, expand=True, resample=Image.BICUBIC)


STAMP_REJECTED, STAMP_VERIFIED = stamp('REJECTED', RED), stamp('VERIFIED', GREEN, 72)


def counter(value, label, colour, xy, fnt_size=150):
    return text_layer([(xy, value, font('InterDisplay-Black', fnt_size), colour, None, 1),
                       ((xy[0] + 6, xy[1] + int(fnt_size * 1.15)), label, font('Inter-Medium', 30), MUTED, 600, 1.3)])


# ---- scenes -------------------------------------------------------------------------------
RIGHT = (900, 110, 1800, 900)


def scene_hero():
    l1 = text_layer([((0, 0), 'The AI says “fixed.”', font('InterDisplay-Bold', 110), WHITE, None, 1)], (1800, 160))
    l2 = text_layer([((0, 0), 'Did the booking actually get saved?', font('InterDisplay-Bold', 78), BLUE, None, 1)], (1800, 120))
    brand = text_layer([((160, 120), 'AccessFinish', font('Inter-Bold', 34), WHITE, None, 1),
                        ((160, 168), 'NVIDIA Nemotron · Nebius Token Factory', font('Inter-Medium', 24), MUTED, None, 1)])
    def draw(frame, t, d):
        frame.alpha_composite(faded(brand, clamp(t * d / 0.8)))
        a = ease(clamp((t * d - 0.3) / 0.8)); frame.alpha_composite(faded(l1, a), (160, 400 - int((1 - a) * 30)))
        b = ease(clamp((t * d - d * 0.55) / 0.8)); frame.alpha_composite(faded(l2, b), (160, 560 - int((1 - b) * 30)))
    return draw


def scene_card(kicker, title, card, extra=None):
    head = headline(kicker, title)
    def draw(frame, t, d):
        a = ease(clamp(t * d / 0.6))
        frame.alpha_composite(faded(head, a))
        card.draw(frame, t, a)
        if extra:
            extra(frame, t, d)
    return draw


def pop(layer, xy, start):
    def draw(frame, t, d):
        k = clamp((t * d - start * d) / 0.35)
        if k <= 0:
            return
        scale = 1.6 - 0.6 * ease(k)
        img = layer.resize((int(layer.width * scale), int(layer.height * scale)), Image.BICUBIC)
        frame.alpha_composite(faded(img, ease(k)), (xy[0] - img.width // 2, xy[1] - img.height // 2))
    return draw


def fade_in(layer, start, xy=(0, 0)):
    def draw(frame, t, d):
        k = ease(clamp((t * d - start * d) / 0.6))
        if k > 0:
            frame.alpha_composite(faded(layer, k), (xy[0], xy[1] + int((1 - k) * 20)))
    return draw


def scene_big_number():
    label = text_layer([((0, 0), 'false “booked” confirmations caught', font('InterDisplay-Bold', 64), WHITE, None, 1),
                        ((0, 90), f"across {keyboard['runs']} live keyboard runs — not one got through", font('Inter-Medium', 38), MUTED, None, 1)], (1700, 160))
    target = keyboard['false_booked_caught']
    def draw(frame, t, d):
        k = ease(clamp(t * d / 1.4))
        n = text_layer([((0, 0), str(round(target * k)), font('InterDisplay-Black', 300), ORANGE, None, 1)], (700, 360))
        frame.alpha_composite(faded(n, clamp(t * d / 0.4)), (160, 220))
        frame.alpha_composite(faded(label, ease(clamp((t * d - 0.8) / 0.6))), (160, 600))
    return draw


def scene_facts():
    tiles = [(f"{phone['verified']}/{phone['runs']}", f"phone runs verified, {phone['first_attempt']} on the first attempt", GREEN),
             (f"{kb_fixed}/{kb_tried}", f"keyboard runs fixed with no hints ({kb_span})", BLUE),
             (str(keyboard['false_booked_caught']), 'false “booked” confirmations caught', ORANGE),
             (f"${summary['cost_usd']:.2f}", f"of Nemotron for all {summary['runs']} live runs", WHITE)]
    layers = []
    for value, label, colour in tiles:
        tile = Image.new('RGBA', (380, 400), (0, 0, 0, 0))
        ImageDraw.Draw(tile).rounded_rectangle((0, 0, 379, 399), 28, fill=(20, 29, 56, 255), outline=(45, 58, 96), width=2)
        tile.alpha_composite(text_layer([((36, 50), value, font('InterDisplay-Black', 110), colour, None, 1),
                                         ((40, 210), label, font('Inter-Medium', 30), MUTED, 310, 1.3)], (380, 400)))
        layers.append(tile)
    title = text_layer([((160, 150), 'Fixes that are proven, not promised.', font('InterDisplay-Bold', 66), WHITE, None, 1)])
    def draw(frame, t, d):
        frame.alpha_composite(faded(title, ease(clamp(t * d / 0.6))))
        for i, tile in enumerate(layers):
            k = ease(clamp((t * d - 0.3 - i * 0.35) / 0.5))
            if k > 0:
                frame.alpha_composite(faded(tile, k), (160 + i * 410, 330 + int((1 - k) * 40)))
    return draw


def scene_close():
    mark = Image.new('RGBA', (150, 150), (0, 0, 0, 0))
    ImageDraw.Draw(mark).rounded_rectangle((0, 0, 149, 149), 34, fill=WHITE)
    ImageDraw.Draw(mark).text((30, 22), 'af', font=font('InterDisplay-BlackItalic', 88), fill=INK)
    words = text_layer([((0, 0), 'AccessFinish', font('InterDisplay-Bold', 120), WHITE, None, 1),
                        ((4, 160), 'Finish the task. Verify the result.', font('InterDisplay-Medium', 54), BLUE, None, 1),
                        ((4, 270), 'NVIDIA Nemotron 3 Super · Nebius Token Factory · github.com/SultanAlfaifi/accessfinish', font('Inter-Medium', 28), MUTED, None, 1)], (1600, 330))
    def draw(frame, t, d):
        k = ease(clamp(t * d / 0.7))
        frame.alpha_composite(faded(mark, k), (160, 330))
        frame.alpha_composite(faded(words, k), (360, 320 + int((1 - k) * 20)))
    return draw


def combine(*parts):
    def draw(frame, t, d):
        for part in parts:
            part(frame, t, d)
    return draw


SCENES = {
    'hero': scene_hero(),
    'phone-observe': scene_card('CASE 1 · SAVED PHONE', 'The page said “booked”. The database saved 0000000000.',
                                Card('phone-observe', RIGHT, 'fit', (1.0, 0.5, 0.3), (1.12, 0.5, 0.75))),
    'phone-propose': scene_card('NVIDIA NEMOTRON · NO HINTS', 'Nemotron finds the hard-coded value and writes the fix.',
                                Card('phone-propose', RIGHT, 'fit', (1.0, 0.5, 0.4), (1.1, 0.5, 0.6))),
    'phone-proof': scene_card('VERIFIED FOR REAL', 'Saved, reopened, and re-checked with a second customer.',
                              Card('phone-proof', RIGHT, 'pan', (1, 0.5, 0.0), (1, 0.5, 1.0)),
                              combine(fade_in(counter(f"{phone['verified']} / {phone['runs']}", f"live runs verified · {phone['first_attempt']} on the first attempt", GREEN, (120, 560), 130), 0.62),
                                      pop(STAMP_VERIFIED, (1640, 860), 0.35))),
    'keyboard-intro': scene_card('CASE 2 · A REAL UPSTREAM BUG', 'Tab can’t reach the date picker.',
                                 Card('kb-observe', RIGHT, 'fit', (1.0, 0.5, 0.3), (1.1, 0.5, 0.5))),
    'keyboard-wrong': scene_card('THE CONFIRMATION LIED', '“Booked.” Saved for the wrong day.',
                                 Card('kb-compare', (860, 250, 1820, 700), 'fit', (1.0, 0.5, 0.5), (1.04, 0.5, 0.5)),
                                 pop(STAMP_REJECTED, (1340, 820), 0.42)),
    'keyboard-provenance': scene_card('WHICH CODE CHANGED IT', 'The month-change handler overwrote the date the user typed.',
                                      Card('kb-history', (860, 150, 1820, 950), 'fit', (1.0, 0.5, 0.3), (1.22, 0.5, 0.62))),
    'keyboard-reopen': scene_card('A SECOND BUG', 'Saved correctly — but reopening shows today’s date.',
                                  Card('kb-reopen', RIGHT, 'fit', (1.25, 0.5, 0.35), (1.25, 0.5, 0.62))),
    'keyboard-verified': scene_card('FIXED BY NEMOTRON · NO HINTS', 'Both bugs fixed. Saved, reopened, mouse path intact.',
                                    Card('kb-proof', RIGHT, 'pan', (1, 0.5, 0.0), (1, 0.5, 1.0)),
                                    pop(STAMP_VERIFIED, (1640, 860), 0.4)),
    'finding': scene_big_number(),
    'facts': scene_facts(),
    'close': scene_close(),
}


# ---- captions -------------------------------------------------------------------------------
def caption_chunks(beat):
    parts = []
    for sentence in re.split(r'(?<=[.?!:])\s+', beat['text']):
        words = sentence.split()
        while len(words) > 14:
            cut = len(words) // 2
            parts.append(' '.join(words[:cut])); words = words[cut:]
        if words:
            parts.append(' '.join(words))
    total = sum(len(p.split()) for p in parts)
    t, span, out = beat['start_seconds'], beat['end_seconds'] - beat['start_seconds'], []
    for part in parts:
        length = span * len(part.split()) / total
        out.append((t, t + length, part)); t += length
    return out


CAPTION_FONT = font('Inter-Medium', 34)


def caption_layer(text):
    tw = int(CAPTION_FONT.getlength(text))
    layer = Image.new('RGBA', (tw + 56, 64), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle((0, 0, tw + 55, 63), 14, fill=(5, 8, 18, 200))
    ImageDraw.Draw(layer).text((28, 11), text, font=CAPTION_FONT, fill=WHITE)
    return layer


captions = [(a, b, caption_layer(text)) for beat in timeline['beats'] for a, b, text in caption_chunks(beat)]


# ---- render -------------------------------------------------------------------------------
def main():
    beats = timeline['beats']
    total = timeline['duration_seconds'] + 1.0
    windows = [(beat['id'], beat['start_seconds'], beats[i + 1]['start_seconds'] if i + 1 < len(beats) else total) for i, beat in enumerate(beats)]
    ffmpeg = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                               '-i', str(DEMO / timeline['narration_file']), '-af', 'apad', '-t', f'{total:.3f}',
                               '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
                               '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(OUT)], stdin=subprocess.PIPE)
    previous = None
    for scene_id, start, end in windows:
        d, draw = end - start, SCENES[scene_id]
        n = int(round(end * FPS)) - int(round(start * FPS))
        last = None
        for i in range(n):
            t = i / max(1, n - 1)
            frame = BG.copy()
            draw(frame, t, d)
            now = start + i / FPS
            for a, b, layer in captions:
                if a <= now < b:
                    frame.alpha_composite(layer, ((W - layer.width) // 2, H - 118))
            if previous is not None and i < 9:  # short crossfade from the previous scene
                frame = Image.blend(previous, frame, (i + 1) / 10)
            ffmpeg.stdin.write(frame.convert('RGB').tobytes())
            last = frame
        previous = last
        print(f'{scene_id}: {d:.1f}s', flush=True)
    ffmpeg.stdin.close(); ffmpeg.wait()
    print(f'{OUT} {total:.1f}s')


if __name__ == '__main__':
    main()
