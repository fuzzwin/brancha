# Checkpoint protocol v1

The versioned envelope is a small interchange format for trusted local integrations. It records a selected result, not a raw transcript, hidden reasoning, screenshots, shell instructions or credentials. External tools are never executed by the importer.

Copy an example under `examples/checkpoints/`, replace the fictional project ID with an existing Brancha project, and read the current revision using the skill helper or MCP tools. Then:

```sh
npm run checkpoint -- my-checkpoint.json EXPECTED_REVISION
```

An optional third argument chooses the config; `-` reads stdin. The CLI takes at most 64 KB. The same normalized content and provider/sessionId/eventId is a no-op on replay, including after a stale-revision retry. Reusing that identity for changed content fails. A new event ID creates an immutable source checkpoint. It cannot overwrite original prompts or create/guess a project. Prerequisite IDs must belong to the selected project.

Required fields: `version` (1), `provider`, `sessionId`, `eventId`, `projectId`, `title`, `summary`, `next`.

Optional fields: `kind` (source, decision, branch), `status`, `evidence`, `sourceRef`, `at`, `prerequisiteIds`, `acceptanceCriteria`, `run`. Unknown top-level fields are rejected. IDs must be opaque non-secret strings of 1–150 letters, digits, underscores, periods, colons or hyphens. Neither a credential nor arbitrary transcript text belongs in an identity.

## Meaning and acceptance

| Source status | Stored status | Meaning |
| --- | --- | --- |
| Missing or unrecognised | unknown | No supported completion interpretation |
| proposed / planned | planned | Proposed work |
| active / in progress | active | Work in motion |
| blocked | blocked | Needs an obstacle resolved |
| done / complete / verified complete | reported_done | A claim to review |
| parked | parked | Explicitly set aside |

The raw reported status is retained. External completion claims never become verified completion or satisfy original project criteria automatically. Every supplied acceptance criterion keeps its text, reported state, evidence and source. The browser/skill can record a later explicit review. `done` is the legacy stored value displayed as **Verified complete**; existing records retain their user-recorded meaning. It requires an evidence note. When structured acceptance criteria exist, all must be verified with evidence. When verification stages exist, acceptance must explicitly be accepted. A label is not independent proof of the underlying result.

Verification stages are separate: implementation (`unknown`, `in_progress`, `reported_done`), testing (`not_run`, `passed`, `failed`, `blocked`), acceptance (`pending`, `accepted`, `rejected`). A probe reporting `passed` only populates testing, while acceptance remains pending. Existing records without these fields are not retrospectively given inferred stages.

## Improvement receipts

A `run` records `phase` (propose, probe, compose, reflect), `outcome` (unknown, passed, failed, blocked), `decision` (undecided, keep, revise, reject), `hypothesis`, `baseline`, `observation`, `lesson`, and `artifacts` (label/ref pairs). An adopted improvement requires a passing observation and at least one artifact reference. Those references are stored without fetching or executing them; their presence does not authenticate their content.

This uses the [Harness²](https://github.com/google-research/harness2) idea of testing candidate changes and retaining evidence-supported lessons. Brancha supplies the receipt and project continuity, not Harness²'s recursive execution engine. If a user independently runs Harness², a small trusted wrapper can select its results and construct this envelope. Keep baseline conditions and configuration consistent. Never automatically copy a whole run directory, harness instructions, evaluation data or private traces.

[ARTEMIS](https://github.com/google/artemis) is optional for Android work. Its device tools and trace/status evidence can inform a selected project checkpoint. The Artemis example shows an envelope an integration constructs after inspecting a result; it is not a direct parser for an Artemis trace file and is not proof a device test ran. Review useful evidence first, reference the trace, and keep acceptance separate. Brancha does not install ADB, models, accessibility helpers or a phone controller.

Both upstream projects publish Apache-2.0 licenses. No code from either is vendored in this implementation; Brancha's implementation remains MIT. If future contributions copy upstream code, preserve the applicable license, notices and provenance. Native upstream adapters should be separate optional contributions with fictional fixtures and tested upstream format versions.

## Dependencies and reimports

`dependencyChain` expands the full task dependency chain independent of edge order. Resume output is bounded and explicitly reports omitted dependency links. `groupedDependencies` reports apparent grouping cycles separately; task cycles are still rejected. Grouping cannot manufacture a task dependency failure.

The skill helper supports `import-links` with an expected revision, source key, projectId for the activity record and a complete relationship set. `reconcileImportedEdges` gives each source ownership of its assertions, removes its obsolete assertions, and retains independent/manual connections and assertions owned by other sources. Reimporting an equivalent set changes neither edges nor revision. Invalid imports are checked on a copy before mutation. This is a reusable primitive, not an automatic parser for arbitrary task systems.

## Privacy

Common credential patterns and quoted/unquoted credential assignments are masked across imported text fields, including evidence, artifacts and lessons. This is best-effort protection, not general confidential-data detection. Store compact selected summaries. Local MCP reads/writes the configured local record. The CLI has no network calls. Private cloud checkpoints reach the independently hosted service, and an approved bridge only appends new cloud-origin records locally. Any folder synchronization is governed by the user's storage service; local storage does not mean device-only if that folder is synchronized.
