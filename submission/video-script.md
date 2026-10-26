# AccessFinish demo film (≈124 s)

The film is generated, not screen-recorded: `media/accessfinish-agent-demo.mp4` (1920×1080, narrated, captions burned in).

1. `media/agent-demo/narration.json` holds the voice-over; the "Demo narration" workflow speaks it with Qwen3-TTS (speaker Aiden) and writes `timeline.json` with each beat's real length.
2. `node scripts/capture-film-assets.cjs` (with `npm run replay` running) captures 2× close-ups of the real page into `media/agent-demo/shots/`. The keyboard scenes come from the verified live run `agent-2c87e16a520f678b45cbbbeb` (set `AF_FILM_KB_RUN` to use another).
3. `python3 scripts/render-agent-film.py` builds each scene from those close-ups, timed to the narration, with captions, and mixes in the voice.

Numbers come from `web/agent-runs/summary.json`. The "Narration check" workflow transcribes the voice with Whisper (`media/agent-demo/transcript.json`).

## Scenes (one per spoken beat)

| Beat | On screen |
| --- | --- |
| hero | "The AI says 'fixed.'" → "Did the booking actually get saved?" |
| phone-observe | Real typed-vs-saved table: phone saved as 0000000000 |
| phone-propose | Nemotron's diagnosis and one-line diff |
| phone-proof | Proof card pans through nine checks, VERIFIED stamp, 27 / 27 counter |
| keyboard-intro | A real upstream bug: Tab trail ending in "stuck" |
| keyboard-wrong | Typed 2 Nov vs saved 1 Nov, REJECTED stamp |
| keyboard-provenance | The timeline naming the call chain that overwrote the typed date |
| keyboard-reopen | Saved correctly, but the date field after Next on reopen shows today |
| keyboard-verified | Proof card of attempt 6, VERIFIED stamp |
| finding | Counter to 77 false "booked" confirmations |
| facts | 27/27 · 2/10 · 77 · $6.38 |
| close | AccessFinish — Finish the task. Verify the result. |
