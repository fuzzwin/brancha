# Branchi 0.20 — clearer dashboards and maps

Home, project dashboards, saved chats, timelines and full-page maps share Obsidian theme colours, compact summaries, calmer spacing and a smaller next-action panel. Back and Home have a dedicated sticky navigation bar in reading view. New projects inherit the same renderer and stylesheet.

Existing project/map controls remain available: project/chat switching, map previews and drill-down, full-page mindmap and dependency modes, expansion, search, zoom/fit/readable size, selected-record sources, timeline filters, work queues and AI handovers. Viewing these pages does not change project records or accept AI proposals.

Home keeps all saved chats searchable, while initially showing four recent chats. Automation and setup details remain available on demand. This release also fixes a chat dashboard rendering error after the next-action panel.

## Validation

- 166 local Node tests passed on macOS, including navigation destinations, history, map modes, expansion, model preservation, search and source actions.
- Main Obsidian vault: Quantum Clock dashboard and full-page map rendered; sticky navigation checked in a scrolled reading view.
- Cross-platform CI is configured for Node 22 on macOS, Windows and Linux. A local macOS run does not establish Windows/Linux UI behaviour or a completed CI run.
- Plugin files are backed up before replacement. This visual update does not require a service restart or changes to chat inclusion or model settings.

## Trying it from GitHub

See [setup on another computer](another-computer.md) and [reading surfaces](reading-surfaces.md). Node 22+ is required; Obsidian is optional. Choose Obsidian, localhost or both. Manual use needs no AI account; automatic capture needs a supported integration and explicit inclusion of each chat. Optional AI interpretation needs supported signed-in access and uses its limits.

This is a local app: localhost points to the computer running the companion. Do not expose the local companion to the public internet. A public GitHub repository lets people install their own copy; it does not provide a hosted account or synchronise their records.

## Remaining release work

For an early technical-user release, the setup, examples, export/backup guidance and regression tests are present. Before claiming a frictionless desktop product, validate installation and everyday use on clean Windows/Linux machines, provide a simpler installer, and define a convenient upgrade/rollback workflow. Current macOS background startup is optional; other platforms use a foreground process.

A public multi-user web service is a separate project: accounts and authorisation, isolated persistent storage, recovery/backups, deployment and operations need to be designed and tested. The existing localhost token and loopback binding do not establish those capabilities. Hosted snapshots and the optional private cloud connector have different update semantics from the local vault.

Public screenshots and demos must use fictional records. Keep personal vaults, captured chats, credentials and machine-specific config out of Git. Reported AI work is a source, not proof that the work was completed or tested.
