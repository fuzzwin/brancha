# Luna conversation mapper

Automatic mapping is the primary Branchi workflow. Fresh v0.13 setups enable it for individually activated sources; existing configurations retain their settings. See [automatic mapping](automatic-mapping.md) for the end-to-end workflow and supported-client boundaries. Obsidian remains primary. The collector reads new **visible user messages and final assistant responses** from supported local Codex logs after each completed turn. It ignores reasoning, tool bodies, subagents and scheduled review inputs. It does not passively read every cloud ChatGPT chat; those still need an activated connection/checkpoint or a future adapter.

The mapper uses the signed-in Codex CLI, pinned to `gpt-6-luna`, with Low effort and High escalation only when ambiguity is flagged and budget remains. No new API key is created. Model availability depends on client/account: test the actual installed runner. The older standalone CLI on the development Mac rejected Luna, while the newer CLI already bundled with ChatGPT succeeded. The macOS enable command prefers that existing bundled client. It does not install or update software, and never substitutes another model.

## Enable and inspect

From this checkout, after normal Branchi setup and `codex login`:

```sh
npm run mapper -- enable
npm start
npm run mapper -- status
```

If already using the macOS login service, restart it using `node scripts/login-service.mjs` instead of starting a second server. Other platforms should restart their existing service manager. `mapper.executable` in the private config can select another supported installed Codex executable.

Default limits: one running extraction, 30-second delay after a completed turn, 20 total model calls per Melbourne calendar day including escalations, at most three High calls/day, 90-second timeout per call, six proposed items per turn. Calls use Codex account allowance; no billed cost is inferred from token counts. Twice-daily High catch-up is the safety net; its separate eight-call/day ceiling is unchanged. The desktop schedule is configured separately from the runtime.

Pause through the existing local capture control to stop capture and extraction. `npm run mapper -- disable` plus a service restart disables only the model layer. Records already saved remain. Unknown project routes wait as `needs_route`; use the existing exact-session routing workflow rather than guessing from similar names or shared folders.

## Output and evidence

Each extraction has a durable job keyed by session and completed-turn identity. Only decision, task and branch proposals are allowed, with exact matching source quotes and safe relation types. No task prerequisites are invented. These nodes have Proposed status and no original success criteria. Existing goals, tasks and manual fields are preserved. Model-generated facts are not independently verified. A status report is not a decision; extraction errors can be parked without deleting their source history.

Project dashboards link generated `Conversations` pages. These have a source-chat link, a bounded Pele map, linked records, exact excerpts and source-turn IDs. The shared conversation root is a presentation grouping, not a work dependency. The project map gains the same proposed choices/offshoots. Generated pages refresh while the companion runs; static SVG maps are not an installed interactive Obsidian plugin.

Pending proposals do not displace the project's next concrete task or count as ready work. Use the existing record editor or revision-checked skill to accept/correct/park them after reading evidence. Never edit generated pages as project truth.

## Reliability and failures

The runner uses read-only, ephemeral Codex execution with user-config loading, shell execution, multi-agent tools and web search disabled for the extraction process. Transcript instructions are untrusted input. Tool use is rejected. The final structured result is validated before any project write. No separate API key or copied sign-in token is stored by Branchi.

Job files and receipts live privately under `.brancha/mapper`. A workspace lock and per-job event marker prevent duplicate application; model processing occurs outside the workspace lock. Canonical writes re-read and validate the current record, preserve original scope and make a backup. Call reservations survive restart. A failed run is retained rather than retried on every poll. Review its cause, then explicitly retry with `npm run mapper -- retry JOB_ID` if appropriate. This retains the prior attempt and daily budget. Interrupted jobs are marked failed after their dead worker lock is recovered.

Tests cover routing, source grounding, quote rejection, pause, call limits, replay, High escalation, review-loop exclusion, failure retention and preservation of original project goals. Real-chat replays establish the checked examples only; broader extraction accuracy requires continued review.
