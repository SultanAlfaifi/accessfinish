"""Transcribe each narration beat with Whisper and compare it with the script.

python scripts/transcribe-narration.py -> media/agent-demo/transcript.json
"""
import json, pathlib, re, difflib
import whisper

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/agent-demo'
timeline = json.loads((OUT / 'timeline.json').read_text())
model = whisper.load_model('base.en')
words = lambda text: re.sub(r"[^a-z0-9 ]", ' ', text.lower().replace('-', ' ')).split()
rows = []
for beat in timeline['beats']:
    heard = model.transcribe(str(OUT / beat['file']), language='en', fp16=False)['text'].strip()
    score = difflib.SequenceMatcher(None, words(beat['text']), words(heard)).ratio()
    rows.append({'id': beat['id'], 'script': beat['text'], 'heard': heard, 'word_match': round(score, 3)})
    print(f"{beat['id']}: {score:.2f} | {heard}", flush=True)
(OUT / 'transcript.json').write_text(json.dumps({'model': 'whisper base.en', 'beats': rows}, indent=2) + '\n')
