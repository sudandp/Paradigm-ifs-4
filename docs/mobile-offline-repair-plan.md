**Offline repair and completion plan**

Created: 19 November 2026. Status: planned; no repairs performed through this document.

Basis: [verification report](mobile-offline-verification-2026-11-19.md) and [original implementation requirements](mobile-offline-implementation-plan.md). This document defines the repair sequence; the original requirements remain the acceptance scope. Preserve the verification report and its failing results as historical evidence.

**Outcome and priorities**

First eliminate confirmed loss of saved work and cross-account access in the current implementation. Then finish the shared persistence/synchronization architecture, migrate business workflows, and establish web/Android/iOS acceptance with recorded evidence.

Current baseline: TypeScript and web/PWA compilation pass; 196 of 197 existing offline tests pass; 12 additional requirement checks fail. The first milestone is all 209 current checks passing without reducing their behavioral assertions, plus the additional transaction and interruption checks required by the fixes. This milestone alone does not establish full offline parity.

**Execution order and dependencies**

| Package | Purpose | Depends on | Completion gate |
|---|---|---|---|
| R0 | Coverage, fixtures, environment and evidence setup | Existing audit | Inventory and test ownership recorded; resource gaps explicit |
| R1 | Prevent lost edits, attachments and conflict drafts | Existing regressions; can start during R0 | V01–V04 and V11 pass with real transaction coverage |
| R2 | Enforce ownership on reads, writes and destructive actions | R1 transaction helpers | V05, V06, V12 pass; two-account scenarios verified |
| R3 | Repair gate, migration verifier, storage failures and attendance | R1–R2 | V07–V10 and attendance regression pass; all current 209 checks pass |
| R4 | Establish compilable native shells and API routing | R0 | Android compilation and Mac/Xcode build recorded |
| R5 | Complete storage contract and safe migration | R1–R3; R4 for native validation | Both adapters pass identical contracts and restart/migration exercises |
| R6 | Implement shared domain replay and transactional server handlers | R2, R5; inspected test schema | Replay parity, concurrency and retry tests pass against test backend |
| R7 | Complete downloads, lifecycle recovery, readiness and upgrades | R5–R6 | Two-device pull, deletions, reconnect and upgrade tests pass |
| R8 | Migrate and verify every business workflow | R5–R7, inventory from R0 | All workflow matrix rows have supported behavior and evidence |
| R9 | Complete native capture, files and lifecycle parity | R4–R7 | Physical Android/iPhone native acceptance passes |
| R10 | Record full acceptance and prepare release | R0–R9 | All original completion criteria satisfied with linked evidence |

Native environment preparation can begin while immediate repairs are underway. Do not postpone R1–R3 until a SQLite migration, iOS build environment, or complete feature inventory is ready. Do not switch production storage to SQLite before R5 passes on both platforms.

**R0 — Establish coverage and reproducible evidence**

- [ ] Inventory routes, forms, reads, writes, edits, deletes, approvals, exports, notifications, native calls, and backend endpoints. Trace callers rather than relying on the presence of helper functions.
- [ ] Create `docs/mobile-offline-feature-matrix.md` with one row per action: role, platform, prerequisite cached data/files, current read/write path, local/deferred/online-only classification, server handler, expected state, test reference, owner, and result.
- [ ] Record native app IDs, WebView origins, versions/build numbers, installed-data layout, plugins and custom native code before changes. Preserve existing version edits.
- [ ] Prepare representative synthetic account/organization/role/site fixtures and an isolated test backend. Confirm schema, triggers, constraints, RLS and storage policies before designing migrations.
- [ ] Record availability of Mac/Xcode, physical iPhone, Android tooling/devices and test credentials. An unavailable dependency remains unverified; it does not prevent independent local repairs.
- [ ] Keep existing historical logs intact. Save subsequent results under distinct package/run names with commit, environment and command.

Gate: inventory is complete before R8 coverage sign-off. Any unavailable execution environment has an explicit owner and outstanding check.

**R1 — Protect work during concurrent saves and synchronization**

Primary files: `services/offline/outbox.ts`, `syncEngine.ts`, `saveOfflineAware.ts`, `conflictActions.ts`, `db.ts`, and their regression tests.

