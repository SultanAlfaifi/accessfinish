"""Evidence-driven English review film. Uses actual local Aiden audio timings.

No model requests, downloads or publication. --study and --contact-sheet use
the same deterministic compositor as the final render.
"""
import argparse
import hashlib
import json
import math
import pathlib
import subprocess
import textwrap
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/v04'
W, H, FPS = 1600, 900, 30
PAPER, INK, BLUE, GREEN, RED, MUTED, LINE = '#F5F0E7', '#152127', '#264BC8', '#20715C', '#B94431', '#59656A', '#D7D5CD'
timeline = json.loads((OUT / 'narration-aiden/narration-timeline.json').read_text())
comparison = json.loads((ROOT / 'web/comparison.json').read_text())
model = json.loads((ROOT / 'web/phone-model-report.json').read_text())
phone = json.loads((ROOT / 'web/cases/customer-phone.json').read_text())
assert len(comparison['pairs']) == 6 and len(comparison['records']) == 12
assert model['generations'] == 1 and model['execution_replays'] == 2
assert phone['run']['id'] == 'run-cdc03648724c4e20997aa8f90a2fe56f'
assert phone['run']['result']['booking_verified']
wrong = json.loads((ROOT / 'web/records/comparison-customer-phone-original-accessfinish.json').read_text())
hardcoded = json.loads((ROOT / 'web/records/comparison-customer-phone-hardcoded-accessfinish.json').read_text())
assert wrong['result']['keyboard']['workflow']['status'] == 'confirmation_observed'
assert wrong['result']['evaluation']['pass'] is False
assert hardcoded['result']['keyboard_booking_verified']
assert hardcoded['result']['controls']['evaluation']['pass'] is False

@lru_cache(None)
def font(size, serif=False, bold=False):
    name = ('georgiab.ttf' if bold else 'georgia.ttf') if serif else ('seguisb.ttf' if bold else 'segoeui.ttf')
    return ImageFont.truetype('C:/Windows/Fonts/' + name, size)

def text(d, x, y, value, size=30, color=INK, serif=False, bold=False):
    assert d.textlength(value, font=font(size, serif, bold)) < W - x - 40, value
    d.text((x, y), value, font=font(size, serif, bold), fill=color)

def tag(d, x, y, value, color=BLUE):
    width = d.textlength(value, font=font(18, bold=True)) + 30
    d.rounded_rectangle((x, y, x + width, y + 36), radius=6, fill=color)
    text(d, x + 15, y + 6, value, 18, 'white', bold=True)

def box(d, rect, outline=LINE, fill='white'):
    d.rounded_rectangle(rect, radius=12, fill=fill, outline=outline, width=2)

def ease(x):
    return 1 - (1 - min(1, max(0, x))) ** 3

def line_item(d, y, label, value, color=INK, x=110, width=1380):
    d.line((x, y + 62, x + width, y + 62), fill=LINE, width=1)
    text(d, x, y, label, 26, MUTED)
    tw = d.textlength(value, font=font(32, bold=True))
    text(d, x + width - tw, y - 4, value, 32, color, bold=True)

@lru_cache(None)
def opening_capture():
    source = Image.open(OUT / 'assets/opening.png').convert('RGB')
    # A real workbench capture. Crop only the opening message and repair flow.
    source = source.crop((70, 125, min(1530, source.width), min(548, source.height)))
    return source.resize((1430, 414), Image.Resampling.LANCZOS)

