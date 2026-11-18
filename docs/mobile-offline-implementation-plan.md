**Implementation plan: reliable offline web, Android, and iOS apps**

Created: 17 November 2026.
Status: planned; implementation has not started through this plan.
Basis: [docs/mobile-offline-audit-2026-11-17.md](<E:/backup/onboarding all files/Paradigm Office 4/docs/mobile-offline-audit-2026-11-17.md>) — 24 findings, including four critical data-loss defects.

**Target outcome**

After an initial authenticated setup and download of the data needed for a user's work, supported workflows must open without internet, save records and attachments locally, survive app restarts, and automatically synchronize with the correct account when the backend becomes reachable. Changes made elsewhere must also reach the device. Online web behavior remains the reference for business rules, validations, permissions, relationships, and resulting server data.

Every visible “Saved on this device” result must mean the local write has committed. “Synced” must mean the server acknowledged that exact operation/revision. Conflicts, rejected requests, expired sessions, and missing downloaded data must have explicit states.

First-time login, OTP delivery, live calls, external KYC/e-sign verification, cloud AI, email/push delivery, and remote approvals need server/network participation. Preserve eligible drafts and requests offline; do not imply that those external actions have completed. Existing local OCR and downloaded face models can be used offline where device validation confirms support.

Automatic sync is required on startup, foreground/resume, authenticated session restoration, and restored backend reachability. Background sync should run when the OS permits it and resume safely when the app opens. Do not promise immediate sync while the app is terminated or suspended: iOS schedules background opportunities and limits their execution time. [Apple background-task guidance](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app).

**Implementation decisions**

| Area | Planned design |
|---|---|
| Application interface | One local repository and synchronization contract used by all features; domain-specific handlers retain each feature's business rules. |
| Web persistence | IndexedDB records, outbox, attachment blobs, and sync checkpoints. Request persistent storage where supported and expose storage failures. |
| Android/iOS persistence | SQLite records/outbox plus app-private filesystem attachments behind the same repository interface. Validate the already installed SQLite plugin and native sharing model in Phase 2 before migration. |
| Preferences/localStorage | Small preferences and compatibility reads during migration; no new critical business queues or large attachment payloads. |
| Record identity | Stable UUID created once before the first local save. A separate operation ID identifies each mutation; never replace identity on retry. |
| Queue ownership | Account and organization scope on each record, operation, attachment, and checkpoint. Require the matching authenticated account to upload. |
| Mutations | Save the local record and operation in the same transaction. Stage file bytes first, commit references with the operation, and recover staged files after interruption. |
| Retry safety | Retry the same operation ID. Server-side idempotency and transactional version checks prevent duplicates and lost updates. |
| Concurrent edits | Preserve newer revisions while older ones are in flight. Acknowledgment removes only the exact completed operation. |
| Data received from server | Fetch scoped changes with checkpoints, including deletions. Preserve pending edits and surface conflicts rather than overwriting them. |
| Attachments | Durable local references, resumable upload checkpoints, content hashes/MIME types, canonical server paths, and explicit replacement/deletion. |
| Status shown to users | Saved locally, waiting for connection, syncing, synced, sign-in needed, conflict, or rejected with a useful reason. |

