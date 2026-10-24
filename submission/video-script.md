# AccessFinish demo video — script (≈2:30)

Record the live page (`npm start`, then **Run live**, or the replay at `npm run replay`) at 1600×900. Voice-over in a calm, direct tone. On-screen text in **bold**.

| Time | Picture | Voice-over |
| --- | --- | --- |
| 0:00–0:15 | A booking page. A keyboard focus ring jumps from field to field, then lands on nothing; the calendar sits there, unreachable. **"Tab… and nowhere to go."** | "This is a real open-source booking app. If you use a keyboard instead of a mouse, you can't pick a date. You simply can't book." |
| 0:15–0:30 | An AI chat says "Fixed! ✅". Then a confirmation page — and a database row showing `0000000000`. **"The page says booked. The database disagrees."** | "Ask an AI to fix it and it will say it's fixed. Sometimes the page even shows success while the wrong data is saved. Nobody checks the outcome." |
| 0:30–0:40 | AccessFinish hero: **"The AI says 'fixed'. We check the user can finish."** | "AccessFinish is a repair agent that only stops when the user's task actually works." |
| 0:40–1:00 | Keyboard case. Timeline step 1 turns red. Detail shows the Tab trail ending in **stuck**. | "First it runs the journey with a keyboard in a real browser — and sees exactly where focus gets stuck." |
| 1:00–1:20 | Attempt 1: Nemotron's diagnosis and the diff. | "NVIDIA Nemotron, on Nebius Token Factory, reads that evidence and the source code. No hints. It finds the cause and writes a fix." |
| 1:20–1:45 | The verify steps: each failure headline (build error / broken mouse path / wrong saved value — whatever the recorded run shows), then the next attempt. | "Every fix is built in a fresh, offline sandbox and tested for real. When it fails, the evidence goes straight back to Nemotron, and it tries again." |
| 1:45–2:05 | Final step turns green. Proof card: saved appointment, typed vs saved, reopened in a fresh browser, nine checks ticked. | "Verified: the booking is in the database with the right date, it survives a fresh browser, and mouse users aren't broken." |
| 2:05–2:20 | Phone case, quick: confirmation shown but phone saved wrong → fixed → second customer with a different phone passes. | "Same loop when the confirmation lies about the data — and a second customer catches any fix that just hardcodes the test." |
| 2:20–2:30 | Facts row (attempts, time, cost), then the logo. **"AccessFinish — finish the task, verify the result."** | "A few cents and a few minutes, and the fix is proven, not promised. AccessFinish." |

Use only numbers shown by the recorded run you film.
