# Branchi on another computer

Keep Obsidian as your main workspace. The local browser is a companion; the private ChatGPT connector is a separate entry point.

## Fresh setup: Mac, Windows or Linux

Install Git, Node.js 22 or later, and Obsidian. In Terminal or PowerShell:

```sh
git clone https://github.com/fuzzwin/branchi.git
cd branchi
npm run setup
npm run obsidian-style
npm start
```

Keep that terminal open. In Obsidian choose **Open folder as vault**, select `Documents/Branchi` in your home folder, then open **Generated → START HERE → project dashboards**. Each project gets a mindmap, progress and activity charts, dependency view and evidence notes. Personal writing belongs in `Notes`; `Generated` is refreshed automatically.

The browser companion is <http://127.0.0.1:51207>. Run `npm run doctor` in a second terminal from the checkout to check configuration and styling. No package installation or model API key is needed. If Codex has not created its session folder yet, doctor will warn; complete a local Codex turn, then check again. Unmatched chats appear in **Codex Inbox** until you configure a project route.

If you do not use Codex, replace the setup command with `npm run setup -- --no-codex`. Use `npm run mcp-config -- json` for a compatible AI client's local MCP connection. The [portable setup guide](portable-setup.md) covers routes, custom vaults and config paths. Setup preserves any existing config; flags do not overwrite it.

## Bring your real projects with you

For a move to the new computer:

1. Stop the old companion and other writers, including any login service, and back up the old vault.
2. Copy **brancha.json** and **Notes/** into the new vault before starting the new companion. Preserve any other personal attachments your notes reference.
3. Run the fresh setup above on the new computer, choosing that vault with `npm run setup -- --vault "PATH TO VAULT"` if it differs from the default.
4. Start Branchi. It regenerates dashboards from your project record. Verify the project names, original requests and next actions in Obsidian before resuming work.

Keep machine config, capture cursors, absolute project routes and credentials local. Do not point two running companions at independently replicated copies of the same sync folder: local locks do not resolve cross-computer conflicts. Two separate vaults are independent copies. This release does not merge edits between them automatically.

## Use the same projects from ChatGPT

Sign in to the same ChatGPT account, enable your existing Branchi Connect plugin in the new chat, then say:

> Use Branchi to list my projects and resume Quantum Clock. Keep Obsidian as my primary workspace. Save meaningful checkpoints and unsaved work before project switches without asking me to repeat the save request. Reread the revision before writing.

Switch with: **"Switch to ShortWalk; checkpoint any meaningful unsaved work first."** Each chat keeps its own selected project. A new chat needs Branchi activated again; the connector cannot passively watch every ChatGPT conversation.

The private cloud record is available while the old computer is off. A configured bridge appends new cloud checkpoints to a local vault while that computer runs. Configure a bridge separately on the new computer if needed; do not copy credentials into Git or a shared setup file. Local Codex checkpoints are not uploaded by that bridge. The hosted browser workspace keeps its own browser snapshots and is not a two-way vault sync.

## Start automatically and update later

On macOS, stop a manually running companion, then use `node scripts/login-service.mjs`. On Windows/Linux, keep `npm start` running or use your operating system's service manager; automatic startup on those systems is not installed by this release.

For an existing clean checkout: stop its companion, run `git pull --ff-only`, then `npm run doctor`, `npm run obsidian-style`, and restart the companion. Inspect any local code changes before pulling. Vault data stays outside the checkout by default.
