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
  Accepted receipts retain their consent epoch and captured project through
  intake, mapper jobs and reviewer runs. Consent and pause are checked before
  each Low/High transmission and again under the canonical lock before applying
  results or publishing a review note. A call already started before revocation
  cannot be recalled; renewal never authorises its later escalation or result.
  Model results require a matching permission snapshot. Legacy ready results
  without that proof require explicit review. Legacy raw jobs may recover exact
  source/project/epoch from a saved receipt; current consent is never stamped
  retroactively onto an older receipt.
  Explicitly submitting a historical checkpoint is different from replaying an
  automatic queue: its source time is preserved and its acceptance time/epoch
  are recorded separately. Browser outboxes and desktop/Claude staged prompts
  also retain the original epoch. Each content tab supplies its own activation
  generation; the background never upgrades stale packets to renewed consent.
  Every tab rebaselines after a generation change, including suspended tabs. Lock contention does not spend model budget,
  and a waiting High escalation retains its Low result without repeating Low.
- Canonical writers share a process-owned directory-claim lock. Unique claim
  names and bakery ordering serialize contenders without deleting another
  owner's replacement lock. The empty container remains stable between claims;
  release removes only its own claim, avoiding a macOS publication/rmdir race.
  Only positively dead local PIDs are reclaimed.
  Unknown, malformed, foreign-host and legacy ownerless file locks fail closed;
  inspect those manually after confirming no old writer remains. Do not mix
  running old and new writer versions during deployment. This is a local
  filesystem protocol, not a distributed lock for concurrently synced machines.
- Moving a chat's route creates a separate source for the new project, preserving
  the previous project's source history and manual relationships. Historical
  ambiguous relationships are not silently rewritten. Unassigned Inbox receipts
  may resume after an exact chat assignment: the first concrete destination is
  persisted, while the original Inbox source/event remain unchanged. Concrete
  A-to-B rebindings never move already accepted A work.
- Cloud pull, connection authentication and initial seed upload reject redirects,
  so custom credential headers and private seed bodies cannot follow them.

## Verification

`node --test --test-concurrency=1 tests/*.test.mjs` runs the complete suite without
installing dependencies. `tests/security-boundaries.test.mjs` covers the six
reported defects, Windows junctions, partial/restarted consent boundaries,
interrupted lock owners and competing writer processes. All fixtures are
fictional. Cloud redirects use two loopback origins with fake credentials.

The initial patch passed 170 tests locally. Additional independent review then
found consent, transmission and routing paths needing correction. Seven new
fictional regressions reproduced those failures against that source. The
expanded `tests/consent-provenance.test.mjs` covers further regressions covering
the corrections, legacy model results, hook/browser queues, contention budgets
and paused/resumed High dispatch. Independent focused verification passed 30
tests after the corrections. The corrected full serial suite passed **183/183**,
including all 24 security regressions. Earlier local attempts exposed an
unavailable fixed fixture port and one-second Git subprocess timeouts under load;
the port fixture now requests an available OS port, isolated Git tests passed,
and the complete rerun passed. Cross-platform CI remains separate evidence;
do not infer a green matrix from this Windows run. Lock stress serializes 100
writes across five children with
bounded deadlines and guaranteed cleanup. This is practical regression coverage,
not a formal concurrency proof or exhaustive crash-point analysis.

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
   Reads/startup also honour the canonical lock: a legacy ownerless file can
   prevent startup as well as writes. Inspect it only after all old writers are
   stopped. For rollback to an older file-lock writer, inspect and remove only a
   known-empty new lock container after all writers are stopped; never remove
   live/unknown claims automatically. If browser capture is used, update extension 0.14.2 and the native
   helper together, then reactivate the exact chat to obtain its epoch ticket.
5. Restart through the existing launcher and verify capture, permissions,
   generated views, canonical revision and rollback. Preserve paused/disabled
   choices. Do not overwrite Notes, configuration, backups or canonical JSON.
6. Reconcile `codex/dashboard-map-refresh` separately. That branch includes
   configuration/budget changes as well as UI changes; it is not a drop-in
   renderer deployment. A deployed cloud service may also have tools absent from
   this repository: do not replace it using the repository worker blindly.

No deployment is performed by this document or by the tests.
