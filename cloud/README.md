# Brancha Connect for ChatGPT

This is the private cloud entry point for Brancha, alongside the existing Codex Local service. It exposes four MCP tools: list projects, resume, create a project and save a checkpoint. Its skill supports checkpoints during a user-activated project task. It does not passively monitor all ChatGPT conversations.

## Hosting

The Worker is designed for an **owner-private Sites deployment**. Sites authenticates requests and provides `oai-authenticated-user-id`. A separate `BRANCHA_BRIDGE_TOKEN` secret authorises the local bridge after Sites service authentication. Do not expose this Worker directly on an unprotected public origin or trust caller-supplied identity headers outside Sites.

1. Create a new private Site and persist its returned project ID.
2. Build Worker source with `node cloud/build-site.mjs /path/to/site-checkout`.
3. Use the Sites Worker ESM starter build scripts and this source manifest configuration:

```json
{"project_id":"THE_RETURNED_SITE_ID","d1":null,"r2":"BUCKET","capabilities":["mcp"]}
```

4. Configure a fresh random `BRANCHA_BRIDGE_TOKEN` as a secret using Sites runtime settings. Never put it in source.
5. Build, validate, package and deploy through Sites. Sites creates a personal plugin and refreshes its tools on deployment.
6. Install/connect that personal plugin in ChatGPT. Platform sign-in and consent still apply. A new chat may be needed for newly connected tools to appear.

The cloud workspace is stored in R2 using conditional writes. Project requests are preserved, checkpoint writes require an observed revision, and request IDs deduplicate uncertain retries. Checkpoints do not automatically complete original success criteria.

## Skill and manual plugin package

`plugins/brancha-chatgpt/skills/brancha-chatgpt/SKILL.md` contains the cloud-specific workflow. The server also exposes it through the MCP skills extension for supported import/submission flows. Imported skills are snapshots, not a promise that a client fetches skill instructions at runtime.

A personal plugin created by Sites supplies the live tools. Reuse that plugin for the hosted instance. You do not need to add local Codex hook scripts to the ChatGPT cloud package. Public OpenAI directory submission is a separate process and is not performed by this repository.

## Optional cloud-to-local bridge

Only configure the bridge after the user has approved the **specific cloud destination, selected private project data to transfer and ongoing credential storage**.

`node scripts/connect-cloud.mjs /path/to/private/config.json` accepts a hidden JSON object on stdin containing `url`, `siteBearer`, `bridgeToken`, and optionally `seedFile`. It verifies the connection, optionally initialises an empty cloud workspace, and saves the connection under the private config directory with mode 0600. Do not pass credentials through shell arguments or save them in this repository. Existing non-empty cloud workspaces are not replaced.

Restart the local companion after connecting. Every 30 seconds it retrieves cloud records marked `cloudOrigin`, appends missing projects/checkpoints/links/activity to the local JSON, and regenerates Obsidian views. Existing local nodes and original goals are preserved; local edits are not overwritten. This is an **additive cloud-to-local flow**, not two-way synchronisation. Local Codex response capture is not uploaded by this bridge. When the Mac is off, cloud checkpoints remain available and are pulled after the Mac is back online.

Pause in the local app also defers cloud pulls. It does not delete checkpoints already saved to the cloud.

## Obsidian dependency view

The local service now renders `Generated/Maps/<project-id>.md` with a Pele SVG dependency mindmap. The associated Canvas uses the same graph layout, compact labels and links to full details. Captured response bodies stay in linked item notes. Enable the optional scoped `assets/obsidian/brancha-map.css` snippet to hide duplicate internal-ID titles in those generated notes. Manual notes remain under `Notes/`.

Tests use a simulated R2 store and a temporary local vault. Production connection and ChatGPT account sign-in must be verified separately for each deployment.
