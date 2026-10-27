# AccessFinish demo film (≈118 s)

The film is generated, not screen-recorded: `media/accessfinish-agent-demo.mp4` (1920×1080, narrated, captions burned in).

1. `media/agent-demo/narration.json` holds the voice-over; the "Demo narration" workflow speaks it with Qwen3-TTS (speaker Aiden) and writes `timeline.json` with each beat's real length.
2. `node scripts/capture-film-assets.cjs` (with `npm run replay` running) captures 2× close-ups of the real page into `media/agent-demo/shots/`. The keyboard scenes come from the verified live run `agent-2c87e16a520f678b45cbbbeb` (set `AF_FILM_KB_RUN` to use another).
3. `python3 scripts/render-agent-film.py` builds each scene from those close-ups, timed to the narration, with captions, and mixes in the voice.

Numbers come from `web/agent-runs/summary.json`. The "Narration check" workflow transcribes the voice with Whisper (`media/agent-demo/transcript.json`).

## Scenes (one per spoken beat)

| Beat | On screen |
| --- | --- |
| hero | The two "booked" pages from one run: attempt 2 REJECTED (saved 1 Nov), attempt 6 VERIFIED |
| keyboard-intro | A real upstream bug in Easy!Appointments: the Tab trail ending in "stuck" |
| keyboard-propose | Nemotron's searches, diagnosis and edit (attempt 2); no root cause given |
| keyboard-wrong | Typed 2 Nov vs saved 1 Nov, REJECTED stamp |
| keyboard-provenance | The timeline naming the call chain that overwrote the typed date |
| keyboard-reopen | Saved correctly, but the date after Next on reopen shows today |
| keyboard-verified | Proof card of attempt 6, VERIFIED stamp |
| finding | Counter to 77 false "booked" confirmations caught |
| phone-control | The seeded phone fault as a calibration control: 27 / 27 verified |
| facts | 0/77 accepted · 2/10 (v4–v5; 2 of 27 overall) · 27/27 control · $6.38 estimated |
| close | AccessFinish — Finish the task. Verify the result. |
