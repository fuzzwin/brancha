# Brancha

Keep the thread across AI projects: goals, decisions, branches, evidence, next steps and a visual map you can return to.

Brancha is a local Node.js companion, browser workspace and portable skill. It renders diagrams with [Pele](https://pele.run/) and generates linked notes, project maps, a Canvas overview, a Bases table and resume briefs for Obsidian.

## Entry points

- **Portable Local MCP:** shared resume/checkpoint tools for compatible AI clients, using the local record without a cloud service or Codex session folder.
- **Checkpoint CLI:** a versioned receipt format for trusted hooks, test tools and other integrations.
- **Codex Local:** automatic local completion capture, the browser map and live generated Obsidian views.
- **Brancha Connect for ChatGPT:** a private cloud MCP service and skill for resuming projects and saving checkpoints during an activated task. It stays available while the Mac is off; it cannot passively watch every ChatGPT chat.

An optional approved bridge appends new ChatGPT checkpoints to the local map and Obsidian. Local Codex captures stay local. See [ChatGPT setup and connection boundaries](cloud/README.md).

In the app, **Use with ChatGPT** explains both entry points and gives you a starter for the selected project. Activate Brancha in that ChatGPT task, then save a first checkpoint to verify the connection. The local capture bar reports the cloud bridge separately from Codex capture.

## Quick start

Requires Node.js 22+. Codex session files are needed only for its optional automatic capture adapter. Obsidian is optional. No packages, model API keys or paid API requests are required by the capture adapter.

```sh
git clone https://github.com/fuzzwin/brancha.git
cd brancha
npm run setup
npm start
```

For other AI tools, run setup with `--no-codex`. Then run `npm run doctor` to inspect the configuration. See [portable setup](docs/portable-setup.md) for MCP connection snippets and [checkpoint protocol](docs/checkpoint-protocol.md) for optional Harness²/ARTEMIS receipts.

Open http://127.0.0.1:51207. In Obsidian, open the configured vault folder (default `~/Documents/Brancha`) and then `Generated/Brancha.canvas`. Each project links to a clean dependency mindmap, with a compact editable Canvas and full evidence in linked notes.

Setup writes a private connection to `~/.config/brancha/config.json`. Choose another vault with `npm run setup -- --vault /absolute/path/to/vault`. Existing configs are preserved. A fresh installation starts with fictional examples; creating your first project or receiving the first automatic checkpoint starts your real workspace. Unmatched automatic captures appear in **Codex Inbox**.

## Automatic capture

The default adapter watches local Codex session files. On first activation it records file offsets and starts at the end: it does **not** import historical chat content. Every few seconds it checks newly appended completion events and stores the final assistant response as an **unverified source checkpoint**.

- Exact configured session IDs take precedence over project directory routes.
- Unmatched chats go to Codex Inbox, rather than being guessed into a project.
- Each chat has one current source node; dated activity snapshots preserve earlier reports.
- Checkpoints never complete success criteria or verify physical/software outcomes automatically.
- Session/turn IDs prevent duplicate captures after restarts or when the optional hook is also used.
- Hidden reasoning, intermediate commentary and tool output are not stored in the workspace.
- Common credential formats are masked on a best-effort basis. Treat captured final responses as private data; redaction is not a guarantee that arbitrary confidential information has been removed.
- The app shows capture status, last checkpoint and a Pause/Resume control. Paused activity is skipped rather than imported later.

The adapter uses the observed `session_meta` and `event_msg/task_complete` JSONL format. Codex's transcript format is not a stable interface; a future version may require an adapter update. This version is tested against the locally observed Codex 0.154.0 completion format. This automatic watcher does not observe cloud chats, ChatGPT web conversations, Claude, Cursor or other AI tools. Brancha Connect provides explicit project checkpoints for ChatGPT through its optional cloud plugin.

The workspace has an 8 MB safety limit. If reached, capture reports an error and retains pending work in its private cursor queue. Export/archive old checkpoints before continuing. Local backups are retained; users should manage their disk usage.

## Route projects

Edit the private config, then restart the service:

```json
{
  "vault": "/absolute/path/to/Brancha",
  "sessionsDirectory": "/absolute/path/to/.codex/sessions",
  "port": 51207,
  "pollMs": 3000,
  "sessionProjects": {"a-codex-session-id": "a-brancha-project-id"},
  "directoryProjects": [{"directory": "/absolute/path/to/project", "projectId": "a-brancha-project-id"}]
}
```

Use exact chat routes for shared folders containing unrelated work. `node scripts/control.mjs route-session SESSION_ID PROJECT_ID` adds a validated route. Existing checkpoints stay where they were recorded.

## Obsidian and the skill

`brancha.json` in the vault is the shared record. The app, capture adapters, local MCP and skill use file locks and atomic saves. Transient file replacement locks are retried within a bounded window without deleting the previous destination. Obsidian views refresh about one second after a change; the browser checks about every two seconds and defers changes while a form is open. Stale concurrent saves are rejected.

- `Generated/` is regenerated. Do not store personal edits there.
- `Notes/` is for your manual Obsidian notes. These notes are preserved, but are not automatically parsed back into the project record.
- `.brancha/` contains local cursors, status and capture backups.
- Run `npm run obsidian-style` to install scoped map/record styling with backups, or copy `assets/obsidian/brancha-map.css` into the vault’s `.obsidian/snippets/` folder and enable it under Appearance → CSS snippets.

Copy `skills/brancha` into your tool's skill directory (for example `~/.codex/skills/brancha`) or install the manual plugin package. The skill reads the local connection and helps you resume projects, review reports, record actual evidence and map decisions. It is reusable instructions plus validated helpers; the service supplies automatic capture.

Try: “Use Brancha to resume this project” or “Review the latest captured checkpoint and update the verified project state.” Installing a skill does not grant blanket permission for external actions.

## Run at login on macOS

After setup, stop any manually running Brancha process, then run:

```sh
node scripts/login-service.mjs
```

This installs `~/Library/LaunchAgents/com.brancha.companion.plist` and starts the service. It uses the current Node executable and this checkout's path; reinstall if either moves. Logs are under `~/.config/brancha/logs/`. It runs while you are logged in and the Mac is awake, and catches up on recorded completion events after sleep.

Pause/resume without stopping the app:

```sh
node scripts/control.mjs pause
node scripts/control.mjs resume
node scripts/control.mjs status
```

To disable login startup: `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.brancha.companion.plist`, then remove that specific plist. Your vault remains intact.

Linux/Windows users can run `npm start` or configure their own service manager. Those startup paths have not been tested here.

## Optional Codex plugin and hook

`.codex-plugin/plugin.json` bundles the skill and a `Stop` hook for manual desktop installation. The hook uses the supported `last_assistant_message`, `session_id`, `turn_id` and `cwd` input fields and shares deduplication with the watcher. Configure `BRANCHA_CONFIG` for a non-default connection. `node` must be available in the hook environment.

Codex requires users to review and trust new non-managed hooks; use `/hooks` in the CLI. The package does not bypass that trust. The installed watcher is sufficient for automatic capture without installing the optional hook.

Plugins containing lifecycle hooks are for manual desktop distribution, not the public plugin directory. GitHub distribution is separate from an OpenAI directory listing. See [Codex hooks](https://learn.chatgpt.com/docs/hooks) and [plugin packaging](https://developers.openai.com/plugins/build/plugins).

## Local data and sharing

The service binds only to loopback and uses a per-start token plus origin checks for browser writes. It does not upload captured chats. The local app uses bundled assets and system font fallbacks; its capture adapter and local MCP server make no network calls. The separately configured cloud bridge makes authenticated network requests. A separately hosted browser copy is a snapshot and does not automatically sync with your local vault.

This repository contains reusable code and fictional examples. Keep private configs, vaults, actual project history, credentials and hosting metadata out of commits. The included `.gitignore` covers common runtime locations; review files before publishing your own fork.

## Development

```sh
npm test
```

Tests use fictional fixtures and cover portable setup, local MCP round trips, concurrent clients, status preservation, verification stages, dependency chains and reimports, temporary file locks, routing, no-history activation, final-only parsing, split UTF-8 writes, duplicates, lock conflicts, restart recovery, pause behaviour, credential masking, source history and Obsidian links. This is an early working prototype; it is not a universal screen or chat recorder.

MIT licensed. The bundled Pele 1.7.0 library is MIT licensed; its original licence and package integrity receipt are in `dist/vendor/`.
