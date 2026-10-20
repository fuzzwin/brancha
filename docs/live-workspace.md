# One live workspace, two views

The configured vault's brancha.json is the local record. Obsidian and the loopback companion read it; generated pages are projections. Localhost now opens a live workspace that uses the same project/chat renderer and generated data as the bundled Obsidian plugin. The previous browser record editor remains at /editor, with a return link to the live Home. No browser extension is needed to use either dashboard.

| Detail | Obsidian | Localhost |
| --- | --- | --- |
| Project analytics, workstreams, mindmaps and dependency drill-down | Shared renderer/data | Shared renderer/data |
| Saved chats, source index, source replies and artifacts | Interactive chat views and notes | Same interactive views; safe Markdown source viewer |
| Project/chat timeline, history and filters | Shared renderer/data | Shared renderer/data |
| Daily recaps, Today, review and connections | Generated pages | Same generated pages |
| Git branch history | Linked generated notes | Same linked notes |
| Personal Notes and editable Canvas | Native Obsidian features | Open in Obsidian link; personal notes are not served |
| Update canonical records | Skill, CLI or connected tool | Existing record editor |

The live header identifies the vault and revision, with a link into that same vault in Obsidian. The Home renderer also labels the live vault, so separate experiments/snapshots can be distinguished from the capture service's configured record. Install/reload the current Obsidian plugin after an upgrade; localhost serves that renderer's source directly. Existing themes and unrelated vaults need no changes.

Generated-view delivery requires the local per-start token and passes through the same exact-chat privacy filter. Only managed generated paths are served. Unknown files, personal Notes, paths outside Generated and cross-origin requests are rejected. Saved Markdown/diagrams are treated as data, not executable page instructions.

A remotely published ChatGPT Site or hosted browser copy remains a separate surface. This change does not silently make it a live mirror, upload a vault, or broaden capture to other chats. The companion must run for browser access and live refresh; Obsidian's saved files remain available offline. Capture integration and model limits are independent of which dashboard you open.
