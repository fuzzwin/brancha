# Set up Branchi on another computer

Branchi keeps completed work, decisions, sources and next steps together. **Obsidian and localhost are two views of the same local record.** Previously called Brancha; existing `brancha.json`, config paths, skill names and plugin IDs continue to work.

## 1. Install the prerequisites

- Git and Node.js **22 or later**.
- Obsidian, if you want the notes and native maps.
- Codex desktop for local chats. For Luna's optional interpretation, a supported Codex CLI must also be installed and signed in on this computer. Installing Branchi does not transfer a model account or create an API key.

## 2. Run three commands

In Terminal or PowerShell:

```sh
git clone https://github.com/fuzzwin/branchi.git
cd branchi
npm run quickstart
```

This prepares **both** views, installs the bundled activation skill, and starts the companion. Keep that terminal open. There are no npm dependencies to install.

On **macOS**, use this last command instead if you want login startup and no open terminal:

```sh
npm run quickstart -- --background
```

The background option uses the existing `com.brancha.companion` login service and its private logs. Do not run a second foreground companion on the same port. Windows and Linux currently use the foreground command; login startup on those systems is not installed by this release.

Advanced choices: `--view obsidian`, `--view localhost`, `--vault "PATH TO VAULT"`, `--config "PATH TO CONFIG"`, `--sessions "CODEX SESSION FOLDER"`, `--port 51208`, `--no-ai` (capture without AI interpretation), or `--no-codex` (manual/MCP checkpoints). `--prepare-only` installs the files without starting a service. An existing connection is preserved; change its reading surface with `npm run views -- both`, then restart its companion.

## 3. Open your two views

- Browser: <http://127.0.0.1:51207/>.
- Obsidian: **Open folder as vault → Documents/Branchi**. Enable **Branchi Interactive** in Community plugins, then open **Generated/Navigation/Home**. Obsidian may ask you to enable community plugins first. The installer never approves plugin trust on your behalf or changes your theme.

Quick-start installs a new Codex skill under `~/.agents/skills/brancha`; existing custom skills are preserved. Codex normally discovers it automatically; restart Codex if it does not appear. The retained command name is `$brancha`. The skill uses the local connection; a skill alone is not a background listener. [Official OpenAI skill locations](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills).

## 4. Activate one chat, then work normally

In a **local Codex chat**, use the skill and name the project you want:

> Use $brancha. Create or resume my “Room makeover” project. Include this exact chat for that project and keep its meaningful work, choices, sources and next steps in Branchi as we work. Preserve the original goal.

The skill creates or resumes the project and activates only that conversation. Subsequent completed turns are collected automatically while the companion runs. Another chat needs its own one-time activation. Personal and unknown chats remain excluded.

After one response finishes, open **Home → Recent chats → your chat**. Check the saved request and reply timestamp. Use **Full-page map** to expand branches, search records, inspect sources or switch to **Flow / dependencies**. A basic chat/source map works without an AI call.

Luna normally interprets newly saved work after a short delay. Automatic High catch-up checks waiting work every 15 minutes and follows a remaining batch after one minute. Existing daily limits apply: 20 Low/escalation calls, at most 3 High escalations inside that allowance, plus a separate 8 High catch-up calls. Failed or ambiguous interpretation remains visible; proposals are not accepted decisions or verified completion. Pausing capture pauses these stages too. A sleeping or powered-off computer cannot run local capture.

## 5. Verify the connection

From the checkout, in a second terminal:

```sh
npm run doctor
```

Then let another activated Codex reply finish. Confirm the new saved source appears in **both** Obsidian and localhost without a save request. Check **Home → Connections** for scan, capture, mapping and next catch-up times. The views should describe the same projects and source records; the web page reconnects after a companion restart. A configured flag or passing fixture alone is not proof that a real AI client delivered a reply.

The watcher observes the local Codex completion format; it does not capture unfinished replies, hidden reasoning or all other apps. ChatGPT **Work with local execution** has an optional reviewed hook route (`npm run desktop-hook`); exact hook trust and a real client delivery test remain necessary. Ordinary ChatGPT chats use explicit connector checkpoints. Claude Code and optional web capture have separate opt-in integrations. See [desktop coverage](desktop-workflow.md). No browser extension is needed for local Codex.

## Bring your existing projects

Before moving data, stop the old companion and all other writers and back up its vault. Copy **brancha.json**, **Notes/** and any personal attachments to the new vault **before starting** its companion. Then run quick-start with `--vault "PATH TO THAT VAULT"`. Branchi regenerates the reading pages locally; confirm original requests and next actions before resuming.

Keep machine config, capture cursors, routing paths and credentials local. Do not copy account secrets into the repository or activate every old chat. GitHub distributes the app, not your private project history. Existing absolute file links may need their attachments moved or relinked. Do not run two companions against independently synced copies of one vault: this release has no cross-computer merge or two-way synchronization. Use one writer, or independent local copies.

## Update an existing installation

Stop its companion. In a clean checkout:

```sh
git pull --ff-only
npm run quickstart
```

Use `--background` again on macOS if that is your startup mode. Quick-start preserves the private connection and locally edited skills, and refreshes managed Obsidian files. Inspect local source changes before pulling. Rerun optional hook installation if the checkout or Node path moved; review trust again if the client requests it.

## Help

- **No chats listed:** activate that exact chat, then complete a new reply. Excluded history is not silently backfilled.
- **Replies saved, decisions waiting:** check the model sign-in, daily allowance and pending queue. Source capture does not need a model call.
- **Obsidian shows a code block:** enable Branchi Interactive and switch the generated note to Reading view.
- **Port already in use:** stop the existing companion or choose another port; do not start duplicate collectors.
- **Existing skill preserved:** review your customized skill before replacing it. Quick-start never overwrites custom instructions silently.
- **ChatGPT/cloud:** see [connection boundaries](chatgpt-usage.md); a hosted copy is separate from this local record.

Portable setup and foreground capture are tested with isolated fixtures. The real desktop/Obsidian delivery test was performed on macOS; Windows/Linux CI checks do not establish real Obsidian rendering, model sign-in or client event delivery there.
