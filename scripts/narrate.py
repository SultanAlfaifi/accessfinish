"""Generate the demo narration with Qwen3-TTS (CustomVoice, speaker Aiden).

python scripts/narrate.py  ->  media/agent-demo/beats/*.wav, narration.wav, timeline.json
Runs on CPU (slow but fine for ~90 s of speech). The narration text is in
media/agent-demo/narration.json; timings come from the generated audio.
"""
import hashlib, json, pathlib, subprocess, time
import numpy as np, soundfile as sf, torch
from qwen_tts import Qwen3TTSModel

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/agent-demo'
script = json.loads((OUT / 'narration.json').read_text())
(OUT / 'beats').mkdir(exist_ok=True)

torch.manual_seed(7)
started = time.time()
model = Qwen3TTSModel.from_pretrained(script['model_id'], device_map='cpu', dtype=torch.float32)
load_seconds = round(time.time() - started, 1)

beats, pieces, at, rate = [], [], 0.0, None
gap = float(script['gap_seconds'])
for beat in script['beats']:
    t0 = time.time()
    wavs, rate = model.generate_custom_voice(text=beat['text'], speaker=script['voice'], language=script['language'])
    audio = np.asarray(wavs[0], dtype=np.float32)
    path = OUT / 'beats' / f"{beat['id']}.wav"
    sf.write(path, audio, rate)
    seconds = len(audio) / rate
    beats.append({**beat, 'file': f"beats/{beat['id']}.wav", 'start_seconds': round(at, 3), 'end_seconds': round(at + seconds, 3),
                  'generation_seconds': round(time.time() - t0, 1), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
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
