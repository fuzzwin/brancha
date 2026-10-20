# Daily recaps and optional client capture

Daily recaps now assemble automatically from included saved work, without extra model calls. Open **Home → Daily recap** or the **Brancha · Daily recaps** bookmark. Each page shows work by project, source-linked decisions, explicitly recorded reasons, branches, tasks/results and where to resume. The current day updates while you work; after midnight it is the previous day's recap. The latest 31 recorded dates are available. These are living projections: late mapping and later review status may update them. Missing rationale is labelled, not invented. Queue/allowance gaps remain visible. The computer and companion must run to capture and refresh.

Luna's structured extraction now supports a rationale and an exact rationale quote from the same source. Missing reasons use empty values. Existing proposals without reasons are not given invented explanations or silently replayed. This is visible source analysis, not recovery of hidden model reasoning.

## Ordinary ChatGPT and Claude web chats

The new **Brancha Local Capture** Chrome extension uses a native messaging bridge. Rendered visible user requests and assistant responses go to the configured local canonical record; the existing intake and Luna mapper handle them. It does not read cookies, authentication storage, private APIs or other browser pages. No chat data is uploaded by the adapter. Each exact chat must be activated with a chosen project from the extension popup. **Also capture currently visible replies** is a separate opt-in for late activation; unloaded/hidden/unavailable history is not recovered.

The extension waits for generation to stop and the visible response to remain stable for eight seconds. New receipts are replay-safe and an offline outbox remains only in browser local storage. Unknown origins and subframes are rejected. Pause/exclusion stop canonical writes; Stop this chat also clears its local delivery queue. DOM selectors are best effort: changed site markup, closed/background tabs and unloaded history can reduce coverage. Check the popup and source receipt, rather than assuming capture succeeded. This is not an official ChatGPT/Claude transcript webhook.

Browser capture is optional and not part of desktop setup. The extension source is in `browser-extension/`. To opt in, run `npm run browser-host`, open `chrome://extensions`, enable Developer mode, choose Load unpacked and select that folder. Reload existing ChatGPT/Claude tabs, then choose a project and enable only the intended conversation. On Linux the host installer supports the standard Chrome location. Windows registration, other Chromium browsers and ordinary native ChatGPT/Claude desktop apps are not installed by this adapter. Connection and real receipt delivery require separate verification. See [desktop workflow and coverage](desktop-workflow.md).

## Claude Code

Run `npm run claude-hook` to add the optional **UserPromptSubmit** and **Stop** hooks to Claude settings. Start/reload a Claude Code session and say:

> Brainch this chat for My project

The hook matches only a direct activation prompt and an exact existing project title. Quoted instructions do not activate capture. Subsequent completed main-agent responses are queued durably, then imported and mapped by the companion. A temporary canonical lock does not lose the receipt. No transcript file is opened; hidden reasoning, tools and subagents are excluded. “Exclude this chat from Brancha” stops it. The installer includes no existing conversation. Verify an actual Claude-generated completion to prove delivery from the installed application.

For another computer, run `npm run claude-hook` after standard Brancha setup. Existing settings/hooks are preserved and changed files backed up. Remove only the Brancha command entries to uninstall.

## ChatGPT Work and hosted Connect

Run `npm run desktop-hook` for the additive user hooks or install the bundled plugin hooks. Review/trust exact definitions, then activate a single local-only Work conversation with **Brainch this chat for My project**. The documented hook runtime supports local orchestration and execution; cloud orchestration does not load these user command hooks even when a tool executes locally. No browser extension is needed. See the [desktop setup and real-receipt check](desktop-workflow.md).

The hosted Connect interface provides explicit project checkpoints. Installing it on the web does not deploy scripts or enable a passive all-chat listener. A ChatGPT Site is an optional dashboard, not permission to read other conversations.

## Retrospective examples

An owner may request a separate, local retrospective of specifically authorized visible work. Keep these source inventories and recap simulations private, outside the source repository. A reconstruction is not evidence that capture was enabled historically, exhaustive account coverage, or continuing permission to collect those chats. Never import personal, mixed or ambiguous history by default.

## Validation

130 automated tests passed. Tests cover daily date/DST boundaries, missing rationale, privacy, task proposal preservation, exact-source browser receipts, duplicate replay, Claude activation/locks, native framing/origin checks, stable completion detection, chat switches and concurrent offline delivery. A synthetic headless Chrome DOM check verified removal of buttons and explicitly hidden text. These tests are not a live ChatGPT/Claude account capture test. No browser credentials or new model allowance were used. The existing budgets and twice-daily High schedule remain unchanged.

Sources: [OpenAI plugin hooks](https://developers.openai.com/plugins/build/plugins), [Claude Code hook reference](https://code.claude.com/docs/en/hooks), [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging).
