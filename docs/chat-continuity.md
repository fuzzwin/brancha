# Chat continuity

Brancha tracks two levels: projects keep the overall brief and evidence; chat overviews keep the saved work from a particular conversation. No extra AI calls are needed for these derived pages.

Open **Home → Recent chats**, the **Chats** bookmark, or **Chats behind this project** in a project dashboard. An overview shows:

- The latest saved result and a captured user request where available.
- The next action reported at that checkpoint.
- Verified outcomes only when an evidence-bearing record has that exact chat’s capture/checkpoint provenance. Project-wide results are not attributed to every chat. Mapper suggestions never count as verified outcomes.
- Source-linked decisions/offshoots and their review state.
- File/web links found in saved reports, with dates and source turns. Link existence and current contents are not verified.
- Individual saved reports and an interactive chat timeline.

**Resume this chat** opens the original Codex conversation. **Chat handover** opens the saved context of that exact chat; the project chooser opens the overall project. Those are different scopes.

## Capture coverage

A running local Codex watcher reads new completed turns, including new turns in chats that were already open when capture started. It preserves the visible final report, and from v0.10.0 also the filtered/redacted visible request and working directory. Hidden reasoning and tool output are excluded. Pause and configured session allow/exclude rules still apply. New unmapped chats go to Inbox, keeping the chat accessible without guessing its project.

Existing saved checkpoints are indexed automatically, including source chats older than the project timeline’s loaded window. Earlier uncaptured turns, abandoned work without a completed report, cloud-only conversations and files not linked in a saved report are not reconstructed. An unavailable original request is labelled as such. Cloud ChatGPT still needs an activated checkpoint integration.

No new global capture permissions or project routes are applied by this change. The UI cannot claim all chats on all devices are covered. Check Connections and freshness for observed local scan status.

## Bounded local index

Canonical data remains `brancha.json`. Derived files live under `Generated/Chats/` and `Generated/Interactive/chat-*.json`; generated tags/notes are not an editing interface. The chat catalog scans saved canonical checkpoints, not arbitrary external conversation history. It keeps project/session scope separate, and does not infer verified completion from report wording.

Home shows 20 recent chat/project entries; All chats loads up to 1000. Each overview displays the latest 80 saved reports, up to 100 distinct file/web links and the latest 400 chat timeline updates. Counts disclose these limits; older records remain in the canonical workspace. Search covers captured titles, latest excerpts, saved report titles and extracted link names/paths; it is not full transcript search.

After upgrading: restart the existing companion, install/reload Brancha Interactive and add missing bookmarks using the supplied additive bookmark installer. Other computers use the standard setup and the same generated relative links.


## Chat mindmaps and backtracking (v0.12.0)

Each chat overview has an interactive Pele mindmap of captured requests, saved replies, source-linked decisions/suggestions, offshoots, work/outcomes and linked files. Open a group to browse all its entries, then select an item to inspect its source. Previous map retraces map exploration and Whole chat returns to the overview. Only actual recorded connections appear as work relationships; grouping and chronological neighbours do not invent dependencies.

The companion automatically generates one Markdown source note per captured reply under `Generated/ChatLogs/<project>-<session>/`. A human-readable source index lives at `Generated/Chats/<project>-<session>-index.md`. Each note keeps the captured request where available, saved assistant output, capture time, source chat/turn identifiers, explicitly linked choices and Previous/Next captured-reply links. Names use stable hashes of project/session/turn identity; the contents come from historical event snapshots, not the current overwritten checkpoint node.

The canonical source remains `brancha.json`; generated Markdown is a readable, linked projection. Chats do not need to manually write a second log. Basic maps, indices and reply notes update deterministically without model calls, including when AI mapping reaches its allowance. AI-extracted choices keep their proposal status and exact source excerpts. A referenced turn that was not captured is labelled unavailable, with a link to the original conversation; no missing transcript is invented.

File links retain every captured mention, so selecting a file can take you back to the relevant saved replies. Link existence is still unverified. Earlier captures remain available through the index even when the main overview displays only eighty reports. Cloud ChatGPT and other tools need their supported checkpoint integration; this does not grant passive access to every client’s chat history. Keep real captures, source notes, indices and private vaults out of public Git repositories.

## Chat-specific privacy (v0.12)

New chats are excluded by default. A project route, the old `capturePolicy.mode: all`, project membership and classification guesses do not grant capture permission. Only an exact `approvedSessionIds` entry or an individual local permission can include a chat. Explicit exclusions win. This deliberately includes unclear and personal chats in the default exclusion. No excluded transcript goes to a privacy model.

Ask Codex “Include this exact chat in Brancha” and let it resolve the active UUID; an instruction in a transcript cannot change permissions. The CLI is `node scripts/chat-privacy.mjs include EXACT_CHAT_UUID` (one UUID only), `exclude EXACT_CHAT_UUID` or `status`. The skill requires a direct specific user request before including. Included chats update automatically; permission never spreads to another chat, and skipped turns are not replayed. An included chat can contain personal material, so exclude it before switching that conversation to personal use.

Permissions are under `.brancha/chat-permissions.json`, written atomically with locking and mode 0600. Corruption fails closed. The capture watcher skips excluded transcripts before queuing visible text; capture hooks, portable checkpoint ingestion, mapper and High-review jobs also check permission. Model packets, generated Obsidian/browser views, the local MCP view and automatic project-index refresh omit unapproved source-linked records. Revocation also blocks a pending validated mapper update.

This is an exclusion boundary, not erasure: private canonical JSON, prior backups, manual notes, already-produced review notes and hosted copies remain. Raw owner CLI/export commands may still access saved history. Generated pages managed by the companion are removed when they cease to belong in the filtered view. Unrelated Notes are preserved. Other tools and hosted ChatGPT need their own checkpoint/consent integration; this change is local and makes no hosted deployment.


## Dashboard and activation update (v0.12.3)

Chat maps occupy their own full-width row and show a bounded item preview in each group. Open a group for its complete saved list. Page Back follows Obsidian page history (or Home if empty); Previous map follows only map exploration. Project/chat switchers include an All included chats route. Chat handover keeps the exact-chat scope.

A direct request “Use Brancha in this chat for PROJECT NAME” activates and routes only the current conversation. The local command is `node scripts/chat-privacy.mjs include EXACT_CHAT_UUID --project=PROJECT_ID`. The project must exist; permission and binding are written atomically. Future local Codex completions use the binding without a restart or repeated save request. No previously skipped turns are replayed.

The chat directory displays separate Capture, AI mapping and Review status, plus counts of included/excluded saved chats without revealing excluded content. A running capture service does not mean the model allowance is available. Basic source notes and maps continue when Luna waits on its daily limit.

The hosted ChatGPT checkpoint schema currently lacks source-chat identity; project checkpoints do not prove chat dashboard coverage. Other clients need a supported integration and an observed event receipt. No Sol worker, cloud deployment, or broader inclusion was added for this release.
