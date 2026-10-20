# Local project index and deep dives

Run `node scripts/project-index.mjs` from the companion checkout. This refreshes `Notes/Project index.md` and `.brancha/project-index/index.json` in the configured vault. It does not call a model or modify canonical project claims. The command works without a source registry; coverage is then limited to the Brancha record.

Optionally register up to eight selected owning documents per project in `.brancha/project-index/sources.json`:

```json
{"version":1,"projects":{"PROJECT_ID":{"kind":"project","sources":[{"label":"Current handoff","path":"/your/local/project/CURRENT.md"}],"limits":"Selected handoff only; no runtime or deployment test."}},"discoveryBacklog":[]}
```

Keep this private file out of Git. Paths are machine-specific and must be re-registered on another computer. Different projects must retain distinct IDs and sources, even when names are similar. Use `kind: "inbox"` for capture triage. Never register credentials, environment files, private client configuration or raw session stores.

The index records stable project IDs, selected source paths and hashes, review freshness, dated notes, model receipts and coverage gaps. It reports `not_reviewed`, `reviewed`, `changed_since_review` or `review_missing`. A reviewed state means the selected packet matches its latest model review, not that the project is complete or that a model verified runtime outcomes. Source excerpts are bounded. Missing sources and omissions stay visible.

`projectPacket`, `deepReviewSchema`, `validateDeepReview` and `saveDeepReview` are reusable exports for a requested model review. Findings require exact source quotes. Actions and map sections must reference known source IDs and remain proposals in a dated note. Reviews never automatically become canonical decisions, prerequisites or accepted completion. The latest pointer advances after both the note and private receipt have been saved. Failed calls must retain their attempt/error and must not advance a success pointer.

Luna Medium is suitable for the requested review pass. Use the existing signed-in read-only Codex runner with tools, user configuration, web search and inherited project instructions disabled; pin the requested model and effort. Save requested and independently observed model identifiers separately, measured usage, packet fingerprint and omissions. Do not silently substitute a different model. Avoid repeated calls for unchanged inputs. The companion refreshes an existing local registry/index every minute while running, without calling a model. The standalone helper installs no model runner or schedule; consult the index from an existing authorized review workflow.
