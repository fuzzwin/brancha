# Obsidian first

## Daily navigation (0.7.2)

Open `Generated/Navigation/Home.md` for project cards, dashboard/map links and resume briefs. Stable pages include Today and yesterday (local calendar dates), Review, Connections and How to use. They refresh on workspace changes and once a minute while the companion runs, independently of heavy diagram rendering. Connection states are timestamped observations, not a live guarantee after the process stops.

With the vault open in Obsidian and its official CLI enabled, run `npm run obsidian-bookmarks`. It verifies the target vault path, backs up existing bookmarks, adds only missing shortcuts through the CLI, and verifies the result. Existing bookmarks are preserved. Home and Projects discover new projects automatically; rerun the command for new direct project bookmarks. Set `OBSIDIAN_CLI` to the installed CLI path if it is not on PATH (the standard macOS install is detected). An optional config path can be supplied after `--`. No Obsidian theme or community plugin is required.

Personal `Notes/Brancha guide.md` and `Notes/Brancha name ideas.md`, when present, appear as Home links. The service never writes these personal notes. Private hosted URLs and project data belong in the vault, not the repository.

Parity is about workflow, not identical storage: Obsidian and the local browser share the canonical local record; Connect has a separate cloud record whose new checkpoints are pulled additively; the hosted browser has its own browser-saved copy. There is no bidirectional local-to-cloud synchronization.

The vault is the primary Brancha workspace. Open `Generated/START HERE.md` or `Generated/Dashboards/index.md`. Each project receives a dashboard automatically, including projects created by a connected AI tool or new capture routing. The browser is a companion view; the separately hosted service is a separate release and synchronization boundary.

Each dashboard includes:

- A Pele mindmap showing the goal, current work, decisions, offshoots, results and source reports. This groups records by purpose; dependency arrows remain in the linked flow view.
- Evidence-backed original-goal counts, ready work, unmet prerequisites and source reports awaiting review.
- A local-timezone chart of saved updates over 14 days, plus recent decisions and checkpoints.
- Links to the original request, resume brief, dependency map and editable Canvas.
- Check-in prompts tailored by a view template, without invented tasks, criteria or completed stages.

The visual overview Canvas opens these dashboards. `Generated/Templates` contains Check-in, Decision and Evidence review notes to copy into personal `Notes`. Generated pages and diagrams are refreshed after record changes and once the local date changes while the companion runs. They are derived views: editing a generated page does not change the canonical record. Use the skill or connected tools to save a project checkpoint or review an evidence claim.

The five view templates are Everyday project, Build & ship, Make & test, Research & decide, and Career & applications. Automatic suggestions use the project name only. An explicit selection is stored as `templateId`; it does not change the original request. Template stage names are check-in prompts rather than inferred milestones.

Analytics count saved records. Source reports do not inflate work-item totals, passing test receipts do not automatically complete goals, and activity is not time, spending or productivity. Unknown criteria produce an unset percentage. Empty projects show empty states. Dense dashboard mindmaps show a bounded selection and the number of omitted records, with links to the complete record and flow.

Pele is bundled locally. Portable Obsidian dashboards embed generated SVGs, with scoped light/dark styling, without requiring a community plugin. From v0.8.3, project bookmarks open an interactive dashboard when the bundled Brancha Interactive plugin is enabled; its portable fallback is linked below the interactive block. See [interactive setup and navigation](obsidian-interactive.md). Portable Markdown exports include standard Mermaid source as a fallback. The style installer creates backups and changes only the generated Brancha classes and its named CSS snippet. Personal notes and unrelated themes/settings remain intact.

Validation uses fictional fixtures for analytics, timezone boundaries, dense mindmaps, template scope and generated links. Native Obsidian and browser checks are recorded separately. No claim is made that every Obsidian theme, narrow window or external client has been tested.

