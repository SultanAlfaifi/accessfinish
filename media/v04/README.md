# v04 evidence film

109.5 seconds, 1600×900, 30 fps, English narration with the user's accepted local **Aiden** voice. The opening shows the actual seeded-phone failure before explaining proposal, approval and evidence binding.

The film distinguishes the six-pair comparison (twelve executions), the separate new Nemotron phone proposal (one generation, two execution replays), and the original frozen date evaluation (two full passes from five guided attempts). Raw evidence drives the shown values. The workbench image is an actual local capture; other evidence is presented as labelled readable graphics.

Rendering uses Python/Pillow and FFmpeg, with Windows Georgia and Segoe UI fonts. No model request or upload occurs during rendering:

```sh
python scripts/render-demo-v04.py --contact-sheet
python scripts/render-demo-v04.py --study
python scripts/render-demo-v04.py
python scripts/review-demo-v04.py
```

`narration-aiden/narration-timeline.json` records actual measured beat boundaries and pinned model/voice provenance. Captions use beat boundaries; there are no invented word timestamps. The included WAV can be reused without installing the speech model. No music or imported effects are used. The renderer includes the final 1.2-second hold.

The final MP4 passed complete video/audio decode, exact 3,285-frame count, dimensions, frame rate and loudness checks. The encoded contact sheet covers the opening reveals, every scene and final hold; sampled frames were visually inspected for readable content and clipping. Continuous playback and listening have not been performed by the agent, and full entrant watch/listen remains pending.

This is a local review cut. The existing private v03 YouTube upload is an earlier revision. No new public video or deployment is implied.
