# Portable Branchi

Branchi's core is a local JSON project record. The browser and generated Obsidian views read that record. AI tools connect through optional adapters. No storage vendor, AI provider, model account, cloud service or Obsidian installation is required for the local runtime.

Requires Node.js 22 or later. This version was exercised on macOS; a GitHub Actions matrix is supplied for Windows, macOS and Linux. A configured CI job is not evidence that those remote jobs have run.

## Choose an entry point

| Entry point | Capture behaviour | Requires |
| --- | --- | --- |
| Local Codex watcher | New final completion reports in local session files | Running companion and readable Codex session directory |
| Local MCP | Milestone checkpoints in an activated client conversation | A client supporting stdio MCP; one connection per client |
| Checkpoint CLI | A selected versioned JSON receipt from any tool | A trusted local integration or deliberate CLI call |
| ChatGPT Connect | Explicit tools in an activated ChatGPT chat | Separately hosted private service and account connection |
| Browser only | Manual edits in browser storage | Browser; export backups manually |

Installing instructions or a connector does not create passive access to all chats. The local MCP server works without the browser process; keep the companion running to refresh Obsidian. Different clients share the same file and revision, but each conversation chooses its own project. There is no shared global active-project switch.

## Set up on another computer

```sh
git clone https://github.com/fuzzwin/branchi.git
cd branchi
npm run setup -- --no-codex --view both
npm run doctor
npm start
```

Choose `--view obsidian`, `--view localhost` or `--view both`; interactive setup asks, and non-interactive setup defaults to both. See [reading surfaces](reading-surfaces.md). Obsidian-only runs without a localhost listener. Existing configuration is preserved; use `npm run views -- MODE` to change it, then restart.

Leave off `--no-codex` if you want local Codex completion capture. Use `--sessions PATH` for a custom session folder. `--vault PATH`, `--config PATH` and `--port NUMBER` select storage and connection settings. Setup preserves an existing configuration; it does not silently change capture policy or routes.

The default private config is `~/.config/brancha/config.json`, also on Windows. `BRANCHA_CONFIG` or an explicit config argument overrides it. Config path fields may be absolute, begin with `~/`, or be relative to the config file. CLI arguments are relative to the invoking directory. Use native paths on each computer; do not copy another machine's absolute paths.

To move an existing workspace, stop all writers first, back up the vault, copy it, then point the new computer's private config at that vault. Do not run two companions against a folder that a sync client independently replicates between computers: file locks are local and this is not distributed synchronization. Keep cursor state and machine credentials local. Alternatively, connect each ChatGPT chat to the same private cloud service; the optional bridge appends new cloud-origin records locally and does not provide two-way synchronization.

## Connect an AI client

Print a connection snippet from this checkout:

```sh
node scripts/mcp-config.mjs json
node scripts/mcp-config.mjs toml
```

An optional second argument selects the config. The output contains resolved paths to the Node executable, local MCP script and chosen config. Add the relevant entry to your client's MCP settings and restart/reload its connection as required. The JSON output uses the common `mcpServers` format; the TOML output uses `mcp_servers.brancha`. Client settings locations and UI differ. The generator does not edit global settings or send credentials.

Use the generated `node` command directly. Do not configure `npm run` as the MCP command: npm's banner is not a protocol message. Four tools are shared with the cloud edition: `brancha_projects`, `brancha_resume`, `brancha_checkpoint`, `brancha_create_project`. Local tools use local files and do not contact the cloud service, even when a bridge is configured elsewhere.

Starter:

> Use Branchi to list my projects, then resume PROJECT NAME. Keep the original goal and evidence visible. Save meaningful milestones and unsaved work before project switches without asking me to repeat the save request. Keep the chosen project in this conversation and reread the revision before each write.

For parallel chats: read current state, use a new requestId for each new checkpoint, and reuse it only for retries of identical content. A stale revision requires a fresh read and reconciliation. A connected local client can read the configured workspace; separate private configs/vaults are the boundary for personal versus work data. A session allowlist is not access control for an MCP client with filesystem access.

## Approved automatic chats

Optional config:

```json
{
  "capturePolicy": {
    "mode": "approved",
    "approvedSessionIds": ["an-explicit-chat-id"],
    "excludedSessionIds": ["never-capture-this-chat-id"]
  }
}
```

Fresh setup and a missing policy use `approved`: every new chat stays excluded until individually included. A legacy explicit `all` value remains parseable for compatibility and is not broadened by setup. Exclusions take precedence. Session-aware sources use this policy, including the checkpoint CLI. The watcher advances past excluded activity before queueing messages; enabling a chat later does not backfill skipped text. This policy does not filter the projects visible to an explicitly connected MCP client. Capture pause prevents local checkpoint writes and defers cloud pulls; reads remain available.

## Obsidian

Open the configured vault, then `Generated/START HERE.md` or `Generated/Dashboards/index.md`. Obsidian is the primary workspace; the browser is its companion view. See [project dashboards](obsidian-dashboard.md). The visual overview is `Generated/Brancha.canvas`; `Generated/Records.md` remains the full table. The latter is a table with escaped wiki-link separators. Structured verification and acceptance criteria appear in generated item notes. The browser inspector and editor expose those fields without dropping source provenance.

```sh
npm run obsidian-style
```

This installs and enables CSS scoped to generated Branchi maps and records. It backs up the existing snippet and appearance settings, preserves other settings/snippets, and leaves personal notes untouched. Restore the listed backups to undo it. Native Obsidian rendering still needs visual inspection; passing SVG geometry tests alone does not prove native readability.

## Versions and diagnosis

`npm run doctor` reports package version, commit, dirty state, Node version, platform, workspace validity, route validity, source tool count and scoped CSS alignment. It does not print paths, project names, routing IDs or credentials. It makes no network requests, changes no files, and does not verify the deployed connector or an actual Obsidian rendering. Compare its source version with the independently deployed cloud service when releasing.

File replacement retries a temporary EPERM/EBUSY/EACCES up to four times after the first attempt. It never deletes the old destination to make a replacement succeed. Persistent errors remain errors; the cursor queue and idempotent checkpoints support replay. This bounded retry is not a promise that every filesystem or sync client supports the same atomic behaviour.
