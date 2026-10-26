"""Generate the demo narration with Qwen3-TTS (CustomVoice, speaker Aiden).

python scripts/narrate.py  ->  media/agent-demo/beats/*.wav, narration.wav, timeline.json
Runs on CPU (slow but fine for ~90 s of speech). The narration text is in
media/agent-demo/narration.json; timings come from the generated audio.
A beat's optional "say" field is what is spoken (e.g. a pronunciation respelling);
"text" stays the caption. Beats whose spoken text is unchanged since the last run
keep their existing audio, so a fix to one beat doesn't re-voice the others.
A beat's optional "trim_start_seconds" drops that much of its generated audio's start
(e.g. a filler sound before the first word); the beat file itself stays as generated.
When every beat is reused, the narration is only reassembled and the model is not loaded.
"""
import hashlib, json, pathlib, subprocess, time
import numpy as np, soundfile as sf

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/agent-demo'
script = json.loads((OUT / 'narration.json').read_text())
(OUT / 'beats').mkdir(exist_ok=True)

previous_file = OUT / 'timeline.json'
previous_timeline = json.loads(previous_file.read_text()) if previous_file.exists() else {}
previous = {b['id']: b for b in previous_timeline.get('beats', [])}
spoken = lambda beat: beat.get('say', beat['text'])
def reusable(beat):
    old, path = previous.get(beat['id']), OUT / 'beats' / f"{beat['id']}.wav"
    return old and old.get('spoken', old['text']) == spoken(beat) and path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == old['sha256']
model, load_seconds = None, previous_timeline.get('model_load_seconds', 0)
if not all(reusable(beat) for beat in script['beats']):
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.manual_seed(7)
    started = time.time()
    model = Qwen3TTSModel.from_pretrained(script['model_id'], device_map='cpu', dtype=torch.float32)
    load_seconds = round(time.time() - started, 1)

beats, pieces, at, rate = [], [], 0.0, None
gap = float(script['gap_seconds'])
for beat in script['beats']:
    t0, path = time.time(), OUT / 'beats' / f"{beat['id']}.wav"
    if reusable(beat):
        audio, rate = sf.read(path, dtype='float32'); generated = previous[beat['id']]['generation_seconds']
    else:
        wavs, rate = model.generate_custom_voice(text=spoken(beat), speaker=script['voice'], language=script['language'])
        audio = np.asarray(wavs[0], dtype=np.float32)
        sf.write(path, audio, rate); generated = round(time.time() - t0, 1)
    trim = float(beat.get('trim_start_seconds', 0))
    audio = audio[int(trim * rate):]
    seconds = len(audio) / rate
    beats.append({'id': beat['id'], 'text': beat['text'], 'spoken': spoken(beat), 'file': f"beats/{beat['id']}.wav", 'start_seconds': round(at, 3),
                  'end_seconds': round(at + seconds, 3), 'generation_seconds': generated, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                  **({'trim_start_seconds': trim} if trim else {})})
    pieces += [audio, np.zeros(int(gap * rate), dtype=np.float32)]
    at += seconds + gap
    print(f"{beat['id']}: {seconds:.1f}s audio in {time.time() - t0:.0f}s", flush=True)

raw = OUT / 'narration-raw.wav'
sf.write(raw, np.concatenate(pieces), rate)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=7', '-ar', str(rate), str(OUT / 'narration.wav')], check=True)
raw.unlink()
(OUT / 'timeline.json').write_text(json.dumps({'model_id': script['model_id'], 'voice': script['voice'], 'language': script['language'],
  'device': 'cpu', 'model_load_seconds': load_seconds, 'sample_rate': rate, 'gap_seconds': gap, 'duration_seconds': round(at, 3),
  'narration_file': 'narration.wav', 'beats': beats}, indent=2) + '\n')
print(f'narration: {at:.1f}s total')
