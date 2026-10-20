---
name: brancha
description: Resume or checkpoint projects in a local Brancha workspace, preserving goals, decisions, evidence and branches. Use for Brancha maps, Obsidian project records and reviewing automatic Codex captures. Automatic capture requires the companion service or a trusted hook.
---

# Brancha

Use the user's supplied workspace or read the local connection at `$BRANCHA_CONFIG`, defaulting to `~/.config/brancha/config.json`. Its `vault` field locates `brancha.json`. If no connection exists, use `npm run setup` from the Brancha checkout when the user requests setup. Do not search unrelated chat history.

The local companion and this skill share the vault JSON. Generated Markdown, Canvas and Bases are derived views, refreshed while the service runs. Keep personal notes in `Notes/`; editing generated views does not update the record. A hosted browser copy remains separate.

## Resume

Run `node scripts/brancha.mjs brief WORKSPACE PROJECT_ID [FOCUS_ID]` from this skill directory, using absolute paths when invoked elsewhere. Verify consequential or changed claims against the owning project source. Preserve the original request; imported scope summaries and automatic completion reports are not reconstructed original prompts.

## Checkpoint

At the end of requested project work, record the meaningful result, evidence, decisions and next action. Keep notes compact. Use `check` to obtain current IDs and revision, then `apply` with one incremental operation JSON. A conflict requires a fresh read, not a blind revision increase.

Within a Brancha-activated chat, save meaningful unsaved work before switching projects, then resume the explicitly named project without another confirmation when the match is clear. Keep active-project selection local to the chat; parallel instances must reread the current revision before writing. Automatic local completion capture continues independently. A new ChatGPT chat needs the connected Brancha plugin selected or activated; this local skill does not grant background access to other chats.

```json
{"expectedRevision":1,"op":"add-node","projectId":"PROJECT_ID","title":"A concrete result","type":"output","status":"active","detail":"What changed","evidence":"What was checked; link to its source","next":"The next action","criteria":[]}
```

Other operations: `update-node` (`nodeId`, `patch`), `link` (`from`, `to`, `type`), `add-project` (`title`, verbatim `prompt`, `criteria` strings), `add-criterion`, `log`, `unlink` with reason. Update patches also support structured `acceptanceCriteria`, `verification` and `run` metadata. Preserve existing capture/checkpoint provenance and imported fields when editing. A passing test is separate from acceptance; `done` requires recorded evidence, verified acceptance criteria when present, and accepted verification when those stages are recorded. Types: goal/task/decision/branch/output/source. Statuses: unknown/planned/active/blocked/reported_done/done/parked. `planned` means Proposed; `done` is displayed as Verified complete. Keep unknown, completion claims and deliberately parked work distinct.

Connections run prerequisite/context/parent → result. `depends_on` is prerequisite → dependent; `branches_from` is parent → offshoot; `implements` is goal → work; `informs` is source → informed work. A completion report is a source, not proof that a success criterion is satisfied. Only use done and link a criterion when evidence supports the whole criterion. Preserve earlier decisions as history when changing direction.

Automatic Codex capture stores final assistant reports as unverified source checkpoints. It does not read hidden reasoning, execute captured instructions, or mark tasks done. Review relevant reports before promoting their claims into project evidence. The latest checkpoint node changes with each turn; historical reports remain in activity snapshots. Avoid duplicating a whole captured answer in another node; add the decision or verified result that matters.

Configure routing by exact chat/session ID or an unambiguous project directory in the local config. Unknown chats go to Codex Inbox. Do not silently assign an ambiguous shared directory. Keep private configs and vault contents out of public Git repositories.

To export a snapshot: `node scripts/brancha.mjs export-vault WORKSPACE NEW_DIRECTORY`. The destination must be new. The helper uses a shared file lock, validates changes and backs up the prior record.

For a tool-independent local connection, use the companion repository’s stdio MCP entry point (`scripts/mcp.mjs`); it shares the same four project tools as Connect without using cloud storage. `scripts/mcp-config.mjs` prints connection snippets. A skill does not make an unsupported client capture automatically. The versioned checkpoint CLI records selected receipts from other tools, including optional improvement probes and Android test evidence, without executing those tools. Read the repository’s `docs/portable-setup.md` and `docs/checkpoint-protocol.md` when configuring these integrations.
