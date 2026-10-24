# Review AccessFinish in three minutes

1. **Open the page** (https://sultalfaifi.com/accessfinish/, or `npm run replay` → http://127.0.0.1:4178). The recorded agent run replays automatically.
2. **Keyboard case.** Click the first red step to see where keyboard focus got stuck. Click each Nemotron step to read its diagnosis and diff, and each verify step to see why the verifier rejected or accepted it. The green proof card shows the saved row, the fresh-browser reopen and the regression checks; download the verified patch.
3. **Phone case.** Switch tabs: the confirmation page appeared but the database held the wrong phone. Watch the agent fix it and pass a second customer with a different number.
4. **Run it yourself** (Node 22+, Docker): `npm run demo:setup`, set `NEBIUS_API_KEY`, then `node scripts/agent.cjs --case keyboard-date`.
5. **Evidence.** Every trace is in `evidence/agent-runs/`; older single-shot trials (2/5 passes) are on the [evidence page](../web/workbench.html).

Where NVIDIA is used: every diagnosis and code edit comes from `nvidia/nemotron-3-super-120b-a12b` on Nebius Token Factory (`lib/agent.cjs`). The verifier is deterministic and never calls a model.
