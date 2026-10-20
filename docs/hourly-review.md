# Automatic, twice-daily and manual Branchi catch-up

Branchi 0.13.0 has two stages: a bounded GPT-6 Luna High reviewer and a deterministic update worker. Immediate completion capture and the Low mapper continue independently.

With `reviewer.autoCheckMs: 900000`, the running companion checks waiting work every 15 minutes, with a one-minute follow-up when a completed batch leaves backlog. The due timestamp survives restarts. Unchanged input uses no model call; failed packets are not automatically retried, pause and the existing eight-call daily ceiling still apply. Set the interval to `0` to disable only this trigger.

The optional local scheduler invokes `node scripts/catch-up.mjs` twice daily. It first recovers the saved-receipt handoff, then runs one bounded High batch. Home's **Check now** writes a local request that the running companion handles within its polling interval. Both paths share the same lock, cursors, daily budget and durable receipts. No separate open-ended action model is needed to update the vault.

## Input and boundaries

- Review unreviewed completed/failed mapper jobs and pending jobs older than five minutes from explicitly routed projects, using saved visible user messages and final assistant reports. No hidden reasoning or unrelated session history is read.
- One batch covers up to eight turns in one project and 36,000 excerpt characters. Backlog remains visible for later runs. A source excerpt can be truncated.
- Review uses `gpt-6-luna` with `high` effort, ephemeral read-only CLI execution and model tools disabled. The initial reviewer cap is eight calls/day, separate from the existing mapper's limits. Failed calls consume a reservation too.
- Skip previously reviewed or failed inputs. Failed results require inspection rather than automatic retries. Capture pause also pauses review. A forced check does not bypass limits.
- The scheduler itself has a separate Luna High turn to invoke and inspect the helper. The helper's model receipt is a separate scope. Do not add usage copied onto individual proposals again.

## Review → validate → update → verify

1. Persist a bounded input packet and reserve budget before the High call.
2. Validate structured output, exact source quotes and allowed relationship types.
3. Save the validated output before any canonical write.
4. Deduplicate exact source quotes against existing same-chat proposals.
5. Under the existing canonical lock, apply only source-linked, unaccepted decision/task/offshoot proposals. Preserve original scope, accepted decisions, manual fields and completion evidence.
6. Write a dated Obsidian review, immutable run receipt and evaluation result, then advance cursors. If the canonical file is temporarily locked, resume the saved update stage without another model call.
7. The companion regenerates dashboards, maps, timelines and Home. Its own scheduled maintenance output is excluded from new capture, avoiding a feedback loop.

Run artifacts live under `.brancha/reviewer`, and review notes under `Notes/Reviews/Hourly`. A scheduled configuration is not proof of a completed run: inspect its receipt and Home's last-completed timestamp. The Mac and desktop app must remain available for scheduled local work; manual requests require the companion and signed-in CLI.

## Setup elsewhere

From a configured checkout: enable the mapper, run `npm run reviewer -- enable`, install the Obsidian plugin, and restart the companion. The twice-daily desktop schedule is per computer and must be configured there; copying a vault alone does not install that schedule. `npm run reviewer -- request` requests a manual check. `npm run reviewer -- run` runs one bounded check directly. `npm run reviewer -- disable` disables the reviewer after companion restart.

## Self-improvement and harness2

The current implementation uses a fixed, versioned review harness, source-grounding checks, receipts, duplicate suppression, failure retention and regression tests. These expose measurable failures for subsequent improvements. They do not autonomously rewrite prompts, source code or safeguards.

Google Research's harness2 is **not installed or embedded**. Its upstream README describes Propose–Probe–Compose and persistent evidence-supported lessons, Linux/Python 3.12 setup, and model-backed benchmark dependencies. Its documented executor defaults include unrestricted networking and Codex without its sandbox. Those defaults are not adopted by Branchi. The useful pattern here is a proposal checked against evidence before adoption, with results retained. Full recursive harness experiments would be a separate isolated development workflow with a baseline, fixed evaluation cases and explicit adoption criteria.

Sources: [harness2 upstream](https://github.com/google-research/harness2), [OpenAI iterative repair example](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex), [scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app).
