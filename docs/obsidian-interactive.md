# Interactive Obsidian dashboards

Brancha 0.8.6 includes the local **Brancha Interactive** plugin. It uses the same Pele renderer as the exported maps. It needs no API key, network access, model or extra Obsidian dependency.

From the checkout, after connecting your vault:

```sh
npm run obsidian-interactive
```

In that vault, enable community plugins and then **Brancha Interactive**. Restart the existing Brancha companion after upgrading its source so it generates `Generated/Interactive/*.json`. Open a project bookmark in Reading view or Live Preview. If the note was already open when the plugin was enabled, reopen it.

- **Switch project** changes dashboard.
- Select a category in the mindmap, or its named button below, to see that category plus directly connected records.
- Select a record to see its immediate connections.
- **Open evidence** opens its ordinary Obsidian record.
- **Back** retraces in-dashboard selections; **Whole project** returns to the project mindmap.
- Use **+ / − / Reset zoom**, horizontal scrolling and keyboard Enter on map boxes.
- Cards open the relevant category or work queue.
- **More views → All notes & chat maps** retains the portable dashboard, conversation maps, all reports and review prompts.

The interface follows the vault's theme. Cards reflow in narrower panes. Diagrams preserve a readable minimum width and scroll, rather than shrinking labels indefinitely. Focused diagrams show at most 24 records; their captions disclose the total and category lists retain all category members. Grouping is not a recorded dependency.

Only generated project JSON is read. Clicking does not accept proposals or edit canonical records. The companion regenerates payloads when the local record changes; an open dashboard listens for those file changes and refreshes. The plugin itself does not capture chats or call Luna. Updates require the companion to run.

SVG inputs are restricted to drawing elements and presentation attributes. Scripts, foreign objects, embedded links, external resources, styles and event attributes are removed. Project strings are inserted as text, never executable HTML.

Disable the plugin to return to the linked portable notes and Canvas. The installer backs up existing plugin files and leaves other plugins and themes unchanged. This is a bundled local plugin, not an Obsidian marketplace release. Mobile compatibility is intended but not device-tested.

## Designed for a quick return

At a glance groups summary cards, the clickable mindmap and visual analytics. Your next step and written details follow. The current project stays selected at the top. How to use reveals a four-step guide; secondary views and generation details stay under More views. Continue with AI opens a handover note, not an automatic model run. The single plugin installer also installs scoped note-width styling; first-time users still need a configured vault, a running companion and explicit plugin enablement in Obsidian.

## Workstream progress (0.8.5)

At a glance includes clickable progress rows for recorded goals and offshoots. Tasks and outputs are grouped through explicit goal-to-work, branch and prerequisite connections; context links do not assign ownership. Child branches get their own rows. Ungrouped work appears under Other recorded work. Completed counts require recorded done status and evidence. Reports, AI proposals and parked work are excluded. Tasks and outputs count equally, with no effort weighting. Shared explicitly linked work can appear in more than one row, so rows must not be summed into overall progress. Empty streams show No linked tasks yet.

## Project and chat timelines (0.8.6)

Use **Timeline** on a project dashboard to jump to its interactive saved history. Select an event to expand the exact saved update, historical snapshot when available, status changes and the next step recorded at that time. **Open current record** clearly opens the present-day note; **Open source chat** links to a recorded Codex chat. Chat timelines have their own pages under Generated/Timelines, linked from project timelines, expanded events and Conversation pages.

Filter by chat, last 7/30 days or all saved history, and update type. Date grouping uses the project's displayed timezone. The newest 20 matching entries appear first; Show 20 more reveals more. Up to 400 recent project events are loaded, with a visible count when older history is excluded. Filters apply within that window. The underlying local record retains the older history.

Only source IDs saved with an event or a matching mapper job assign an event to a chat. Manual updates without source IDs stay in the project timeline. Current checkpoint content is never substituted for a missing historical snapshot. Timelines describe recorded events, not task durations, a complete chat transcript or every chat across external tools. The local companion refreshes their payloads automatically; the plugin makes no model calls.

## Home navigation (0.9.0)

Use the house ribbon icon or Open Brancha Home command to reach your projects and recent chats. Home buttons on dashboards and timelines return to the same page. Previous map retraces a drill-down without leaving the project. Generated record notes include a Home link. Project lists and recent chat lists sit side by side on wide panes and stack in narrow panes. Search filters both lists. Recent chats prefer the latest actual saved checkpoint over later mapper housekeeping; the local Codex name index supplies existing chat names when available. It is an optional observed-format adapter, so missing names fall back to a saved report title. Check now requests one bounded High review through the local companion. [Review setup](hourly-review.md).


