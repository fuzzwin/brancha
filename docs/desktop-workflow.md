# Desktop first: work normally, keep the map

Obsidian is the primary workspace. The local companion collects completed work from enabled sources, Luna proposes decisions/tasks/offshoots, and the validated writer updates maps, chat dashboards and daily recaps. The browser dashboard is another view; opening it is not required for local capture.

## Choose your desktop workflow

| Where you work | Automatic capture | Setup and limits |
| --- | --- | --- |
| Codex desktop, local chats | Available through the running local session watcher after one exact-chat activation | Say **Brainch this chat for My project** with an existing project name. Later completed turns save without repeated requests. The watcher must be running. |
| ChatGPT desktop, Work with local execution | Supported integration route through the bundled Stop hook | Run `npm run desktop-hook`, review/trust both definitions in `/hooks`, then activate the exact chat with a direct prompt. Scripts and the local vault must exist in that execution environment. Verify a real receipt before assuming it is live. |
| ChatGPT desktop, ordinary Chat | Project resume/checkpoint calls through Brancha Connect | This build has no verified passive transcript integration for ordinary Chat mode. A plugin connection or skill by itself is not an all-chat background listener. |
| ChatGPT desktop, Work with Cloud execution | Explicit connector checkpoints | Local scripts are not deployed by installing the hosted connector. The local watcher cannot observe cloud transcript files. |

One exact-chat activation is retained for subsequent turns in that chat. New/personal/ambiguous chats remain off until chosen. Switching desktop apps does not grant capture permission to a different chat. Capture stores visible completed work and explicitly recorded reasons; it does not recover hidden reasoning or unavailable history. Model analysis can lag behind saved receipts when the configured budget is reached.

## Install the desktop hooks

After the ordinary Brancha setup, run from this checkout:

```sh
npm run desktop-hook
```

The installer adds UserPromptSubmit and Stop to `~/.codex/hooks.json`, preserves unrelated hooks and backs up changed files. It pins the current Node executable and checkout path; rerun it after moving the checkout or replacing that Node installation. Use either these user hooks or the bundled plugin hooks; installing both is unnecessary. The existing Codex watcher remains compatible and shares capture identities to avoid duplicate saved turns.

Review both exact definitions with `/hooks` in a supported local runtime. The installer never writes trust approvals or bypasses hook trust. The desktop UI may require you to complete this step yourself. Start a fresh Work conversation with both orchestration and execution local. Cloud orchestration with local tools is a different mode and does not load these user command hooks.

Send **Brainch this chat for My project**, using one exact existing project name. This direct prompt activates only that session. Thereafter UserPromptSubmit stages redacted visible context and Stop queues its main completed response. A busy vault lock leaves a durable local receipt for the running companion; restart does not require another save request. No transcript path is opened and no model call occurs inside either hook. Exclusion, pause, and the existing model limits still apply.

Uninstall by removing only the two Brancha command entries from `~/.codex/hooks.json`. Preserve other hooks. Disabling/removing the hook does not erase existing private captures.

## Know it is working

1. Trust the hooks, start local-only Work, and send a direct activation for an existing project.
2. Send a harmless connection-test prompt and let the response finish. A fixture or direct shell invocation is not a real Work delivery test.
3. Open Brancha Home in Obsidian and check capture is running, not paused.
4. Complete a turn in an activated local Codex chat.
5. Check its saved source timestamp and request in the chat dashboard. A configured plugin, enabled flag or successful fixture test alone does not prove delivery.
6. Return to Home → Daily recap for recorded work, decisions, branches and the next step. Missing reasons and pending interpretation remain labelled.

No recurring model is needed to copy each response. The local collector and deterministic writer handle intake; bounded Luna jobs interpret newly saved work, with incremental catch-up under the existing limits.

## Optional web and Sites routes

The Chrome extension remains an optional adapter for people who choose ChatGPT or Claude in Chrome. Its native bridge is opt-in and is not part of desktop setup. Removing it does not stop Codex capture. Each web chat needs its own activation.

A ChatGPT Site can present Brancha's dashboard and use the hosted connector's supported project checkpoints. Hosting a Site does not let it read unrelated ChatGPT conversations, desktop apps or a local vault. Cloud and local records need their configured, authenticated bridge; publishing a dashboard is not proof of automatic capture or synchronization.

References: [OpenAI plugin hooks and execution requirements](https://developers.openai.com/plugins/build/plugins), [hook review and trust](https://learn.chatgpt.com/docs/hooks).