Diagram references change when their rendered content changes, so Obsidian displays fresh SVGs automatically. The companion writes new assets before updating note references, then prunes obsolete assets listed in its own generated-assets manifest. Unrelated files are preserved. Stable latest-image aliases remain available for manual links.

## Layout and autonomy audit (0.7.1)

The native dashboard puts the next action, compact metrics and attention lists before the map. Sparse activity gets an explanatory empty state instead of a large one-day chart; a trend chart appears after two active days. Recent updates link to their current records. Dependency arrows are labelled consistently in SVG and Canvas. Canvas is a generated view: layout edits may be replaced on refresh, so copy a Canvas into Notes to keep a personal arrangement.

Automatic Codex reports do not replace a concrete next action. Deliberately saved source checkpoints retain their next-step priority; otherwise Brancha chooses active or proposed work with satisfied prerequisites. These are recorded suggestions, not an autonomous planner.

### Recommended next version, not installed

Build a native Obsidian custom view over the existing local record: project switcher, clickable metrics, selected-node details, live capture status and a decision panel showing rationale, alternatives and consequences. Keep Markdown and Canvas exports as the portable fallback. An overlay in the app is preferable to changing the user's global theme. Preserve the last release and vault backup before a major migration; test migrations on a copy first.

An optional Luna-assisted review stage could process only newly captured reports in bounded batches. It should propose structured decisions, blockers and next steps with source IDs, deduplicate retries and hold a processing cursor. It must never promote a report into verified completion without evidence, change original scope, execute project work or interpret captured instructions as commands. Require an explicit enable step, a pause control, a per-run budget, a visible last-success/error indicator and a separate review queue. Exclude the agent's own summaries from capture to avoid feedback loops. Evaluate extraction against real examples before scheduling it. The existing capture/refresh service remains deterministic and needs no model API key.

Suggested Codex setup request: “Set up Brancha from this checkout with my Obsidian vault, preserve existing notes and theme, run doctor, install the Brancha skill, configure explicit project routing, and verify one captured checkpoint. Explain the platform's login-start method. Keep optional AI review disabled until configured and tested.”

## Visual and cross-project overview update (0.8.1)

The full-width native analytics image now includes work-status distribution, decision and branch record counts, pending Luna proposals, active days and saved-update history. Counts describe recorded state, not independently verified productivity or accepted decisions. Native Reading view and Live Preview were inspected separately. The separately hosted v0.7 dashboard has the four core metrics, status breakdown, activity and decision/checkpoint sections; the local record can contain newer data and Luna proposals.

Today uses one row per project, including quiet projects, with today/yesterday update counts, ready/waiting counts, the next step and a linked latest update. Each project gets a collapsed detail group with at most three preview updates and full activity links. Connection maintenance and zero-proposal mapper messages are skipped when choosing the latest summary if another saved update exists; all records remain in history.

The default Canvas is a focused working map: source reports and Luna proposals are available in a linked full-record Canvas. A visible count explains the omitted context; no canonical records or connections are removed. Work cards are packed into columns with at most three cards each to avoid excessive vertical spread. The relationship key appears directly on the Canvas; the detailed table escapes Markdown alias separators so it renders as three columns.

Local v0.8.2 makes embedded visuals follow the available note-pane width in Reading view and Live Preview. Mindmaps no longer have a 420px height cap, and dashboards/maps no longer impose a fixed article-width ceiling. A narrow pane scrolls wide diagrams (1100px minimum) and analytics (720px minimum) rather than shrinking their labels indefinitely. This does not fix the separate large-Canvas layout issue or install interactive branch navigation. See [local project index](project-index.md) for source-grounded project reviews.

## Interactive dashboards (0.8.3)

Project dashboards now offer clickable categories, record neighbourhoods and evidence navigation through the optional local plugin. Cards, resume panel, status distribution and activity bars follow the online layout. The old full-note dashboard remains at `<project>-static.md`. See [installation, interaction and limits](obsidian-interactive.md).
