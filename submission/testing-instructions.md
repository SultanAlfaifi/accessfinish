# Test AccessFinish

## In a browser (no install)

Open the published page (https://sultalfaifi.com/accessfinish/) or run `npm run replay` and open http://127.0.0.1:4178. The page replays the recorded live agent runs: click any step to see the verifier's evidence, Nemotron's diagnosis and diff, and the proof card. The **Evidence** page lists every live run with its raw trace.

## Run the agent yourself

Requires Node.js 22+ and Docker (Linux engine).

```sh
npm run demo:setup                          # builds the pinned sandbox images once (several GB)
export NEBIUS_API_KEY=...                   # Token Factory key
node scripts/agent.cjs --case customer-phone
node scripts/agent.cjs --case keyboard-date
```

Without a key, `node scripts/agent.cjs --case keyboard-date --recorded-model` runs the whole loop with Nemotron's recorded 21 October proposal instead of a live model call, to check the sandbox and verifier.

The same runs execute on GitHub Actions in `.github/workflows/agent-run.yml` (it needs the `NEBIUS_API_KEY` repository secret), and `.github/workflows/clean-execution.yml` rebuilds the sandbox from scratch and replays every recorded proposal without a model.

## Checks

`npm test` covers the agent loop (with a fake model and executor), exact-edit validation, evidence binding and the server. `npm run check:records` verifies the archived 21 October single-shot trials and their hashes.
