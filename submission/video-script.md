# AccessFinish demo films

## Screen recording (2 min 9 s)

[On YouTube](https://youtu.be/XztxzjYYlO0) · `media/accessfinish-live-demo.mp4` (1920×1080, narrated, captions burned in) shows the project working on the machine it was built for: a Linux desktop with Docker, recorded on a GitHub Actions runner. One scenario from start to end:

1. A keyboard-only customer tries to book in the original Easy!Appointments: Tab never reaches the calendar.
2. `npm start`, then **Run live** on the page: Nemotron 3 Super on Nebius Token Factory, verified in the sandbox (`docker ps` shows its offline containers). Attempt 2 reaches a "booked" page that saved 1 Nov instead of 9 Nov, and is rejected. Attempt 4 saves the right date, but the reopened booking shows today, so it is rejected too. Attempt 5 is verified, 6 min 8 s after Run live, at about $0.09.
3. The app with that patch: the keyboard books 9 Nov, the read-only account shows the saved row, and a fresh browser reopens it on the same date.

Speed-ups are labelled on screen. The takes, traces and how to reproduce them are in [`media/live-film/README.md`](../media/live-film/README.md).

## Generated film (≈118 s)

The first film is generated, not screen-recorded: `media/accessfinish-agent-demo.mp4` (1920×1080, narrated, captions burned in).

1. `media/agent-demo/narration.json` holds the voice-over; the "Demo narration" workflow speaks it with Qwen3-TTS (speaker Aiden) and writes `timeline.json` with each beat's real length.
2. `node scripts/capture-film-assets.cjs` (with `npm run replay` running) captures 2× close-ups of the real page into `media/agent-demo/shots/`. The keyboard scenes come from the verified live run `agent-2c87e16a520f678b45cbbbeb` (set `AF_FILM_KB_RUN` to use another).
3. `python3 scripts/render-agent-film.py` builds each scene from those close-ups, timed to the narration, with captions, and mixes in the voice.

Numbers come from `web/agent-runs/summary.json`. The "Narration check" workflow transcribes the voice with Whisper (`media/agent-demo/transcript.json`).

### Scenes (one per spoken beat)

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
