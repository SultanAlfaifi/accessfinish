# AccessFinish demo video — script (≈2:30)

Film the replay page (`npm run replay` → http://127.0.0.1:4178) at 1600×900. Calm, direct voice-over. On-screen text in **bold**. Every number below comes from `web/agent-runs/summary.json`.

| Time | Picture | Voice-over |
| --- | --- | --- |
| 0:00–0:15 | Hero: **"The AI says 'fixed'. We check the user can finish."** | "Ask an AI to fix a form and it will tell you it's fixed. The page loads. A confirmation appears. But did the user's booking actually get saved — correctly?" |
| 0:15–0:30 | Phone case selected. Step 1 in red: **"Confirmation shown, but phone saved as 0000000000 instead of 0000000042."** | "Here the booking page says success, but the database stored the wrong phone number. Nobody would notice — unless you check what was saved." |
| 0:30–0:55 | Nemotron step: diagnosis and the one-line diff. | "AccessFinish runs the journey in a real browser, then hands the evidence and the source to NVIDIA Nemotron on Nebius Token Factory. No hints. Nemotron finds the hardcoded value and proposes a fix." |
| 0:55–1:15 | Green proof card: saved row, typed vs saved, fresh-browser reopen, nine checks. Card label **"Fixed on the first attempt in 7 of 7 runs"**. | "Every fix is built in a fresh, offline sandbox and checked for real: the database row, a fresh browser, and a second customer with a different number. Seven runs, seven verified fixes, about half a cent each." |
| 1:15–1:30 | Switch to the keyboard case. Step 1: **"Keyboard user got stuck at the date step."** | "The harder case: a keyboard user can't reach the date picker at all." |
| 1:30–1:55 | Scroll through attempts: reads `booking_http_client.js`, proposes, red **"Confirmation shown, but saved for 2026-11-01 instead of 2026-11-02."** | "Nemotron makes the date reachable — and the page says booked. But AccessFinish reads the database: the booking was saved for the wrong day. Rejected. Again and again." |
| 1:55–2:15 | Detail panel timeline, highlighted row: **"+0.7s no key pressed → date field shows 01/11/2026"**, then the orange finding box. | "And it shows exactly why: right after the date is typed, the page fires a request and quietly resets the date to the first of the month. Fifteen fake 'booked' confirmations — none got through." |
| 2:15–2:30 | Facts row (7/7, 15, $0.41, 9 checks), logo. **"AccessFinish — finish the task, verify the result."** | "Fixes that are proven, not promised. And when a fix isn't right, nothing ships. AccessFinish." |
