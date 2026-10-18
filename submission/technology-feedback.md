# Technology feedback

Nebius Token Factory made it possible to call an NVIDIA open model through a familiar chat-completions interface and record tool calls and token usage without managing a GPU deployment. Nemotron produced small source proposals that could be handed to a deterministic executor.

Our experiments also showed why application-level verification remains necessary. Some earlier responses exhausted a bounded tool loop without a useful patch. A later proposal included mixed CRLF/LF anchors, so exact replacement correctly refused it. Clearer source fragments and line-ending normalization helped turn the recorded proposal into a verified booking outcome. The model generated the semantic edits; it did not replace the trusted compiler, browser executor, or read-only database evaluator.

Useful improvements would include more actionable structured tool errors, explicit input-reservation guidance, and easier account-level hard spending caps for small experiments. AccessFinish currently enforces a local reservation guard; it does not present that guard as a provider-enforced billing limit.
