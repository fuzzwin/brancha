# Security and persistence fixes for 0.18.1

This patch is based on main at `938a9d5c79ccda593a1870e535df250324e472e7`.
It changes source code and fictional tests only. It does not install software,
restart a service, migrate a user's records, enable capture/AI/cloud features,
or deploy a hosted service.

## Corrected boundaries

- Activity filenames use normalized UTC dates rather than raw imported text.
  Portable exports reject traversal, absolute/Windows device paths and unsafe
  names. Filesystem exporters reject symbolic-link/junction components.
- Browser and local MCP snapshots include the current chat-permission state in
  their concurrency token. Permission edits and canonical writes share a lock;
  a stale filtered snapshot is rejected rather than deleting newly visible work.
- New/re-enabled exact-chat permissions save a durable session-file boundary.
  Watcher restarts skip earlier bytes and partial records. Timestamped records
  preceding consent are excluded, and replaced log identities are rechecked.
  Durable queued turns carry a consent epoch, so exclusion and renewed inclusion
  cannot replay an earlier turn even when its timestamp is absent or invalid.
  Existing configuration approvals retain their existing watcher cursors; this
  patch does not grant or revoke any approval.
- Canonical writers share a process-owned directory-claim lock. Unique claim
  names and bakery ordering serialize contenders without deleting another
  owner's replacement lock. Only positively dead local PIDs are reclaimed.
  Unknown, malformed, foreign-host and legacy ownerless file locks fail closed;
  inspect those manually after confirming no old writer remains. Do not mix
  running old and new writer versions during deployment. This is a local
  filesystem protocol, not a distributed lock for concurrently synced machines.
- Moving a chat's route creates a separate source for the new project, preserving
  the previous project's source history and manual relationships. Historical
  ambiguous relationships are not silently rewritten.
- Cloud pull, connection authentication and initial seed upload reject redirects,
  so custom credential headers and private seed bodies cannot follow them.

## Verification

`node --test --test-concurrency=1 tests/*.test.mjs` runs the complete suite without
installing dependencies. `tests/security-boundaries.test.mjs` covers the six
reported defects, Windows junctions, partial/restarted consent boundaries,
interrupted lock owners and competing writer processes. All fixtures are
fictional. Cloud redirects use two loopback origins with fake credentials.

Final validation: 170/170 tests passed serially, including 11 new security
regressions. The initial parallel run passed 167/169 and hit existing one-second
Git and four-second service-start timeouts under load; the serial full rerun
passed. An independent source/fixture review found the renewed-consent queue
case above; it was fixed and rechecked with no remaining findings. Lock stress
serialized 100 writes across five child processes. This is practical regression
coverage, not a formal concurrency proof or exhaustive crash-point analysis.

## Deployment plan (separate approval and maintenance step)

1. Inventory the current runtime, deployed skill helpers, renderer and local
   adaptations. Preserve the full runtime plus private configuration, permission
   records and canonical workspace in an appropriate local backup outside Git.
2. Reconcile this patch with the installed adaptations in a staging directory.
   In particular, merge `companion/server.mjs` and both `core.mjs` copies; do not
   replace their local changes wholesale. Keep all extra local files.
3. Run the regression suite and compare the staged installation against the
   approved source manifest. Test a fictional nested vault independently.
4. During approved maintenance, stop the old main companion and ensure its old
   CLI/MCP writers are inactive before replacing reviewed code. Keep the test
   companion distinct. Update standalone skill helpers together, including the
   new `locking.mjs` dependency. Do not run setup against existing settings.
5. Restart through the existing launcher and verify capture, permissions,
   generated views, canonical revision and rollback. Preserve paused/disabled
   choices. Do not overwrite Notes, configuration, backups or canonical JSON.
6. Reconcile `codex/dashboard-map-refresh` separately. That branch includes
   configuration/budget changes as well as UI changes; it is not a drop-in
   renderer deployment. A deployed cloud service may also have tools absent from
   this repository: do not replace it using the repository worker blindly.

No deployment is performed by this document or by the tests.
