# Obsidian first

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

Pele is bundled locally. Native Obsidian dashboards embed generated SVGs, with scoped light/dark styling, without requiring an Obsidian community plugin. Portable Markdown exports include standard Mermaid source as a fallback. The style installer creates backups and changes only the generated Brancha classes and its named CSS snippet. Personal notes and unrelated themes/settings remain intact.

Validation uses fictional fixtures for analytics, timezone boundaries, dense mindmaps, template scope and generated links. Native Obsidian and browser checks are recorded separately. No claim is made that every Obsidian theme, narrow window or external client has been tested.

Diagram references change when their rendered content changes, so Obsidian displays fresh SVGs automatically. The companion writes new assets before updating note references, then prunes obsolete assets listed in its own generated-assets manifest. Unrelated files are preserved. Stable latest-image aliases remain available for manual links.

## Layout and autonomy audit (0.7.1)

The native dashboard puts the next action, compact metrics and attention lists before the map. Sparse activity gets an explanatory empty state instead of a large one-day chart; a trend chart appears after two active days. Recent updates link to their current records. Dependency arrows are labelled consistently in SVG and Canvas. Canvas is a generated view: layout edits may be replaced on refresh, so copy a Canvas into Notes to keep a personal arrangement.

Automatic Codex reports do not replace a concrete next action. Deliberately saved source checkpoints retain their next-step priority; otherwise Brancha chooses active or proposed work with satisfied prerequisites. These are recorded suggestions, not an autonomous planner.

### Recommended next version, not installed

Build a native Obsidian custom view over the existing local record: project switcher, clickable metrics, selected-node details, live capture status and a decision panel showing rationale, alternatives and consequences. Keep Markdown and Canvas exports as the portable fallback. An overlay in the app is preferable to changing the user's global theme. Preserve the last release and vault backup before a major migration; test migrations on a copy first.

An optional Luna-assisted review stage could process only newly captured reports in bounded batches. It should propose structured decisions, blockers and next steps with source IDs, deduplicate retries and hold a processing cursor. It must never promote a report into verified completion without evidence, change original scope, execute project work or interpret captured instructions as commands. Require an explicit enable step, a pause control, a per-run budget, a visible last-success/error indicator and a separate review queue. Exclude the agent's own summaries from capture to avoid feedback loops. Evaluate extraction against real examples before scheduling it. The existing capture/refresh service remains deterministic and needs no model API key.

Suggested Codex setup request: “Set up Brancha from this checkout with my Obsidian vault, preserve existing notes and theme, run doctor, install the Brancha skill, configure explicit project routing, and verify one captured checkpoint. Explain the platform's login-start method. Keep optional AI review disabled until configured and tested.”
