# Choose where to use Branchi

Requires Node.js 22+. Clone the repository, then choose a reading surface. No hosting or cloud account is needed for localhost.

```sh
git clone https://github.com/fuzzwin/branchi.git
cd branchi
npm run setup
npm start
```

Interactive setup offers **Obsidian**, **Localhost**, or **Both**. For scripts or a specific choice:

| Choice | Setup command | Behaviour after npm start |
| --- | --- | --- |
| Obsidian | `npm run setup -- --view obsidian` | Writes linked pages and refreshes them; no HTTP listener. The local plugin and scoped snippet are prepared; enable the plugin in Obsidian yourself. |
| Localhost | `npm run setup -- --view localhost` | Opens a loopback service at the configured port. Requires no Obsidian installation and installs no Obsidian settings. Generated files remain the browser's shared data source. |
| Both | `npm run setup -- --view both` | Same local record, generated data and renderer in both views. |

In a non-interactive shell, omitting `--view` preserves the default **both**. Setup preserves any existing configuration, including the existing reading surface; it does not silently overwrite a previous installation.

Change an existing installation with `npm run views -- obsidian`, `npm run views -- localhost`, or `npm run views -- both`, then restart the existing companion. The command prepares Obsidian assets when selected but never enables/trusts a plugin. Switching to localhost leaves existing saved Obsidian files in place; it does not delete a vault. Use `npm run views -- status` to inspect the choice. An optional final CONFIG argument selects a private connection file.

Add `--no-codex` when you do not want the local Codex watcher. Add `--no-ai` to disable automatic model mapping/review on a new installation. The reading-surface choice is independent of capture permissions and model preferences. All new chats remain excluded until explicitly included. Setup prepares configuration/assets; **npm start** runs the companion.

Open `Generated/Guides/How Brancha works.md` from Home for the linked program map and Canvas. `Generated/Guides/Automatic generation.md` explains what gets created and the limits. Personal writing belongs in Notes, since Generated pages are replaced from the record.
