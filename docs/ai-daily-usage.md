# Daily AI usage

Home shows reserved model calls used / daily cap, calls remaining, the selected Luna reasoning effort, and the next reset date/time. These budgets are shared across all projects in one local vault. They are call counts, not tokens, credits or the signed-in account's allowance. Failed attempts consume a reservation too. Existing counts remain when a cap changes.

Budgets reset at midnight in `Australia/Melbourne`, including daylight-saving changes. Yesterday's ledger reads as zero in the new day's view; it is replaced when the next call is reserved. A missing ledger means no reserved calls; an unreadable ledger shows unknown usage rather than a fabricated zero.

Private config supports `mapper.reasoningEffort` and `reviewer.reasoningEffort`: `low`, `medium`, or `high`. Omitted values preserve existing defaults (Low mapper, High reviewer). The model remains `gpt-6-luna`. To keep every new run on Medium, set both efforts to `medium` and `mapper.maxHighPerDay` to `0`, which disables ambiguity escalation. Existing saved receipts retain the effort actually requested for those runs.

For a busier workspace, supported caps are up to 100 mapper calls and 24 reviewer calls per day. These are ceilings, not scheduled call targets or a guarantee of sufficient account allowance. The reviewer batches up to eight saved turns for one project per call. Capture continues when a daily budget is exhausted; permitted work waits for the next budget window. Raising a cap does not include new chats, replay excluded history or automatically retry failed jobs.

Keep settings in the private connection file. Restart the existing companion after a settings change; do not start a second instance. Obsidian's plugin needs reloading after updating its files. Localhost and Obsidian use the same Home data.

## Obsidian shortcuts

New Obsidian/both installations enable `obsidianBookmarks.enabled` in their private config. Existing installations opt in with the same setting. The companion runs the additive bookmark installer after dashboard generation, then when the project set changes (checked about once a minute). It preserves existing bookmarks, verifies the exact open vault, adds missing navigation/project-dashboard shortcuts, and uses no model calls. It does not bookmark every generated source note or chat.

Obsidian and its official CLI must be available. If unavailable, one delayed retry is allowed; repeated failures are shown in Connections rather than retried indefinitely. Open the correct vault and run `npm run obsidian-bookmarks` to repair/verify it. Localhost-only mode skips Obsidian bookmark changes entirely.