- [ ] Add atomic queue mutation helpers that compare the expected operation/revision and lease before changing state. Perform read/compare/write or delete in one IndexedDB transaction. Keep HTTP, hashing and file I/O outside that transaction.
- [ ] Fix V01 by updating only the acknowledged attachment checkpoint on the still-matching operation. Never write the stale in-flight item over the whole current queue record. A checkpoint must identify the attachment version/hash it actually uploaded.
- [ ] Fix V04 with atomic acknowledgment that returns an explicit result such as acknowledged, newer work retained, or operation absent. Apply equivalent guards to failure transitions and lease recovery so stale callbacks cannot replace newer state.
- [ ] Fix V03 by replacing online success's unconditional `removeForRecord` with acknowledgment of the exact saved revision. Preserve newer cache content as well as the pending queue entry.
- [ ] Fix V02 using reference-aware cleanup. An attachment is reclaimable only when no pending operation, draft or retained cached record references it. Schedule filesystem deletion after the committed metadata change and recheck references before deletion.
- [ ] Give replacement file content a distinct immutable identity/path. An older upload must not overwrite the newer revision's bytes at a reused remote path.
- [ ] Missing attachment bytes produce a retained, actionable failure; do not silently sync a record without its required file.
- [ ] Fix V11 by returning distinct server-fetch outcomes: found, confirmed absent, and fetch failed. Keep the local draft on fetch failure. Apply “Use Server” only to the revision the user reviewed; a newer edit requires renewed resolution.
- [ ] Distinguish discarded work from server-acknowledged work in events and status messages.

Checks: V01–V04/V11; edits during each attachment upload and server acknowledgment; concurrent tab writers; lost response; failure callbacks arriving after another save; missing/replaced files; conflict lookup failure; successful acknowledgment without a newer edit. Upgrade the test harness where transaction APIs change, retaining the original assertions and race scenarios. Add browser IndexedDB transaction tests because map mocks cannot prove atomicity.

Gate: no tested older completion, checkpoint, error or resolution action removes a newer edit or a still-referenced attachment.

**R2 — Scope all operations to the correct account**

Primary files: outbox/cache/repository modules, `services/api.ts`, sync review/status/conflict components, authentication lifecycle and native queues.

- [ ] Define scope as authenticated capturing account plus organization/tenant. Keep this separate from business subject fields such as the employee receiving an attendance record; managers legitimately create work for other users.
- [ ] Require explicit scope for queue selection, cached reads, counts, retries, exports, conflict actions and deletion. Validate individual selected IDs at the mutation boundary, not only in the UI filter.
- [ ] Fix V05: quarantine missing, anonymous or dummy ownership for review. Infer ownership only from trustworthy existing metadata; never assign it to whoever next signs in.
- [ ] Fix V06: partition caches by account/organization and apply applicable cached access rules consistently. Preserve legitimate manager reads while preventing access to another account's cache partition. Include PWA response caches and cached files in this review.
- [ ] Fix V12: bulk removal receives an explicit scope and deletes only the records visible and authorized in that scope. The storage helper must enforce scope even if a caller supplies foreign IDs.
- [ ] Bind each drain to a validated session/account generation. On logout or account switch, stop claiming work and prevent old callbacks/workers from using the new account's credentials.
- [ ] Resume authentication-paused work after same-account session validation. Keep unauthorized/revoked work locally with a useful reason rather than retrying it under another identity.

Checks: V05/V06/V12; account A to B switch with pending, failed, cached and attached work; manager-on-behalf-of-employee capture; organization switch; missing owner; logout during upload; native queue ownership.

Gate: B cannot inspect, export, replay, resolve or discard A's private local work. Legitimate same-account and manager workflows still function.

**R3 — Repair the remaining reproducible failures**

| Finding | Required repair | Verification |
|---|---|---|
| V07 | Canonically serialize nested objects, preserve array order/types, hash attachment bytes separately, and compare complete source/target ID sets and counts. Reject extra, missing or changed target data. | Nested edits, reordered object keys, changed arrays, missing/extra IDs, binary corruption |
| V08 | Make unsupported-store writes fail explicitly; add versioned stores for supported gate/patrol entities. Propagate actual transaction/quota errors through adapters and legacy `addToOutbox`; retain form inputs. | Unsupported store, migration from old schema, transaction abort, quota exhaustion; no false success |
| V09 | Check every roster query's error before replacing its cached section. Preserve last successful data on failure; allow a validated successful empty response to clear a section. | Partial fetch failure, complete failure, valid empty roster, restart |
| V10 | Serialize legacy gate queue updates and remove only acknowledged entry IDs. Stop dual-writing new submissions; use one authoritative outbox. Journal import of old entries with stable IDs and proven owners before retiring the old queue. | Concurrent entry during RPC, repeated import, lost response, duplicate prevention, restart already online |
| Attendance | Use the supplied reference instant consistently for open-shift duration. Apply the documented Asia/Calcutta business-day/shift rules independently of device timezone. | Existing failure, fixed clock, overnight/open shifts, midnight boundaries, different device timezones, repeated punches |

Gate: all current 209 checks pass, relevant new boundary tests pass, and TypeScript/web build remain green. Preserve historical failing logs; record the repaired results separately.

**R4 — Make native targets buildable early**

