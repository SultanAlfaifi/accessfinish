# Feedback on NVIDIA Nemotron 3 Super via Nebius Token Factory

We used `nvidia/nemotron-3-super-120b-a12b` through Token Factory's OpenAI-compatible chat-completions endpoint as the reasoning core of an agent loop: it receives verifier evidence and source code, can call a read-only `read_file` tool, and must answer with a `propose_repair` tool call containing literal source edits. No diagnosis is supplied.

**What worked well**
- Tool calling was dependable: across 14 live agent runs (50 proposals) every response parsed as a valid tool call, which let us validate edits before anything ran and keep model output away from shell execution.
- Cost and speed made an iterative loop practical: a full phone-case run used about 13,000 input and a few hundred output tokens (about half a cent); all 14 runs together cost about $0.41 at the public prices.
- On a seeded data fault (a hard-coded value in the request payload) Nemotron found and fixed the cause on the first attempt in 7 of 7 runs.

**What was hard**
- On a real upstream keyboard bug, the model kept returning to time-zone and date-format explanations even when the evidence showed the date changing by itself right after a background request. Better hypothesis revision across turns would help agentic debugging the most.
- Long literal anchors were sometimes copied with small differences, so 7 of 43 keyboard proposals were rejected before execution. A native "apply a unified diff" tool format, or guidance on minimal anchors, would reduce this.
- We saw one transient HTTP 503; requests now retry 429/5xx with backoff.

**Requests**
Exportable per-request usage receipts, an explicit model revision identifier in responses, and a documented way to control or read the reasoning budget for tool calls.

Token Factory supplied all model inference. We did not use Nebius AI Cloud compute or Serverless endpoints; execution and verification ran in Docker on GitHub Actions.