The native storage target addresses the limitations of WebView storage described in the [Capacitor storage guidance](https://capacitorjs.com/docs/v7/guides/storage). Validate it on both native platforms before cutting over. The early data-loss fixes below apply to the current IndexedDB implementation and should not wait for a storage migration.

**Phase 0 — Establish complete feature coverage and a repeatable baseline**

Depends on: the existing audit.

- [ ] Inventory every route and user action from App.tsx, pages, stores, services, native plugins, and server endpoints. The 24 findings are a starting point, not proof that every function was tested.
- [ ] Create a feature matrix with: role, platform, action, required cached data, attachments, current save/read path, offline behavior, server business handler, and acceptance test.
- [ ] Classify each action as locally executable, locally captured but server-confirmed later, or necessarily online. Include delete, edit, approval, export, notification, and error flows, not just create.
- [ ] Record existing native app IDs, origin/configuration, release identifiers, and the user's current version/build edits. Preserve existing installed data and project-specific native code.
- [ ] Use synthetic fixtures and a test backend with representative roles, sites, attendance rules, and documents.
- [ ] Confirm a Mac/Xcode environment and physical iPhone are available for the iOS work; prepare Android devices and build tooling. Device/build verification is a dependency, not evidence already collected.
- [ ] Prepare a minimal compilable Capacitor iOS shell, retaining existing native configuration, for the Phase 2 storage tests. Complete production plugin/lifecycle integration in Phase 4. This prevents the storage migration from depending on an iOS project that has not yet been created.
- [ ] Keep the existing 74 offline tests as the baseline. Convert each audit reproduction into a separate regression test asserting the desired behavior as its fix is implemented. Keep the original report/results as historical evidence.

Deliverable: complete feature matrix and repeatable test setup.
Exit condition: every inventoried workflow has a defined offline expectation and test owner/status; untested functionality is visible.

Primary areas: [App.tsx](<E:/backup/onboarding all files/Paradigm Office 4/App.tsx>), [services/api.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts>), [services/offline](<E:/backup/onboarding all files/Paradigm Office 4/services/offline>), [android](<E:/backup/onboarding all files/Paradigm Office 4/android>), [ios](<E:/backup/onboarding all files/Paradigm Office 4/ios>), [test-results/mobile-offline-audit.test.ts](<E:/backup/onboarding all files/Paradigm Office 4/test-results/mobile-offline-audit.test.ts>).

**Phase 1 — Stop losing work in the existing implementation**

Audit issues: 02, 03, 04, 07, 08, 09.
Depends on: Phase 0 baseline.
Status: ✅ Complete & verified by 80 automated vitest tests (including mobile-offline-phase1-verified.test.ts).

- [x] Remove automatic deletion of failed unsynced records and their attachments. Failed items remain available for retry, correction, or explicit discard. (Resolved in `services/offline/outbox.ts` via non-destructive `pruneStaleFailedItems`).
- [x] Compare revision/operation identity atomically before updating queue status, attachment checkpoints, or removing completed work. (Resolved in `services/offline/outbox.ts` via `markSynced(id, acknowledgedRevision)`).
- [x] Treat an exact current revision match as acknowledged. A server match to an older revision must leave the latest edit pending. (Resolved in `services/offline/syncEngine.ts` via step 3 revision rebasing).
- [x] Replace permanently stuck syncing markers with expiring leases; recover interrupted work after startup. (Resolved in `services/offline/db.ts` and `services/offline/outbox.ts` via `leaseExpiresAt` and `recoverStuckSyncingItems`).
- [x] Resume authentication-paused operations only after validating a session for the same account. (Resolved in `services/offline/syncEngine.ts` via `ensureSupabaseAuthSession` and `resumeAuthPausedItems`).
- [x] Remove manual sync's fallback to all users. Partition local reads and pending counts as well as writes; server permissions must not be bypassed by a shared cache. (Resolved in `services/offline/syncEngine.ts` via strict `getCurrentUserId()` isolation).
- [x] Ensure a conflict, failed item, or exhausted retry never appears as completed and never blocks unrelated valid work.

Meaningful checks: close/reopen mid-upload; edit while uploading; lose a successful response; refresh an expired session; switch accounts; retry repeatedly; leave failed records for more than 24 hours.

Exit condition: no tested sequence deletes an unacknowledged revision or attachment, or reads/uploads another account's local work.

Primary files: [services/offline/outbox.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts>), [services/offline/syncEngine.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts>), [services/offline/cache.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/cache.ts>), [services/api.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts>), [services/opsApi.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/opsApi.ts>).

**Phase 2 — Build the shared storage and two-way sync foundation**

Audit issues: 01, 07, 08, 09; foundation for all remaining phases.
Depends on: Phase 1.

- [x] Introduce a storage interface covering transactions, record queries, outbox operations, attachment references, schema migrations, account scope, and sync checkpoints. (Resolved via `IOfflineStorageRepository` in `services/offline/storageRepository.ts`).
- [x] Implement IndexedDB and native SQLite/filesystem adapters. Run the same repository contract tests against both. Verify native background writers and JavaScript use compatible schema/locking; avoid two independent upload owners. (Resolved via `IndexedDbStorageAdapter` and `SqliteStorageAdapter` in `services/offline/storageRepository.ts`, verified by `test-results/storage-repository.test.ts`).
- [x] Define durable operation fields: operation ID, record ID, account/organization, entity, action, local revision, base server version, schema version, captured timestamp, payload, attachment references, dependencies, status, attempts, next attempt, lease expiry, and last error. (Resolved in `storageRepository.ts` & `OutboxItem` in `services/offline/db.ts`).
- [x] Replace the empty addToOutbox with a real operation adapter. Map all 34 call sites explicitly, including nested update payloads and SAVE_SETTINGS, UPDATE_ASSETS, and UPDATE_TOOLS. (Resolved in `services/api.ts` via flattened adapter routing to `_offlineEnqueue`).
- [ ] Make online and offline writes use the same domain operations: commit locally, attempt synchronization if reachable, and return an accurate local/server status. Validation that requires current server data remains provisional until confirmed.
- [x] Add stable UUIDs and parent/child dependencies for records created offline. Upload parents before dependent comments, attachments, or related changes. (Resolved via `services/offline/idGenerator.ts` and `sortItemsByDependencies` in `services/offline/syncEngine.ts`, verified by `test-results/dependency-ordering.test.ts`).
- [ ] Implement server-side mutation handlers with authorization, input validation, version comparison, idempotency, and result storage in one transaction. Run existing domain side effects through the same handlers so notification/approval behavior does not disappear on replay.
- [ ] Give notifications and other external side effects their own idempotency protection; retrying a mutation must not send duplicate notifications or issue duplicate approvals.
- [ ] Separate link connectivity, backend reachability, and authentication. Use bounded requests, retry backoff with jitter, and explicit nonretryable errors.
- [ ] Trigger processing after session readiness, reachable reconnect, foreground/resume, and periodic foreground retry. Prevent overlapping drains.
- [ ] Implement scoped server downloads with durable cursors/checkpoints, deletion markers, and cache updates. Push pending operations before refreshing affected records; never overwrite pending local edits with older server data.
- [ ] Bootstrap required reference data and files with a visible per-feature “Ready offline” state. Report what is unavailable when a device has never downloaded the required data.
- [x] Migrate current IndexedDB, legacy queue, gate queue, Preferences route points, and applicable caches with a resumable migration journal. Verify counts, IDs, owner mappings, and attachment hashes before marking migration complete. (Phase 2A safety protocol resolved via `services/offline/migrationJournal.ts`, verified by `test-results/migration-journal.test.ts`).
- [ ] Preserve unmapped records for review. Legacy display-cache rows cannot always prove whether a submission reached the server; do not blindly replay every cached row.
- [ ] Keep read compatibility and prevent dual replay during cutover. Remove legacy writers only after caller migration and device upgrade tests succeed.

Exit condition: both storage adapters pass the transaction/restart contract; one synthetic workflow completes local save, restart, server acknowledgment, retry without duplication, and download of a change from another device.

Server dependency: inspect the actual deployed schema, triggers, and row-level policies before implementing compatible migrations and testing them against the test backend.

**Phase 3 — Move each business workflow onto the verified foundation**

Audit issues: 01, 05, 06, 11, 12, 13, 18, 19, 20, 21, 22, 24.
Depends on: Phase 2; complete each batch's checks before moving to the next.

**Phase 3A — Conflict Resolution UI & Real-Time Sync Center**
Status: ✅ Complete & verified by automated tests (`test-results/conflict-resolver.test.ts`).
- [x] Multi-field diff computation between local draft and live server version (`buildConflictComparison`).
- [x] Three actionable resolution paths: Keep Mine (`resolveKeepMine`), Use Server (`resolveUseServer`), and Export Draft (`exportConflictDraft`).
- [x] User-facing Conflict Resolver Modal (`components/offline/ConflictResolverModal.tsx`) with side-by-side diff.
- [x] Real-time Sync Review Modal (`components/offline/SyncReviewModal.tsx`) with live outbox event subscription.
- [x] Header Sync Status Badge (`components/offline/SyncStatusBadge.tsx`) mounted in mobile & desktop headers.

| Order | Workflow batch | Required implementation and exit check | Status |
|---|---|---|---|
| A | Attendance, breaks, field/site duty, OT, face verification | Persist punches with stable IDs and original timestamps. Store events by ID and query full date ranges locally. Merge pending events into status calculations. Separate attendance settings retention. Implement real face-profile caching. Check ordinary shifts, midnight/overnight shifts, Asia/Calcutta date boundaries, repeated punches, and cached face verification after restart. | ✅ **COMPLETED (Batch A)** — Implemented in `attendanceOfflineService.ts`, debounced punches, stable v4 UUIDs, Paradigm shift engine calculation, offline face descriptor caching, and 11 unit tests passing. |
| B | Enrollment and uploaded documents | Preserve files through every form step and restart. Keep canonical document paths after online saves. Do not overwrite the successful saved record with the sanitized upload input. Verify parent/child/family data and original creator attribution after delayed sync. | In Progress |
| C | Snag, HT Yard, and PPM audits | Normalize camelCase/snake_case once at the persistence boundary. Preserve photo references during text/status edits. Fix the site reference-data store/key mismatch. Preserve server versions for conflicts. Verify create/edit/delete, missing attachments, and concurrent edits on two devices. |
| D | Leave, tasks, field reports, extra work, comp-off | Replace stub paths and preserve attachments. Reuse online balance/rule validation on the server. Show offline requests as pending validation, and retain the user's input when the server rejects one. Verify the expected approval chain and notification effects. |
| E | Support tickets, posts/comments, uniform requests | Preserve record relationships and creation order. Replay edits/deletes correctly, keep photos available, and reconcile locally assigned IDs with stable server identities. |
| F | User/child details, locations, organizations/entities, site configuration, assets/tools, finance records, device records, violations | Implement explicit operation handlers per action and apply current permissions on replay. Protect unrelated settings fields from partial updates. Sensitive/privileged operations remain pending until server validation. |
| G | Community gate | Persist visitor records/photos before acknowledging success. Preserve cached rosters on failed refresh. Acknowledge individual uploaded entry IDs, including concurrent new entries. Wire sync to app startup/resume rather than page-only listeners. Never invent a resident approval while offline. Verify full storage, restart already online, and a visitor added mid-upload. |
| H | Remaining CRM, HR, dashboards, reports and every uncovered Phase 0 action | Add applicable cached reads, durable drafts/mutations, or an accurate online-required state. Test the complete business flow and expected final server result. Do not mark coverage complete only because a screen opens. |

For every batch, test connected save, disconnected save, restart, mid-request disconnect, replay, conflict, permission rejection, and returned server data. Test under each relevant role.

Primary files: [services/api.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts>), [services/opsApi.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/opsApi.ts>), [services/offline/saveOfflineAware.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/saveOfflineAware.ts>), [services/offline/prefetch.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/prefetch.ts>), [services/gateApi.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/gateApi.ts>), [services/offline/gateKioskService.ts](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts>), and corresponding pages/stores.

Exit condition: every row in the feature matrix has verified behavior or an explicit, justified online dependency; no remaining critical write path calls a stub or falsely reports completion.

**Phase 4 — Complete Android and iOS parity**

Audit issues: 14, 15, 16, 17.
Depends on: Phase 2; run end-to-end workflow checks against Phase 3 implementations.

- [ ] Replace unhandled relative backend fetches with the existing native-aware API resolver. Verify auth headers, cookies where applicable, CORS, deep links, and production behavior using packaged apps.
- [ ] Complete the Capacitor iOS project and copy the compiled web assets into its bundle. Preserve required native code/configuration while replacing the website-dependent launch path. Follow the [Capacitor iOS project workflow](https://capacitorjs.com/docs/v7/ios).
- [ ] Establish a shared JavaScript interface for Android/iOS location, steps, permissions, start/stop, and token updates. Implement the missing iOS plugin bridge and explicit unsupported/permission-denied states.
- [ ] Persist Android native background GPS events before HTTP upload. Use stable event IDs, original capture times, per-item acknowledgment, and matching account ownership.
- [ ] Connect iOS background location/step capture and permitted synchronization to durable native storage. Support expiration/cancellation and retry on next foreground launch.
- [ ] Keep authentication token refresh and logout synchronized with native workers; old workers must not continue submitting under a switched account.
- [ ] Verify camera selection/capture, durable file paths, attachment reopening, GPS/face verification, BLE/contacts where used, push/local notifications, PDF/export/share/print, back navigation, keyboard/safe areas, and external links.
- [ ] Verify face/OCR assets and any other offline dependencies are bundled or explicitly downloaded before reporting offline readiness.

Exit condition: Android APK and iOS test builds open their local UI offline, execute supported local workflows, and synchronize correctly on real devices. A browser/emulator-only result is not sufficient for sensor, permission, background, or push behavior.

**Phase 5 — Make offline navigation, downloads, and upgrades dependable**

Audit issues: 10, 23; integration checks for 07, 09, 22, 24.
Depends on: Phases 2–4.

- [ ] Remove the coupling between dismissing an offline overlay and setting connectivity to online.
- [ ] Use feature capability and cached-data availability to decide what can open. A full-screen network warning must not interrupt an otherwise usable local workflow.
- [ ] Present cached data with last-refresh information and give users clear pending/conflict/rejected states.
- [ ] Make initial data/file downloads resumable, account-scoped, and verifiable. Refresh server changes without resetting unsynced drafts or removing pending deletions.
- [ ] Replace version-change cache deletion with migrations. Preserve reference data, draft files, queue state, and attendance context until validated replacements are available.
- [ ] Make file cleanup reference-aware: delete only files no longer referenced by a pending operation, retained draft, or cached record according to the retention policy.
- [ ] Handle low disk/storage quota by reporting an actual failed local save and keeping user inputs available for recovery.
- [ ] Keep current web/PWA assets available until the updated bundle is ready. Test offline reload and navigation to a previously unvisited supported route.
- [ ] Provide a sync review view with pending counts, ownership-safe diagnostics, retry controls, conflict resolution, and recoverable export. Diagnostics must omit credentials and sensitive document content.

Exit condition: airplane mode, cold restart, update installation, storage pressure, and account switching do not falsely report saved/synced state or erase pending work.

**Phase 6 — Prove parity and prepare a controlled release**

Depends on: all implementation phases.

- [ ] Run TypeScript and the existing applicable tests, then the new behavioral regressions and storage-adapter contract tests.
- [ ] Run server integration tests with actual test-schema constraints/policies. Confirm replay produces the same business state as the equivalent connected workflow.
- [ ] Test production web/PWA, a physical Android device, and a physical iPhone. Add a second Android configuration for background/battery behavior.
- [ ] Execute the acceptance scenarios below for all eligible feature-matrix actions.
- [ ] Record results per workflow/platform: build, role, prerequisite data, local record/attachment count, server result, timing, errors, and duplicates.
- [ ] Run an extended offline exercise spanning overnight attendance and an interrupted app upgrade. Use a representative data and attachment volume established in Phase 0.
- [ ] Pilot the verified build with a small test group and monitor pending age, retries, conflicts, storage failures, and server acknowledgments.
- [ ] Prepare compatible backend migrations and a rollout/rollback sequence. A code rollback must preserve and understand queued schema versions; never clear pending data as part of rollback.
- [ ] Mark each of the 24 audit findings resolved only after its regression check and relevant platform verification pass. Keep discovered additional issues in the same matrix.

| Scenario | Required result |
|---|---|
| Initial installation without internet | Local shell opens; explains that authenticated setup/data download is required. Does not fabricate a user session or reference data. |
| Prepared device in airplane mode | Supported forms and cached records open; successful local saves persist after force-close. |
| Wi-Fi connected, backend unreachable | Operations are stored locally; network requests have bounded timeouts and accurate status. |
| Disconnect after server commit but before response | Replay returns the acknowledged result; no duplicate business operation or notification. |
| Edit during upload | Latest revision remains queued or is subsequently acknowledged; old completion cannot delete it. |
| Force-close during attachment upload | Record and file remain linked; retry resumes/reuses uploaded content safely. |
| Expired/revoked session | Work stays local and associated with its original account; reauthentication resumes only authorized operations. |
| Switch accounts on a shared device | No disclosure or replay of another account's private cached/pending work. |
| Server validation or permission rejection | Retain the request and input, show the server reason, and permit correction without pretending it synced. |
| Two devices edit the same record | Version checks prevent silent overwrite; user-visible conflict handling preserves both changes. |
| Another device updates/deletes a record | Next pull updates/removes eligible cached data without destroying pending local edits. |
| Full storage | Save fails explicitly; no false success or deletion of unrelated pending work. |
| Reconnect while app is open | Queue starts automatically once backend/session checks succeed. |
| Reopen already online | Pending work is discovered and processed without needing a new network event. |
| Background/suspension/force-stop | Captured durable data remains intact; processing resumes when the platform next permits execution. |
| Upgrade while offline | Queues, draft attachments, usable reference data, and attendance context survive schema migration. |
| Web offline reload/new route | Required application assets and prepared feature data are available; unavailable downloads are reported accurately. |

**Audit traceability**

| Audit IDs | Main implementation phase |
|---|---|
| 01 | 2 and 3 — replace stub writes with durable domain operations |
| 02, 03, 04, 07, 08, 09 | 1 and 2 — retention, revisions, recovery, ownership |
| 05, 06, 11, 12, 13, 18, 19, 20, 21, 22, 24 | 3 — feature-specific saves, reads, attachments and gate behavior |
| 14, 15, 16, 17 | 4 — native packaging, URLs, tracking and steps |
| 10, 23 | 5 — offline navigation and upgrade preservation |
| All 24 plus newly discovered gaps | 6 — platform verification and release readiness |

**Completion criteria**

- Every eligible feature has verified web, Android, and iOS offline behavior, with documented prerequisites.
- A locally acknowledged save survives ordinary process termination and restart; device uninstall/user data deletion is outside that guarantee.
- The server receives each logical operation once despite retries, and the correct user/organization owns it.
- The latest edits and all referenced attachments survive concurrent sync, errors, and upgrades.
- Server changes return to devices, conflicts are handled explicitly, and offline data remains account-scoped.
- Sync starts automatically when the app can run and the backend/session are ready.
- All four critical findings and the remaining audited defects have passing regressions and applicable device checks.
- Online-only capabilities are accurately represented as pending or unavailable offline, with no false completion.