def frame(seconds):
    beat = next((b for b in timeline['beats'] if seconds < b['end_seconds'] + .18), timeline['beats'][-1])
    i = beat['paragraph']
    p = max(0, min(1, (seconds - beat['start_seconds']) / (beat['end_seconds'] - beat['start_seconds'])))
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 14, H), fill=BLUE)
    text(d, 78, 40, 'ACCESSFINISH', 25, bold=True)
    text(d, 1130, 47, 'LOCAL REVIEW CUT / V04', 18, MUTED, bold=True)
    d.line((78, 96, 1522, 96), fill=LINE, width=2)
    rise = round(16 * (1 - ease(p * 5)))

    if i == 1:
        tag(d, 82, 131, 'ACTUAL FAILED RUN / DELIBERATELY SEEDED FAULT', RED)
        text(d, 78, 196 + rise, 'Booking confirmed.', 79, serif=True)
        if p > .23:
            text(d, 78, 290 + round(16 * (1 - ease((p - .23) * 7))), 'Wrong phone saved.', 79, RED, serif=True)
        box(d, (82, 426, 1518, 665))
        line_item(d, 460, 'Entered by the customer', '0000000042', BLUE)
        if p > .39:
            line_item(d, 554, 'Saved in the database', '0000000000', RED)
        text(d, 82, 690, 'Confirmation observed. Independent stored-data check rejected the run.', 23, MUTED)
    elif i == 2:
        text(d, 78, 127 + rise, 'Know which AI fix you can accept.', 58, serif=True)
        im.paste(opening_capture(), (85, 235))
        text(d, 82, 687, 'ACTUAL WORKBENCH / PROPOSAL → APPROVAL → EXECUTION → EVIDENCE', 21, BLUE, bold=True)
    elif i == 3:
        text(d, 78, 131 + rise, 'A new Nemotron repair.', 67, serif=True)
        tag(d, 82, 224, 'ONE GUIDED GENERATION / EXPOSED PHONE CASE')
        box(d, (82, 296, 1518, 532))
        d.rectangle((84, 298, 1516, 408), fill='#FAEBE7')
        if p > .31:
            d.rectangle((84, 410, 1516, 530), fill='#E6F2EB')
        text(d, 112, 320, 'REMOVED', 18, RED, bold=True)
        text(d, 112, 354, "phone_number: '0000000000',", 35, RED)
        if p > .31:
            text(d, 112, 430, 'ADDED', 18, GREEN, bold=True)
            text(d, 112, 466, 'phone_number: $phoneNumber.val(),', 35, GREEN)
        text(d, 82, 568, 'NVIDIA Nemotron 3 Super / Nebius Token Factory', 31, bold=True)
        text(d, 82, 620, 'Diagnosis supplied. Exact source and raw response retained.', 27, MUTED)
        text(d, 82, 681, '1 REQUEST · ESTIMATED $0.00415 BEFORE TAX', 21, BLUE, bold=True)
    elif i == 4:
        text(d, 78, 130 + rise, 'Saved. Reopened. Matched.', 65, serif=True)
        tag(d, 82, 222, 'ACTUAL NEW MODEL REPAIR / VERIFIED', GREEN)
        box(d, (82, 284, 1518, 618), GREEN)
        for n, (y, label) in enumerate([(316, 'Entered phone'), (408, 'Stored phone'), (500, 'Fresh-browser reopen')]):
            if p > n * .16:
                line_item(d, y, label, '0000000042', GREEN)
        text(d, 82, 653, 'Different-phone control: 0000000073 / passed', 30, GREEN, bold=True)
        text(d, 82, 700, 'RUN cdc03648 / RAW RECORD LINKED IN THE WORKBENCH', 18, MUTED)
    elif i == 5:
        text(d, 78, 130 + rise, 'The first booking is not enough.', 59, serif=True)
        tag(d, 82, 219, 'OPERATOR-AUTHORED HARDCODED CONTROL', RED)
        box(d, (82, 296, 762, 603), GREEN)
        box(d, (792, 296, 1518, 603), RED)
        text(d, 112, 326, 'First booking', 34, bold=True)
        text(d, 822, 326, 'Different-phone check', 34, bold=True)
        text(d, 112, 408, 'Expected  0000000042', 30, MUTED)
        text(d, 112, 466, 'Saved       0000000042', 30, GREEN)
        text(d, 822, 408, 'Expected  0000000073', 30, MUTED)
        text(d, 822, 466, 'Saved       0000000042', 30, RED)
        tag(d, 112, 536, 'PASSED', GREEN)
        tag(d, 822, 536, 'REJECTED', RED)
        text(d, 82, 658, 'Both workflows caught the regression. The failed result stays visible.', 30, bold=True)
    elif i == 6:
        text(d, 78, 130 + rise, 'A fair test comparison.', 68, serif=True)
        text(d, 82, 236, 'Conventional test-only CLI', 35, bold=True)
        text(d, 960, 236, 'AccessFinish workbench', 35, BLUE, bold=True)
        for n, label in enumerate(['Same isolated build', 'Same native keyboard task', 'Same read-only database checks', 'Same fresh reopen + regression controls']):
            y = 320 + n * 89
            box(d, (82, y, 1518, y + 67), BLUE if p > n * .16 else LINE)
            text(d, 112, y + 13, label, 29, BLUE if p > n * .16 else MUTED, bold=True)
            text(d, 1330, y + 13, 'BOTH', 27, GREEN, bold=True)
        text(d, 82, 701, 'One fixture and evaluator. No weaker baseline.', 23, MUTED)
    elif i == 7:
        text(d, 78, 126 + rise, '6 paired variants. Equal outcomes.', 58, serif=True)
        text(d, 82, 212, '12 isolated executions / all expected results observed', 29, BLUE, bold=True)
        text(d, 82, 282, 'CASE / VARIANT', 20, MUTED, bold=True)
        text(d, 910, 282, 'CONVENTIONAL', 20, MUTED, bold=True)
        text(d, 1250, 282, 'ACCESSFINISH', 20, MUTED, bold=True)
        names = [('Phone / original', 'Wrong phone', False), ('Phone / repaired reference', 'Passed', True),
                 ('Phone / hardcoded control', 'Regression failed', False), ('Date / original', 'Task blocked', False),
                 ('Date / recorded model repair', 'Passed', True), ('Date / regression control', 'Regression failed', False)]
        for n, (label, result, ok) in enumerate(names):
            if p < n * .065:
                continue
            y = 322 + n * 51
            d.line((82, y - 7, 1518, y - 7), fill=LINE, width=1)
            text(d, 82, y, label, 25)
            text(d, 910, y, result, 23, GREEN if ok else RED, bold=True)
            text(d, 1250, y, result, 23, GREEN if ok else RED, bold=True)
        text(d, 82, 668, 'SEPARATE: new Nemotron phone proposal passed 2 additional execution replays.', 25, BLUE, bold=True)
        text(d, 82, 708, 'Two replays of one proposal are one generation, not two model successes.', 20, MUTED)
    elif i == 8:
        text(d, 78, 129 + rise, 'The difference is the repair decision.', 57, serif=True)
        for n, (label, result, ok) in enumerate([('No approval', 'Execution blocked', False), ('Approval for an old patch', 'Execution blocked', False), ('Approval matches this patch', 'Execution permitted', True)]):
            y = 247 + n * 105
            box(d, (82, y, 1518, y + 80), GREEN if ok else RED)
            text(d, 112, y + 19, label, 30, bold=True)
            text(d, 1070, y + 20, result, 28, GREEN if ok else RED, bold=True)
        text(d, 82, 606, 'Source + patch + approval + run', 41, BLUE, bold=True)
        text(d, 82, 673, 'RECORDED GUARD-TEST RESULTS / CONVENTIONAL CI CAN ADD THIS INTEGRATION TOO', 20, MUTED)
    elif i == 9:
        text(d, 78, 130 + rise, 'Original date-case evaluation.', 61, serif=True)
        text(d, 78, 238, '2 / 5', 137, BLUE, serif=True)
        text(d, 660, 283, 'Full passes', 47, bold=True)
        text(d, 660, 351, 'Five guided requests. One exposed case.', 31, MUTED)
        for n, ok in enumerate([False, False, True, True, False]):
            x = 82 + n * 293
            box(d, (x, 476, x + 264, 598), GREEN if ok else RED)
            text(d, x + 20, 491, 'TRIAL ' + str(n + 1), 20, MUTED, bold=True)
            text(d, x + 20, 533, 'Passed' if ok else 'Rejected', 32, GREEN if ok else RED, bold=True)
        text(d, 82, 658, 'Original frozen model evaluation remains separate and unchanged.', 29, bold=True)
    elif i == 10:
        text(d, 78, 132 + rise, 'What this evidence establishes.', 60, serif=True)
        for n, value in enumerate(['Two exposed development cases', 'One real application', 'One deliberately seeded fault']):
            text(d, 82, 272 + n * 97, str(n + 1).zfill(2), 38, BLUE, serif=True)
            text(d, 174, 275 + n * 97, value, 39, bold=True)
        d.line((82, 578, 1518, 578), fill=LINE, width=2)
        text(d, 82, 619, 'General repair accuracy and time savings are not established.', 32, MUTED)
        text(d, 82, 688, 'INDEPENDENT BROWSER REVIEW: STILL PENDING', 21, MUTED, bold=True)
    else:
        text(d, 78, 165 + rise, 'Review the change.', 83, serif=True)
        text(d, 78, 272 + rise, 'Know which repair', 83, serif=True)
        text(d, 78, 379 + rise, 'you can accept.', 83, BLUE, serif=True)
        text(d, 82, 567, 'github.com/SultanAlfaifi/accessfinish', 38, bold=True)
        text(d, 82, 656, 'LOCAL REVIEW CUT / NEW PUBLICATION PENDING', 23, MUTED, bold=True)

    # Beat-level captions follow measured audio boundaries, without invented word timestamps.
    d.rectangle((0, 744, W, H), fill=INK)
    lines = textwrap.wrap(beat['text'], width=91, break_long_words=False, break_on_hyphens=False)
    for n, value in enumerate(lines):
        tw = d.textlength(value, font=font(27))
        d.text(((W - tw) / 2, 754 + (128 - len(lines) * 36) / 2 + n * 36), value, font=font(27), fill='white')
    d.rectangle((0, 896, round(W * min(1, seconds / timeline['duration_seconds'])), 899), fill=BLUE)
    return im

