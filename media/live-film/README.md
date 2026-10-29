# The screen-recorded film

[On YouTube](https://youtu.be/XztxzjYYlO0) · `media/accessfinish-live-demo.mp4` is a screen recording of AccessFinish working, edited to under three minutes. Nothing in it is staged or redrawn: a visible Chromium on a 1920×1080 desktop (Xvfb, openbox) on a GitHub Actions runner, captured with ffmpeg while it ran.

| Scene | What is on screen | Recorded by |
| --- | --- | --- |
| Before | The pinned Easy!Appointments app, original source. Real key presses: Tab, arrows, Enter. Focus goes round the date step and into the browser, never into the calendar | `scripts/film/shoot.cjs --scene before` |
| Live run | `npm start` in a terminal, the AccessFinish page, a mouse click on **Run live**: Nemotron 3 Super on Nebius Token Factory, verified in the sandbox. `docker ps` shows the sandbox's containers: the app and database with network `none`, and the browser sharing the app's namespace | `shoot.cjs --scene live` |
| After | The app with the patch that run verified: the keyboard reaches the date field, books 9 November at 6:00 UTC (09:00 in Riyadh, the clinic's time zone; the app's list has no Riyadh entry, so it stays on UTC as the verifier does), the saved row is read with the verifier's read-only account, and a fresh browser reopens the booking on the same date | `shoot.cjs --scene after` |

The key labels at the bottom of the app (and the orange focus outline) are drawn by the recorder so a viewer can follow the keyboard; they add no focusable element. Every speed-up is labelled in the film.

## Takes

The workflow recorded five live runs in parallel on 29 Oct 2026 ([`takes.json`](takes.json)); every trace is kept in `takes/*/trace.json`:

| Take | Run | Result | Estimated Nemotron cost |
| --- | --- | --- | --- |
| 1 | `agent-a0c624bfe19038b5c0b04bd7` | not verified in 12 attempts | $0.31 |
| **2** | `agent-31b12339b788b3733653fe84` | **verified on attempt 5, 6 min 8 s** | $0.09 |
| 3 | `agent-ddd7fa4a5775a2f9886d291a` | not verified in 12 attempts | $0.39 |
| 4 | `agent-db3d1326ebe5670985259311` | not verified in 12 attempts | $0.24 |
| 5 | `agent-e63ad77f0b78701198b25e45` | not verified in 12 attempts | $0.61 |

The film uses take 2, the one that verified. In `takes.json`, "complete" reads false for every take because the first version of the publish step looked up the scene logs under the wrong name; all five recorded every scene without an error, and take 2 keeps its three recordings. One verified run in five is in line with the published results (2 of 10 for agents v4–v5); these five runs are not part of the 54 published runs. The patched-app scene was re-shot once (`retake-after/`) with the same patch, to keep the on-screen key labels on one line.

## Unplanned takes

On 29 Oct at 14:48 UTC a commit whose message only mentioned the workflow's `[film]` tag started the workflow again by mistake: five more live runs, about $1.70 of Nemotron. Their traces and event logs are kept in `unplanned-takes/` ([`unplanned-takes.json`](unplanned-takes.json)), without their videos: one verified (take 3, on attempt 6) and four did not verify in 12 attempts. The film does not use them. The workflow now starts only when a commit message *begins* with the tag.

## Reproduce

```sh
# on Linux with Docker, Xvfb, openbox, xdotool, xterm and ffmpeg; NEBIUS_API_KEY for the live scene
npm run demo:setup
node scripts/film/serve-app.cjs --original && node scripts/film/shoot.cjs --scene before --xvfb --out take
node scripts/film/shoot.cjs --scene live --xvfb --out take
node scripts/film/serve-app.cjs --trace take/trace.json && node scripts/film/shoot.cjs --scene after --xvfb --out take
```

Or run the Film recording workflow by hand, or push to a `claude/**` branch a commit whose message starts with `[film]` (see `.github/workflows/film.yml`); each take is a paid live run. The voice-over is `narration.json`, spoken by Qwen3-TTS (speaker Aiden) through `scripts/narrate.py` with `AF_NARRATION_DIR=media/live-film` (`[narrate-film]`), and `python3 scripts/film/render-live-film.py` edits the film.
