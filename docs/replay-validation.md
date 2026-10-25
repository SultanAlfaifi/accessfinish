# Replay decisions and exact recorded stages

The original five frozen generation records remain unchanged: two full passes, two compilation failures, and one proposal that passed the main keyboard booking but failed its calendar regression. The October 23 fresh Linux run at commit `4df4923` reproduced all five recorded stage outcomes.

On October 24, both attempts of [CI run 40086299668](https://github.com/SultanAlfaifi/accessfinish/actions/runs/40086299668) rejected that same known-bad evaluation-1 proposal earlier. Its trusted build passed, but native keyboard execution reported `booking_slot_not_keyboard_reachable` before submission. The date input contained the requested date and the independently read database snapshots were unchanged. Both known passing repairs still passed the full procedure, and both compilation failures remained compilation failures. The exact recorded-stage match was **4/5**, not 5/5. The cause of the changed failure route has not been established.

Both failed replay summaries and full evaluation-1 execution manifests are retained in [reproduction-variation-20261024](../evidence/reproduction-variation-20261024/). These observations are not added to the original model-generation count or the twelve-run paired comparison.

The CI replay now reports two separate quantities:

- `acceptance_decisions_matched`: whether each retained passing repair still passes every execution check, and each retained failing repair is still rejected through an explicitly recognized path.
- `expected_outcomes_matched`: the stricter comparison of build, main keyboard task, regression and final-stage values against the original frozen record. A different rejection stage remains a mismatch here.

The only additional recognized negative path is bound to the exact evaluation-1 proposal hash. It requires matching source/run identities, its successful trusted build, the observed native keyboard diagnostic, zero submissions, the correct typed date, a failed result, and unchanged appointment/customer/database snapshots. Unknown browser errors, altered data, another case or patch, non-native interaction, and failing positive repairs are rejected by this rule. Tests cover these exclusions using the retained failed manifests.

This reporting change does not alter the fixture, browser driver, model proposals, outcome evaluator, workbench's verified status, original frozen evidence or paired comparison. A known-bad candidate remains failed. CI requires all five acceptance decisions and both full positive repairs, while retaining the exact-stage mismatch in its output and artifacts.

For a strict reproduction run that must also match every original stage:

```sh
node scripts/ci-replay-evaluation.cjs --require-exact-recording
```

That mode returns a nonzero exit code when any exact recorded stage differs. General deterministic failure-stage reproduction is not claimed.