def contact_sheet():
    sheet = Image.new('RGB', (1600, 3 * 330), '#DAD7CE')
    for n, b in enumerate(timeline['beats']):
        small = frame(b['start_seconds'] + (b['end_seconds'] - b['start_seconds']) * .6).resize((520, 293), Image.Resampling.LANCZOS)
        x, y = (n % 3) * 533, (n // 3) * 330
        # Use four rows for all eleven shots.
        if y + 330 > sheet.height:
            extended = Image.new('RGB', (1600, 1320), '#DAD7CE'); extended.paste(sheet, (0, 0)); sheet = extended
        sheet.paste(small, (x, y))
        ImageDraw.Draw(sheet).text((x + 8, y + 298), f"{n + 1:02} / {b['start_seconds']:.2f}s", font=font(19), fill=INK)
    sheet.save(OUT / 'styleframes.jpg', quality=93)

def render(study=False):
    duration = 7.8 if study else math.ceil((timeline['duration_seconds'] + 1.2) * FPS) / FPS
    target = OUT / ('motion-study.mp4' if study else 'accessfinish-demo-v04.mp4')
    command = ['ffmpeg', '-y', '-v', 'warning', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
               '-i', str(OUT / 'narration-aiden/narration.wav'), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
               '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-t', str(duration), '-movflags', '+faststart', str(target)]
    worker = subprocess.Popen(command, stdin=subprocess.PIPE)
    count = round(duration * FPS)
    for n in range(count):
        worker.stdin.write(frame(n / FPS).tobytes())
        if n % 300 == 0:
            print(json.dumps({'rendered_frames': n, 'total_frames': count}), flush=True)
    worker.stdin.close()
    assert worker.wait() == 0
    output = {'file': target.name, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'width': W, 'height': H, 'fps': FPS,
              'frames': count, 'duration_seconds': duration, 'narration_seconds': timeline['duration_seconds'], 'music': False,
              'audio': 'Local Qwen3-TTS 0.6B Aiden; actual beat timings; no word timestamps',
              'evidence_sources': ['web/comparison.json', 'web/phone-model-report.json', 'web/cases/customer-phone.json'],
              'publication': 'Local review cut; not uploaded by this renderer'}
    (OUT / ('motion-study.json' if study else 'render-manifest.json')).write_text(json.dumps(output, indent=2) + '\n')
    print(json.dumps(output), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--contact-sheet', action='store_true'); parser.add_argument('--study', action='store_true')
    options = parser.parse_args()
    if options.contact_sheet:
        contact_sheet()
    else:
        render(options.study)
