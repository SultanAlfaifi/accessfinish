# Feedback on NVIDIA Nemotron 3 Super via Nebius Token Factory

We used `nvidia/nemotron-3-super-120b-a12b` through Token Factory's OpenAI-compatible chat-completions endpoint as the reasoning core of an agent loop. It receives verifier evidence and source code, investigates with read-only `search_code` and `read_file` tools, and must answer with a `propose_repair` tool call containing literal source edits. No diagnosis is supplied.

**What worked well**
- Tool calling was dependable: across 54 live agent runs, 258 proposals and 387 search_code/read_file calls, only 2 answers were not usable tool calls (4 more times it kept looking up code until the lookup limit). That let us validate edits before anything ran and keep model output away from shell execution.
- Nemotron reasons well from causal evidence. Once the verifier recorded the call chain that overwrote the typed date (`setDate ← applyUnavailableDates ← getUnavailableDates ← onMonthChange`), its diagnoses named the real cause, and in 2 of 10 runs of our final agents it fixed a real two-part upstream accessibility bug without being told the cause, verified end to end. Before that evidence existed, none of the first version's 43 diagnoses named the month-change handler and 11 blamed time zones; with it, 20 of 39 named it.
- Cost made an iterative, many-attempt loop practical: all 54 runs (18 million input and 1 million output tokens) cost $6.38 at the public prices; a phone-case run costs about a cent.
- On a seeded data fault (a hard-coded value in the request payload) Nemotron found and fixed the cause in 27 of 27 runs, 26 on the first attempt.

**What was hard**
- Literal edit anchors were the main source of wasted attempts: 85 of 258 proposals were rejected before execution because an edit did not apply (an anchor copied inexactly — shifted indentation, a dropped comma, a skipped line — or overlapping, ambiguous or empty), and the model often re-sent the same wrong anchor several times. Returning the file's own lines and tolerating whitespace helped; a native "apply a unified diff" or structured edit format would help more.
- Progress across turns: after one attempt fixed the first bug, the next often rebuilt from an older attempt and lost that fix. Explicit progress notes in our feedback were needed for it to build on its best attempt.
- It sometimes targeted code in a read-only file, or repeated the same syntax error, until the feedback named the file or showed a code frame.
- We saw one transient HTTP 503 in an early run; requests retry 429/5xx with backoff.

**Requests**
A structured patch/edit tool format, exportable per-request usage receipts, an explicit model revision identifier in responses, and a documented way to control or read the reasoning budget for tool calls.

Token Factory supplied all model inference. We did not use Nebius AI Cloud compute or Serverless endpoints; execution and verification ran in Docker on GitHub Actions.