### Built-in status key (v0.9.1)

Individual map boxes, detail badges and status bars share one default key: blue active, amber proposed, green verified complete, red blocked, orange reported done, grey parked, lavender unknown. Labels and symbols accompany colours. Proposed and reported-done boxes have dashed borders; dotted arrows retain their separate context meaning.

Offshoot is a record type, shown with a purple badge in details; it is not a completion status. Category boxes retain grouping colours. The map includes a compact visible key and an expandable explanation. `Generated/Guides/Status key.md` gives a daily routine and the full key.

Generated item frontmatter includes `brancha/status/<canonical-status>` and `brancha/type/<type>` tags, plus `brancha/origin/ai-suggestion` for mapped suggestions. These are derived metadata, not a status editing interface. No setup, new model calls, or changes to canonical statuses are required. Portable SVGs and Canvas card colours use the same families; Canvas arrows continue to show relationship types.


### Fit and screen space (v0.10.1)

Brancha uses a compact note layout, independent of Obsidian’s app zoom: 26px project titles, 102px overview cards and tighter panel spacing. A redundant generated Home paragraph is hidden only when its interactive page renders successfully. The sidebar, other notes and the vault theme retain their existing settings.

Maps fit their pane width and a bounded half-height frame, capped at 430 CSS pixels. Small maps are not magnified to fill a wide note. ResizeObserver recalculates the fit when the pane changes width. Very narrow or dense maps retain an 11px label floor and use scrolling. **Fit map** restores the overview; **Readable size** restores the renderer’s original label scale; plus/minus zoom relative to the selected mode. Wide panes share space between the map title, toolbar and status key; smaller panes stack these controls.


### Project and chat event timelines (v0.11.0)

The default timeline is a start-to-now milestone view, with coloured event rows and clickable markers. Blue is decision, green result record, purple offshoot, amber AI proposal, teal checkpoint, slate connection and grey other update. These colours describe event kinds, separately from work status. There are no duration bars or inferred schedules.

Nearby events group into time slots with counts; select a marker and then an item to inspect its saved snapshot, evidence, next step and source. The legend filters event kinds. Date and chat filters remain available. Start is the beginning of the saved record, not a reconstructed real-world project start; chat views use that chat’s first saved update. Empty periods remain visible on the axis.

Full saved history stays collapsed beneath the overview. Expand it for dated reports, evidence and pagination. All historical markers remain in the light overview, while the initial detail payload is bounded to 400 recent records. Older details load on demand from `Generated/TimelineHistory/<project>.json`; archive revision checks prevent mixing generations. Generated archives contain only canonical saved history and never require a model or network call.

Unchanged interactive Markdown pages are not rewritten on every capture refresh. JSON updates can refresh their content while preserving component state such as an open history dropdown. Personal notes, canonical completion status and earlier evidence remain unchanged.

## Compact dashboard · v0.12.1 / plugin 0.8.1

Home presents compact project cards beside included chats, with goal-evidence rings, last-saved dates, next steps and direct opening controls. Search filters both sets. Project and chat pages also have project/chat dropdowns sourced from the filtered Home projection, keeping exact-chat privacy intact.

Project layout: next step → At a glance (cards beside a group-only map on wide notes) → status and two-week activity → a full-width workstream strip → interactive timeline → written detail. Item previews toggles the richer existing mindmap. Narrow panes stack the layout; the same record IDs and drill-down views are retained. Chat counters jump to their corresponding sections.

Gauges show original goals with evidence, not time, effort or inferred completion. Last-saved dates are actual saved events; newly created projects without events display “No saved update yet”. Dates use the local client display. The existing capture/privacy rules and Obsidian theme remain unchanged.

## Dedicated map row · v0.12.2 / plugin 0.8.2

The four summary cards sit above the map. The project mindmap has its own full-width row at every note size, with a responsive height budget up to 560 CSS pixels. Item previews are shown by default; Hide item previews returns to the area-only overview. Area totals and + more nodes still open the corresponding related/dependency view. Existing zoom, Fit map and Readable size controls remain.

Dense or narrow diagrams keep the readable label floor and scroll inside the map; they do not stretch the whole page. Small diagrams are not magnified to fill empty space. Analytics, workstream strip, timeline and written detail continue below.
