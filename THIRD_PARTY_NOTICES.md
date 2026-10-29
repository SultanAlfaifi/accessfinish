# Third party notices

## Easy!Appointments

Easy!Appointments is developed by A.Tselegidis and contributors and distributed under GNU GPL version 3. Upstream: https://github.com/alextselegidis/easyappointments, commit `4bc7ecd51f3dade8e041558f2c23dda65bd6c43e`.

The original source fragments in `web/source-context.json` and `web/cases/`, source excerpts and derivative replacements in `web/evidence.json` and `evidence/`, and their copies in the hosted `docs/` directory retain GPL-3.0 licensing. The pinned original source archive, derivative source proposals, and synthetic database fixture in `integration/portable/` are also distributed under GPL-3.0. `third_party/EasyAppointments-LICENSE` contains the full license. Preserve these notices when redistributing the source or applying derivative patches.

The verifier sandbox (`integration/portable/`) runs the upstream application and candidate patches in isolated Docker containers. The original AccessFinish controller remains MIT licensed. Its trusted asset packaging script replaces upstream build orchestration without changing the original application source. PHP and JavaScript dependencies are restored using upstream lockfiles and retain their individual package licenses. Playwright is Apache-2.0 licensed; Docker base images retain their respective included notices.

The `operator-reference-proposal.json` is a diagnostic reference control combining three archived Nemotron edits and two operator-authored calendar guards. It is not a fresh model result and must not be counted as one.

## Assets

The AccessFinish mark, interface layout, diagrams, captions, poster and demo films were created for this project. System fonts are referenced without bundling font files. The films use no music or third-party stock media. The screen recording (`media/accessfinish-live-demo.mp4`) shows the AccessFinish interface, the pinned Easy!Appointments app (GPL-3.0, see above) with synthetic data, a Chromium browser and a terminal; the earlier generated film shows the AccessFinish interface and its synthetic case data. Both narrations were generated with Qwen3-TTS. NVIDIA and Nebius names identify the model and service used; no affiliation or endorsement is claimed.
