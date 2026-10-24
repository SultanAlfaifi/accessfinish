# Review AccessFinish in three minutes

1. **Open the page** (`npm run replay` → http://127.0.0.1:4178, or the published page). The latest recorded live run replays automatically.
2. **Phone case (opens first).** The confirmation page said success but the database held the wrong phone. Click the steps: the red observation, Nemotron's diagnosis and one-line diff, and the green proof card with the saved row, the fresh-browser reopen and nine checks. Download the verified patch. Fixed on the first attempt in 7 of 7 live runs.
3. **Keyboard case.** Not fixed yet. Click any red "saved for 2026-11-01 instead of 2026-11-02" step: the page said *booked*, the database disagreed, and the timeline shows the date field changing by itself 0.7 s after a page request. 15 such false confirmations across 7 runs, all rejected.
4. **Run it yourself** (Node 22+, Docker): `npm run demo:setup`, set `NEBIUS_API_KEY`, then `node scripts/agent.cjs --case keyboard-date`.
5. **Evidence.** Every trace is in `evidence/agent-runs/`; older single-shot trials (2/5 passes) are on the [evidence page](../web/workbench.html).

Where NVIDIA is used: every diagnosis and code edit comes from `nvidia/nemotron-3-super-120b-a12b` on Nebius Token Factory (`lib/agent.cjs`). The verifier is deterministic and never calls a model.