- [ ] Repair the Android `TrackingService.java` exception-handler variable scope and compile the real application with its existing package ID and plugins.
- [ ] Generate/complete the Capacitor iOS project while retaining custom tracking, push configuration, identifiers and permissions. Bundle the app UI and use a Capacitor bridge that supports the installed plugins.
- [ ] Replace remaining relative `/api` fetches at actual callers with the native-aware client. Preserve auth headers and validate native-origin CORS and deep-link behavior against the test environment.
- [ ] Change mobile CI to compile Android and invoke Xcode on macOS. Uploading a synced iOS folder is not a build result. Separate unsigned compilation evidence from signed device-build evidence.

Gate: recorded native compilation and offline local-shell launch on prepared devices. Plugin/sensor behavior is completed under R9.

**R5 — Finish the shared repository and migrate safely**

- [ ] Define scoped transactions for record plus operation creation, atomic queue claiming/acknowledgment, attachment metadata, checkpoints and schema migrations. Separate stable record ID, immutable mutation ID and local revision.
- [ ] Preserve every operation field across both adapters, including ownership, base server version, dependencies, capture time, attachment identities, attempts/backoff, lease, schema version and structured errors.
- [ ] Make factory initialization awaitable and failures explicit. Avoid silently opening an empty alternative backend after a native database failure; a fallback requires a verified data reconciliation path.
- [ ] Implement identical repository contract suites against browser IndexedDB and native SQLite/filesystem. Test commit/rollback, close/reopen, concurrent claims, schema upgrades, complete metadata round trips and quota errors.
- [ ] Stage file bytes before committing references. Recover interrupted staging and remove only proven orphan files after reconciliation.
- [ ] Implement journaled import of existing IDB, legacy queues, gate data, Preferences route points and caches. Verify IDs, owners, counts and file hashes; quarantine ambiguous rows without replaying ordinary display caches as new submissions.
- [ ] Keep the old source recoverable until verification and reader/writer transition complete. If shadow writes are used for comparison, designate one replay owner; record mismatches and never drain both copies.
- [ ] Persist migration/cutover state durably. Resume interrupted imports and reject incompatible downgrades; rollback must account for writes made after cutover, not discard them by reopening an older snapshot.

Gate: both adapters pass the same contracts; upgraded populated devices retain pending work and attachment bytes after interruption. Production callers use one authoritative storage path per platform.

**R6 — Share business handlers and make server replay safe**

- [ ] Build an explicit action registry for every inventoried legacy call, including nested updates, settings, enrollment rules, assets/tools and organization-keyed configuration. Reject unknown actions instead of treating all as generic upserts.
- [ ] Allocate stable identities once before local save and return those same identities to callers. Store dependent operations and hold them while parents are pending, failed or conflicted, including across separate drains.
- [ ] Route online and offline writes through the same domain command: commit locally first, then attempt delivery. Return saved-locally/server-confirmed/rejected states accurately.
- [ ] Implement test-schema mutation handlers that authenticate the actor, authorize tenant/record access, validate payload/business rules and compare the base version within the mutation transaction.
- [ ] Deduplicate by operation ID and actor/scope, store the result atomically with the mutation, and return that result on retry. Reject reuse of the same operation ID with different content. Version checks must cover edits and deletes.
- [ ] Preserve online leave balances/eligibility, approver routing, family relations, creator attribution, partial-settings semantics and other domain side effects during replay.
- [ ] Record external side-effect jobs transactionally and dispatch them after commit using stable deduplication keys. Verify notification/approval retry behavior; do not promise exactly-once delivery from a provider that cannot enforce it.

Gate: test-backend scenarios prove lost-response replay has one business effect, simultaneous edits yield a conflict, authorization failures retain local input, and offline replay produces the same permitted domain result as connected use. Prepare reviewable migrations and rollback instructions before any deployment.

**R7 — Complete two-way sync, readiness and upgrade recovery**

- [ ] Distinguish link status, bounded backend reachability and validated authentication. Apply bounded requests, retry backoff with jitter, and explicit permanent errors.
- [ ] Trigger a single drain after startup/session readiness, reachable reconnect, foreground/resume and periodic foreground retry. Recover expiring leases without racing active workers; persist resumable progress.
- [ ] Add scoped server change feeds with durable cursors and deletion markers. Commit each downloaded page and its cursor together. Protect pending local revisions/deletions and surface conflicts; handle expired cursors with a safe scoped resnapshot.
- [ ] Implement resumable reference/file downloads with manifests and content verification. Show per-feature “Ready offline” only when required prerequisites are present for the active account.
- [ ] Replace route-prefix eligibility with feature capabilities and cached-data availability. Explain first-use/download requirements without inventing sessions or completion of online-only actions.
- [ ] Replace unconditional upgrade cleanup with schema/cache migrations and validated replacement. Keep the old usable app assets, attendance context, reference data and drafts until the new state is ready, including Wi-Fi with no backend access.
- [ ] Export recoverable drafts with attachment bytes and metadata, scoped to the account. Restrict diagnostics to approved fields; exclude credentials, personal document content and unnecessary identifiers.

