# Automatic mapping is the main workflow

Branchi is Obsidian first. Work in an individually enabled conversation; a supported client integration sends visible completed work; Luna extracts source-linked decisions, tasks and offshoots; a validated writer updates the local record and generated maps. Original project requests, accepted work and human notes are preserved. Uncertain interpretations retain a review flag and reason. No new project is guessed or silently created by the model.

Desktop setup is the primary path; a browser extension is optional. See [desktop workflow and exact coverage](desktop-workflow.md).

## Set up once

1. Run `npm run setup`, then `npm run doctor`. Fresh configurations enable Luna mapping and High catch-up with bounded defaults. Existing configurations are preserved; use `npm run mapper -- enable` and `npm run reviewer -- enable` if those layers were disabled. `--no-ai` explicitly creates a capture-only setup.
2. Use a supported installed Codex CLI signed in to the account. Model availability is checked by the actual runner; a configuration flag does not prove access. No API key is created and no model is silently substituted.
3. Start the companion, or install the existing login service on macOS. Activate only the intended conversation: “Brainch this chat for PROJECT NAME”. The skill resolves its exact UUID and binds it with `node scripts/chat-privacy.mjs include EXACT_CHAT_UUID --project=PROJECT_ID`. Subsequent local Codex completions need no save request. New, personal and ambiguous chats stay excluded until specifically activated.
4. Install Branchi Interactive and its scoped styles using the existing installer. Open the Home bookmark, choose a project or chat, and follow the map back to saved sources. Existing themes are preserved.
5. Configure a twice-daily local desktop automation (for example 09:00 and 18:00 local time) to run `node scripts/catch-up.mjs` from the checkout. Follow the quiet/failure behavior in `docs/hourly-review.md`. A copied vault does not copy this machine's schedule.

## Immediate path and incremental safety net

The watcher saves local Codex completions and queues them immediately. Portable receipts saved through the checkpoint CLI or local `brancha_capture` MCP tool are also picked up automatically by the companion. A durable intake cursor recovers a saved receipt if the process stopped before enqueueing it. The intake reads only bounded saved canonical data, never scans other apps or rereads unrelated transcripts, and skips unchanged files. Stable job identities make recovery idempotent. Excluded receipts are not reconsidered just because permissions later change.

Low extraction is debounced by 30 seconds. Twice-daily High catch-up reviews previously unreviewed completed/failed jobs and pending turns older than five minutes. It uses up to eight turns in one routed project, capped at 36,000 excerpt characters. Oldest eligible work goes first. A shared model lock prevents High from racing Low on a pending job. Successful catch-up marks covered pending jobs complete without another Low call. New evidence is proposed; High does not approve its own work.

Only new source packets enter the model. The intake may inspect saved event identities after a record revision; it does not send all history to Luna. Review receipts retain a fingerprint, source identities and authoritative usage once per batch. Previously reviewed or reviewer-failed jobs are skipped. A failed call is retained for inspection; a forced check is not a retry loop or a budget override. A later explicit route lets a waiting job become eligible without recapturing its transcript.

Existing limits remain: Low/ambiguity mapping 20 model calls/day, at most three High escalations inside that allowance; catch-up has its separate eight-call/day ceiling. A scheduled wrapper's own usage is additional and separate from the helper's receipt. Pause stops all collection, extraction and review. Basic chat indexes/maps and saved replies do not need AI; extracted choices/tasks can lag when the model allowance or account is unavailable. A local computer/service must be running.

## Client support is explicit

| Source | What works in this release | Remaining boundary |
| --- | --- | --- |
| Local Codex | Automatic capture after exact-chat activation, Low mapping, local Obsidian/companion refresh | Completed visible turns only; earlier skipped or hidden messages are unavailable |
| Trusted local hook / app | Send a v1 receipt by CLI or local `brancha_capture`; it automatically enters the same mapper and chat-source index | Integration must actually deliver the event, with an enabled session and an explicitly selected existing project |
| Claude Code / local MCP | Optional additive hooks or explicit local capture receipts feed the same intake | Hooks require installation and exact-session activation; a real client event must verify delivery |
| Hosted ChatGPT connector | Existing project checkpoint tools remain available | Its deployed schema still lacks source-chat identity. No passive chat listener or per-chat cloud mapping is claimed; cloud source was not deployed here |

For `brancha_capture`, read the revision with `brancha_projects`, then send `{expectedRevision, checkpoint}`. The checkpoint is the documented v1 envelope with stable provider/sessionId/eventId, projectId, title, summary and next. Optional `request` captures up to 6,000 characters of visible user context. Use an opaque UUID-style session identifier for portable chat dashboards. Replay the same event identity only with identical content; it returns duplicate without another write. Changed content needs a new eventId. Unknown identities/projects fail closed. The tool cannot include a chat itself.

## Manual fallback: Brainch this chat

The skill can be activated later in a conversation. It can record a compact checkpoint of the visible context it can access and state any missing coverage. It cannot retrieve hidden or unavailable turns. Save that selected checkpoint through the supported receipt interface so Luna can map it; do not fabricate a full transcript or manually duplicate every answer in Markdown.

Automatic mapping does not imply an always-on listener for unsupported apps, model access while the computer sleeps, remote deployment, recursive harness self-modification, or verified task completion. The canonical local record remains `brancha.json`; dashboards and source notes are regenerated projections. No general-purpose Sol worker is needed for routine validated writes.

## Verification and rollback

Regression checks cover receipt ingestion → automatic mapping → exact-chat source links, uncertain task proposals, replay, interrupted handoff recovery, pending catch-up, Low/High exclusion, pause, privacy, and fresh setup defaults. These fixture checks do not prove a GPT/Claude client is delivering events. Verify the live intake timestamp, last capture, queued turns and model receipt separately.

To stop the model layer, disable mapper and reviewer and restart the existing companion; pause also stops it immediately. Source records remain. Existing deployments/configurations are preserved and private capture data must never be committed to public Git.
