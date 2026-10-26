# Review AccessFinish in three minutes

1. **Open the page** (https://sultalfaifi.com/accessfinish/, or `npm run replay` → http://127.0.0.1:4178). A recorded live run replays; **Pause** or **Show all** to take over.
2. **Phone case (opens first).** The confirmation page said success but the database held the wrong phone. Click the steps: the red observation, Nemotron's diagnosis and one-line diff, and the green proof card with the saved row, the fresh-browser reopen and nine checks. Verified in 27 of 27 live runs.
3. **Keyboard case — a real upstream bug, fixed by Nemotron with no diagnosis supplied.** Click attempt 2's red verify step: the page said *booked*, the database held 1 Nov instead of 2 Nov, and the timeline names the code that changed the typed date (`onMonthChange → getUnavailableDates → applyUnavailableDates → setDate`). Attempt 4 saves the right date but reopening shows today — a second bug. Attempt 6 is verified; download its patch from the proof card.
4. **Every run, including failures:** the **Evidence** page lists all 54 live runs with replay links and raw traces, and a table of what each agent version changed and how it scored (keyboard fixed in 2 of 10 runs of the final agents; 77 false "booked" confirmations caught, none accepted).
5. **Run it yourself** (Node 22+, Docker): `npm run demo:setup`, set `NEBIUS_API_KEY`, then `node scripts/agent.cjs --case keyboard-date`.

Where NVIDIA is used: every diagnosis, code search and edit comes from `nvidia/nemotron-3-super-120b-a12b` on Nebius Token Factory (`lib/agent.cjs`). The verifier is deterministic and never calls a model.