Gate: device B receives A's updates/deletes without overwriting its pending work; interrupted downloads resume; offline upgrade and previously unvisited supported routes work; cache age and saved/synced states are accurate.

**R8 — Complete workflow batches against the shared foundation**

| Batch | Required acceptance focus |
|---|---|
| A: Attendance/duty/breaks/OT/face | Stable punch IDs and times, all date ranges, overnight/Asia/Calcutta rules, original verification context, downloaded face models and descriptor restart |
| B: Enrollment/documents | Every form step/restart, binary drafts, canonical paths, parent/child/family identity, original creator, delayed validation |
| C: Snag/HT Yard/PPM | Field normalization, text edits preserving photos, site references, create/edit/delete, concurrent edits, missing media |
| D: Leave/tasks/reports/extra work/comp-off | Server rule/balance validation, attachments, approver routing, notifications and rejected input recovery |
| E: Tickets/posts/comments/uniforms | Parent ordering across retries, stable relationships, edits/deletes, photos and notification effects |
| F: Users/children/sites/assets/tools/finance/devices/violations | Explicit action/primary-key mapping, permissions, partial settings, dependent records and privileged server confirmation |
| G: Gate/patrol | Durable visitor/photo/scan capture, roster retention, one queue owner, concurrent arrivals, startup replay and real approval outcomes |
| H: Remaining CRM/HR/dashboard/report actions | Every remaining inventory row has cached/local/deferred behavior or an explicit online dependency, with an end-to-end check |

For each row test connected/disconnected save, restart, mid-request loss, replay, conflict, permission rejection, attachments and final server data under relevant roles. Migrate callers and remove legacy writers only after that batch's tests pass. A rendered screen or passing allowlist helper is not batch acceptance.

**R9 — Finish durable native capture and platform integration**

- [ ] Persist Android and iOS GPS events before any upload or auth early return, with stable event IDs, original capture times and immutable account scope. Acknowledge individual IDs only after server confirmation.
- [ ] Use one upload owner per native queue and compatible schema/locking for any shared writers. Recheck owner/session on reconnect, token refresh, logout and account switch.
- [ ] Connect iOS location/step events, permissions, start/stop and live token updates to the shared JS interface. Unsupported/denied states must be explicit; do not report success with a fabricated zero-step capability.
- [ ] Handle background expiration/cancellation and foreground retry without promising execution while the OS has suspended or terminated the app.
- [ ] Verify permanent camera/file storage, reopening/export/share/print, face/OCR assets, GPS, BLE/contacts where used, notifications, external links, back navigation, keyboard and safe areas on physical devices.

Gate: airplane-mode capture, process termination, reconnect and account switching preserve the original account's native events/files and replay without duplicates. Record Android and iPhone evidence separately.

**R10 — Acceptance ledger and release gate**

- [ ] Execute every eligible feature-matrix action across web/PWA, physical Android and physical iPhone using the original plan's 17 acceptance scenarios.
- [ ] Include first offline installation, prepared airplane mode, unreachable backend, lost successful response, concurrent edit/upload, storage exhaustion, expired/revoked session, account switching, two-device update/delete, force-close, background limitations and interrupted offline upgrade.
- [ ] Run an extended exercise spanning overnight attendance and a representative data/file volume defined in R0.
- [ ] Create `docs/mobile-offline-acceptance-results.md`: commit/build, platform/device/OS, role/scope, prerequisite data, scenario/test ID, local record/file counts, final server rows/versions, duplicate counts, timing, errors, result and evidence location.
- [ ] Run relevant regression, repository, server integration and native build checks. Update the original 24 findings and all 60 requirements only when their specific evidence passes; mark unavailable checks as unverified.
- [ ] Prepare a controlled rollout with migration progress/failure monitoring, retry/conflict rates, data reconciliation checks and an explicit halt/rollback procedure that preserves post-upgrade pending work.

Completion requires all eligible matrix rows and original completion criteria to pass. Unsupported online actions must be accurately classified and retain eligible drafts. Passing the first 209 checks or producing an APK does not replace the acceptance ledger.

**Reviewable delivery units**

Deliver small changes in package order: R1 queue/file/conflict safety; R2 account scope; R3 gate/storage/hash/attendance repairs; R4 native build setup; R5 adapters/migrations; R6 server and domain commands; R7 downloads/upgrades; individual R8 workflow batches; R9 native behavior; R10 evidence and rollout. Each change includes its affected findings, tests run, remaining limitations and migration/compatibility consequences.

The first implementation task is **R1**, starting with atomic queue acknowledgment and attachment checkpoint updates. No repair should delete historical evidence, relax a failing assertion merely to obtain a green run, or mark an unexecuted platform check complete.
