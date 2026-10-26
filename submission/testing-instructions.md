# Test AccessFinish

## In a browser (no install)

Open the published page (https://sultalfaifi.com/accessfinish/) or run `npm run replay` and open http://127.0.0.1:4178. The page replays recorded live agent runs: click any step to see the verifier's evidence, Nemotron's searches, diagnosis and diff, and the proof card. The **Evidence** page lists all 54 live runs with their raw traces and the results per agent version; `?case=keyboard-date&run=<id>` replays any of them.

## Run the agent yourself

Requires Node.js 22+ and Docker (Linux engine).

```sh
npm run demo:setup                          # builds the pinned sandbox images once (several GB)
export NEBIUS_API_KEY=...                   # Token Factory key
node scripts/agent.cjs --case customer-phone
node scripts/agent.cjs --case keyboard-date
```

Without a key, `node scripts/agent.cjs --case keyboard-date --recorded-model` runs the whole loop with Nemotron's recorded 21 October proposal instead of a live model call, to check the sandbox and verifier.

The same runs execute on GitHub Actions in `.github/workflows/agent-run.yml` (it needs the `NEBIUS_API_KEY` repository secret), and `.github/workflows/clean-execution.yml` rebuilds the sandbox from scratch and replays the five frozen single-shot proposals and the phone controls without a model.

## Checks

`npm test` covers the agent loop (with a fake model and executor): code search, anchor handling, the attempt ledger and progress notes, causal provenance in the evidence, a real-browser check that provenance never pauses the page, exact-edit validation, evidence binding and the server. `npm run check:records` verifies the archived 21 October single-shot trials and their hashes.
