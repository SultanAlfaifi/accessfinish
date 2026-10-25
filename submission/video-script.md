# AccessFinish demo film (≈110 s)

The film is generated, not screen-recorded: `media/accessfinish-agent-demo.mp4` (1920×1080, narrated).

1. `media/agent-demo/narration.json` holds the voice-over; the "Demo narration" workflow speaks it with Qwen3-TTS (speaker Aiden) and writes `timeline.json` with each beat's real length.
2. `node scripts/capture-film-assets.cjs` (with `npm run replay` running) captures 2× close-ups of the real page into `media/agent-demo/shots/`.
3. `python3 scripts/render-agent-film.py` builds each scene from those close-ups, timed to the narration, with captions, and mixes in the voice.

Numbers come from `web/agent-runs/summary.json`. The "Narration check" workflow transcribes the voice with Whisper (`media/agent-demo/transcript.json`).

## Scenes (one per spoken beat)

| Beat | On screen |
| --- | --- |
| hero | "The AI says 'fixed.'" → "Did the booking actually get saved?" |
| phone-observe | Real typed-vs-saved table: phone saved as 0000000000 |
| phone-propose | Nemotron's diagnosis and one-line diff |
| phone-proof | Proof card pans through nine checks, VERIFIED stamp, 7 / 7 counter |
| keyboard-intro | Tab trail ending in "stuck" |
| keyboard-attempts | The real keyboard run's eight attempts scroll by |
| keyboard-wrong | Typed 2 Nov vs saved 1 Nov, REJECTED stamp |
| keyboard-timeline | Request timeline with the 0.7 s "no key pressed" row highlighted |
| finding | Counter to 15 fake "booked" confirmations |
| facts | 7/7 · 15 · $0.41 · 9 checks |
| close | AccessFinish — Finish the task. Verify the result. |
