# Feedback from the measured AccessFinish experiment

We used NVIDIA Nemotron 3 Super through Nebius Token Factory's chat-completions endpoint to propose literal source edits. The operator supplied the diagnosis and repair direction. Structured tool calls made it practical to constrain source paths, preview exact edits, bind approval to a proposal hash, and keep model output away from shell execution.

Across three development requests and five frozen requests on one exposed case, all eight responses reported usable token counts. Estimated additional cost at the account prices checked on October 21 was $0.0394581 before tax. We retained failed-request reservations and made no automatic retries. Reasoning tokens were included in reported completion usage; the cost estimate used the full reported completion count.

Two of five frozen proposals passed the full build, keyboard outcome, database, fresh-reopen, regression, and runtime checks. Two proposed JavaScript edits did not compile. One proposal passed the main keyboard task but failed calendar navigation. These are observations from one guided case, not a general comparison or model benchmark.

The most useful platform improvements for this workflow would be easily exportable per-request billing/usage receipts, an explicit model-revision identifier, and source-edit examples that preserve syntactic boundaries around callbacks. We would also value stronger structured-edit validation before execution. These are feature requests; we have not established whether equivalent facilities exist elsewhere in the platform.

Token Factory supplied model inference. We did not deploy the workbench on Nebius AI Cloud or use Serverless Jobs/Endpoints, and we do not claim that those services accelerated the build. Local deterministic orchestration, Docker, Playwright, PHP, and MariaDB supplied execution and outcome verification.
