**Offline implementation verification — 19 November 2026**

**Verdict: partially implemented; not 100% complete or ready for offline parity sign-off.**

Scope: [the implementation plan](mobile-offline-implementation-plan.md), confirmed by the user. Reviewed checkout: `8fde232`, initially clean. This review covers all 60 checklist requirements and eight workflow batches below. It does not establish complete coverage of every application action: that inventory is itself missing. Before correction, the plan contained 26 checked and 34 unchecked requirements, while claiming Phase 6 and all 24 original findings were complete. Checkbox counts are not an implementation percentage.

**Executed verification**

| Check | Result | Evidence |
|---|---|---|
| TypeScript | PASS, exit 0 | [typecheck log](../test-results/offline-verification-typecheck-2026-11-19.txt) |
| Existing offline tests, excluding historical tests that assert old bugs | 196 passed, 1 failed; 27 files | [JSON results](../test-results/offline-verification-tests-2026-11-19.json), [console log](../test-results/offline-verification-tests-2026-11-19.txt) |
| New behavioral requirements | 12 failed; each reproduces an unresolved defect | [test source](../test-results/offline-plan-verification-regressions.test.ts), [JSON results](../test-results/offline-verification-regressions-2026-11-19.json), [console log](../test-results/offline-verification-regressions-2026-11-19.txt) |
| Production web/PWA compilation | PASS, exit 0; generated service worker and 406 precache entries | [build log](../test-results/offline-verification-build-2026-11-19.txt) |
| Native builds, physical Android/iPhone, real server policies/side effects | NOT VERIFIED | No device or test-backend acceptance run was performed; checked-in iOS target is incomplete |

The new tests run production save/queue/sync/cache/conflict/migration functions with synthetic, structured-cloning storage and mocked network boundaries. They assert required behavior and intentionally remain failing until repaired. They do not prove real IndexedDB transactions, SQLite durability, native sensors, or server authorization. Existing tests also mostly mock those boundaries. The historical `mobile-offline-audit.test.ts` remains unchanged and is excluded because it asserts the previous broken behavior.

The existing failing test is `attendance-offline-service.test.ts:162`: a Shift A calculation at a supplied reference time returns `A+B`. [attendanceOfflineService.ts](../services/offline/attendanceOfflineService.ts) uses the supplied date to select events but uses `new Date()` to calculate an open shift's duration (line 326). The check therefore depends on the real clock. Local `getHours()` also needs explicit Asia/Calcutta coverage.

**Reproduced blockers**

| ID | Severity | Observed behavior | Source |
|---|---|---|---|
| V01 | Critical | Editing during attachment upload queues revision 2; the upload checkpoint writes its old revision-1 snapshot over it, then synchronization deletes the queue entry. | [syncEngine.ts](../services/offline/syncEngine.ts), lines 775–807 |
| V02 | Critical | Editing during the server write preserves revision 2 in the queue, but cleanup deletes the photo still referenced by that revision. | [syncEngine.ts](../services/offline/syncEngine.ts), lines 989–1003 |
| V03 | Critical | An older online save completes after a newer offline edit; unconditional `removeForRecord` deletes the newer operation and its attachments. | [saveOfflineAware.ts](../services/offline/saveOfflineAware.ts), lines 168–170; [outbox.ts](../services/offline/outbox.ts), line 412 |
| V04 | Critical | Another writer commits between acknowledgment's read and delete; `markSynced` deletes the newer revision. Its comparison is not inside a transaction. | [outbox.ts](../services/offline/outbox.ts), line 321 |
| V05 | High | An operation without proven ownership is uploaded by the next signed-in account. Pending queries explicitly include missing/anonymous/dummy owners. | [outbox.ts](../services/offline/outbox.ts), lines 199–215; [syncEngine.ts](../services/offline/syncEngine.ts), line 1099 |
| V06 | High | Account B can read cached onboarding data belonging to A. The cache is shared, and the API's offline branch omits its online manager filter. | [cache.ts](../services/offline/cache.ts), line 397; [api.ts](../services/api.ts), lines 2094–2100 |
| V07 | High | Migration verification accepts a changed nested payload. `JSON.stringify` with only top-level keys as a replacer drops nested fields before hashing. | [migrationJournal.ts](../services/offline/migrationJournal.ts), line 49 |
| V08 | High | Writing a missing IndexedDB domain store resolves successfully while storing nothing. Gate/patrol stores are not created by the current schema. | [storageRepository.ts](../services/offline/storageRepository.ts), line 55; [db.ts](../services/offline/db.ts), upgrade callback |
| V09 | High | A Supabase roster response containing `{ error, data: null }` overwrites the previously downloaded gate directory with empty arrays. | [gateKioskService.ts](../services/offline/gateKioskService.ts), lines 28–63 |
| V10 | High | Legacy gate replay removes the whole localStorage queue after the RPC, including a new entry added while the request was in flight. New submissions still dual-write this queue as well as the main outbox. | [gateKioskService.ts](../services/offline/gateKioskService.ts), lines 223–277 |
| V11 | Critical | “Use Server” deletes the local draft even when fetching the server version failed. The resolver cannot distinguish fetch failure from an absent server record. | [conflictActions.ts](../services/offline/conflictActions.ts), lines 41–59 and 174–189 |
| V12 | High | The review modal filters its display by account, but “clear all failed” deletes failed records for every account. | [SyncReviewModal.tsx](../components/offline/SyncReviewModal.tsx), line 135; [outbox.ts](../services/offline/outbox.ts), line 592 |

**Additional implementation gaps confirmed by source review**

1. **The repository is not the shared transactional foundation described in Phase 2.** `IOfflineStorageRepository` has separate CRUD methods, but no transaction, scoped record-query, migration, or cursor contract. Native attendance writes a record to SQLite and then queues through the separate IndexedDB outbox. SQLite serialization omits attachments, photo IDs, base versions, prior revisions, schema version, capture time, record ID, and structured errors. The factory catches construction errors, but initialization is asynchronous and happens later. The four repository tests instantiate only the IndexedDB adapter, using an in-memory mock.
2. **Legacy saves can still falsely succeed.** `offlineDb.addToOutbox` catches and suppresses persistence errors. `SAVE_SETTINGS`, `SAVE_ENROLLMENT_RULES`, `UPDATE_ASSETS`, and `UPDATE_TOOLS` pass through as action strings; the engine only distinguishes `DELETE` from generic upsert. Site configurations use organization-based keys online but generic replay uses `id`; some callers return a different temporary ID from the queued record. The adapter also often omits the authenticated owner and a revision. See [api.ts](../services/api.ts), lines 99–135, 4729, 4824, 5994, 6201, 6362, and 10740.
3. **Online/offline domain parity and atomic server protection are incomplete.** Replay does a version SELECT followed by unconditional upsert, leaving a race between two devices; a version-query error is logged and replay proceeds. Online leave handling resolves rules, balances, manager, and notifications; replay does not invoke that code. No shared operation/result transaction or external-side-effect deduplication contract is wired into this engine. Actual deployed constraints/triggers/RLS were not inspected, so server behavior is not certified. See [syncEngine.ts](../services/offline/syncEngine.ts), lines 886–955, and [api.ts](../services/api.ts), line 8188 onward.
4. **Two-way synchronization and readiness remain incomplete.** Prefetch downloads some reference data, and `putServerRecords` protects pending IDs in some cache updates. There is no shared durable download cursor, deletion/tombstone processing, resumable file bootstrap, or per-feature verified readiness contract. These partial caches do not satisfy the specified pull-sync exit condition.
5. **Migration utilities are not a completed migration.** Only the shadow-write flag is consumed by outbox enqueue; no application caller starts and completes the proposed migration protocol. Snapshot photos contain IDs only, hash comparison misses nested changes, and the verifier does not reject extra target rows. Legacy gate/Preferences route data are not migrated by this journal. See [migrationJournal.ts](../services/offline/migrationJournal.ts) and [outbox.ts](../services/offline/outbox.ts), line 182.
6. **Native parity has build and persistence gaps.** No `project.pbxproj`, `Podfile`, or `Package.swift` exists under `ios/`. The Swift launcher remains a plain remote-first WKWebView with an added file fallback, not a complete Capacitor project. iOS CI copies the project after `cap sync`; it never invokes Xcode. iOS step preflight returns success while counting returns zero; native GPS sends HTTP without durable queueing. Android queues after some errors, loses points on auth-paused/missing-token early returns, and drains its SQLite queue without an owner filter. There is also a Java scope error: `body` is declared inside `try` at [TrackingService.java](../android/app/src/main/java/com/paradigm/ifs/TrackingService.java) line 408 and referenced in the separate `catch` at line 472. That is a source-level compile blocker; no Gradle build is claimed here.
7. **Relative API requests remain.** Examples include [hrm.api.ts](../services/hrm.api.ts), lines 131, 172, and 1136; [attendanceDataService.ts](../services/attendanceDataService.ts), lines 184 and 224; and [DetailedAuditReportView.tsx](../components/attendance/DetailedAuditReportView.tsx), line 691. Testing `getApiUrl` alone does not verify these callers.
8. **Navigation and upgrade changes are partial.** Returning home no longer changes connectivity, and the route allowlist is broader. It still uses route prefixes rather than verified cached capabilities. Upgrade cleanup skips only when `navigator.onLine` is false; connected Wi-Fi without a reachable backend still clears app assets, reference caches, and attendance state before validated replacements. See [App.tsx](../App.tsx), lines 2206–2234, and [appUpgradeManager.ts](../services/appUpgradeManager.ts), line 59 onward.
9. **Attachment recovery and diagnostics remain incomplete.** Draft/export helpers exist, but conflict export includes attachment paths without file bytes. Missing blobs are skipped during replay. Quota warnings cannot compensate for swallowed actual write failures. “Zero PII” telemetry also needs review: local conflict telemetry includes the record ID in metadata. These are implementation limits, not device-tested guarantees.

**Every checklist requirement assessed**

IDs below identify requirements in their original order within each phase. “Implemented, unit checked” is narrower than acceptance on every platform. “Unverified” means supporting execution evidence was not found or produced; it does not claim that an external test never happened.

| Requirement | Assessment | Evidence or remaining work |
|---|---|---|
| 0.1 Inventory every route/action | Missing | No complete route/action inventory found. |
| 0.2 Role/platform/workflow feature matrix | Missing | Batch headings and unit files are not the required matrix. |
| 0.3 Classify local/deferred/online-only actions | Partial | Plan states general exceptions; per-action classification absent. |
| 0.4 Record native IDs, origins, versions, preservation baseline | Unverified | Config files exist; no recorded upgrade/data baseline. |
| 0.5 Synthetic fixtures and representative test backend | Partial | Synthetic unit fixtures exist; representative backend run absent. |
| 0.6 Mac/Xcode/iPhone and Android tooling/device setup | Unverified | No physical-device or Mac execution established. |
| 0.7 Minimal compilable Capacitor iOS shell | Incomplete | Required native project files absent. |
| 0.8 Keep baseline and convert all reproductions to regressions | Partial | Historical evidence retained; current suite has one failure and new regressions expose gaps. |
| 1.1 Stop automatic failed-work deletion | Implemented, unit checked | `pruneStaleFailedItems` is non-destructive; existing retention regression passes. |
| 1.2 Atomic revision/status/checkpoint acknowledgment | Fails | V01–V04. |
| 1.3 Exact current revision vs older revision | Partial | Existing older-revision regression passes; global acknowledgment races remain. |
| 1.4 Expiring leases/restart recovery | Implemented, unit checked | Existing recovery regression passes; device interruption unverified. |
| 1.5 Resume auth-paused work for matching validated account | Partial | Anonymous work may be reassigned; startup uses locally read identity. |
| 1.6 Scope manual sync, reads, pending counts | Fails | V05, V06, V12. Known-owner drain isolation alone passes. |
| 1.7 Failures/conflicts never appear completed or block unrelated work | Partial | Queue error states exist; V11 loses conflicts; discarded entries emit `synced`. |
| 2.1 Transactional scoped storage contract | Incomplete | CRUD-only contract omits required operations. |
| 2.2 Both adapters pass same contract/native writer locking | Incomplete | Only mocked IndexedDB tested; split SQLite/IDB writes; V08. |
| 2.3 Complete durable operation fields | Incomplete | No separate operation identity; SQLite drops replay metadata. |
| 2.4 Map all legacy adapter calls/actions | Incomplete | Generic adapter suppresses errors and lacks explicit business action mappings. |
| 2.5 Shared online/offline domain operations | Incomplete | Online callbacks and direct replay follow different code paths. |
| 2.6 Stable IDs and parent/child dependencies | Partial | UUID helper and sorting exist; legacy temporary IDs and failed-parent retry coverage incomplete. |
| 2.7 Authorized, validated, versioned, idempotent server transaction | Incomplete | SELECT and upsert separate; no mutation transaction wired. |
| 2.8 Idempotent notifications/external side effects | Unverified/incomplete | Replay parity and deduplication not demonstrated. |
| 2.9 Connectivity/reachability/auth, timeout/backoff/error distinction | Partial | Reachability probe and backoff exist; not all domain requests bounded or auth-gated. |
| 2.10 Session/startup/reconnect/resume/periodic triggers, no overlap | Partial | Startup, network, visibility/focus, interval, WebLock present; native/session recovery not fully established. |
| 2.11 Scoped downloads, durable cursors, deletions, pending protection | Incomplete | Some cache protection exists; shared cursor/tombstone pull absent. |
| 2.12 Bootstrap files/data with per-feature readiness | Incomplete | Limited prefetch; no verified resumable feature readiness. |
| 2.13 Journaled migration with identity/ownership/hash checks | Fails/incomplete | V07; journal utilities not a wired migration. |
| 2.14 Preserve unmapped records for review | Fails | V05 automatically replays unmapped ownership. |
| 2.15 Read compatibility, single replay owner, upgrade cutover | Incomplete | Gate dual replay remains; no device cutover evidence. |
| 3A.1 Multi-field conflict comparison | Implemented, unit checked | Comparison tests pass. |
| 3A.2 Keep Mine / Use Server / Export Draft | Partial, unsafe | V11; export omits file bytes; server version transaction absent. |
| 3A.3 Side-by-side conflict modal | Implemented; UI unverified | Component exists; browser/device interaction not executed. |
| 3A.4 Live sync review modal | Implemented; unsafe bulk action | Event subscription exists; V12. |
| 3A.5 Badge in mobile/desktop headers | Implemented; UI unverified | Both header placements found; component behavior not device-tested. |
| 4.1 All backend URLs/native auth/CORS/deep links | Incomplete | Relative fetches remain; packaged behavior unverified. |
| 4.2 Complete Capacitor iOS project/bundled assets | Incomplete | No buildable project configuration. |
| 4.3 Shared native location/steps/permissions interface | Partial | iOS message handling added, but steps still return zero. |
| 4.4 Android GPS persisted before HTTP, stable IDs, account ownership | Incomplete | Error-only persistence, early returns, no scoped drain; Java scope error. |
| 4.5 iOS durable background location/steps/sync recovery | Incomplete | GPS HTTP path has no durable queue; device execution absent. |
| 4.6 Native token refresh/logout/account switching | Partial | JS/Swift message hooks exist; iOS handler writes preferences without updating live service fields; queued owner isolation incomplete. |
| 4.7 Camera/files/GPS/face/BLE/push/export/share/navigation/keyboard | Unverified | Mock helpers cannot establish physical-device parity. |
| 4.8 Offline OCR/face/dependency assets ready before use | Partial/unverified | Bundled assets exist; required download/readiness and device checks absent. |
| 5.1 Dismissal does not set online | Implemented, source checked | `onReturnHome` only navigates. |
| 5.2 Capability/data-based offline navigation | Partial | Broad path allowlist, no per-feature data readiness. |
| 5.3 Cache age and accurate pending/conflict/rejected states | Partial | Sync UI exists; legacy cache metadata fabricates current timestamps. |
| 5.4 Resumable scoped/verifiable bootstrap and refresh | Incomplete | No shared cursor/download implementation. |
| 5.5 Upgrade migrations preserve data until replacements validated | Incomplete | `navigator.onLine` gates destructive cache cleanup. |
| 5.6 Reference-aware file cleanup | Fails | V02; other cleanup removes files without transaction/reference proof. |
| 5.7 Storage failure and retained inputs | Partial | Quota helper exists; V08 and legacy swallowed errors still report success. |
| 5.8 Retain old PWA until new ready; offline unseen route | Unverified/incomplete | Bundle compiles; startup cache deletion and route exercise remain. |
| 5.9 Account-safe review/retry/conflict/export/diagnostics | Partial | V06, V11, V12; attachment export not recoverable from JSON alone. |
| 6.1 Typecheck/tests/regressions/both-adapter contracts | Fails overall | Typecheck/build pass; 1 existing and 12 new failures; native contract unverified. |
| 6.2 Real test-schema integration and domain parity | Unverified | No actual constraints/policy/side-effect test run. |
| 6.3 Production PWA and physical Android/iPhone | Unverified | Web compilation only; native target gaps. |
| 6.4 Acceptance scenarios for every matrix action | Unverified | No complete feature matrix or scenario evidence. |
| 6.5 Results per workflow/platform/build/role/counts/duplicates | Missing | No such execution ledger found. |
| 6.6 Extended offline/overnight/interrupted-upgrade exercise | Unverified | No device exercise or representative-volume evidence. |
| 6.7 Sync health dashboard and anonymous telemetry | Implemented, unit checked; privacy partial | Routes, buffer, tests exist; local metadata contains record IDs. |
| 6.8 Close all 24 original findings after regression/device checks | Not complete | Traceability below; several original defects remain. |

**All Phase 3 workflow batches**

| Batch | Assessment |
|---|---|
| A: Attendance, breaks, duty, OT, face | Partial. ID/time-preserving punch queue, date-range reader and descriptor cache exist. One shift test fails; record and outbox are separate writes; real overnight/timezone/face restart acceptance is unverified. |
| B: Enrollment/documents | Partial. Draft persistence helpers and canonical online cache fix exist. V01–V04/V06 still affect document durability and isolation; family/creator behavior needs real schema and delayed-sync tests. |
| C: Snag/HT Yard/PPM | Partial. Field normalization, ordinary attachment coalescing, organizations store and cache-key fallback exist. Concurrent attachments fail; server version checks are non-atomic; full delete/rejection/two-device acceptance absent. |
| D: Leave/tasks/field reports/extra work/comp-off | Partial. Queue/normalization paths exist. Replay does not run online leave balance/manager/notification logic; complete attachment/approval/server rejection coverage absent. |
| E: Tickets/posts/comments/uniforms | Partial. Stable IDs and selected dependencies exist. Generic replay, account ownership, edits/deletes, photo restart and side-effect parity remain unverified. |
| F: Users/children/sites/assets/tools/finance/devices/violations | Incomplete. Generic actions do not fulfill explicit domain handlers; site configuration key/payload mappings and authenticated ownership need repair. |
| G: Community gate | Partial, failing. Main outbox persistence improves new entries, but V09/V10 remain and the legacy queue is still written and replayed. Server approval effects and photos need integration checks. |
| H: Remaining CRM/HR/dashboard/report actions | Unverified. No exhaustive action inventory; relative native API requests remain; opening pages is insufficient evidence. |

**Traceability to the original 24 findings**

| Original ID | Current assessment |
|---|---|
| 01 Legacy write stub | Partial: adapter now exists, but swallowed storage errors and incomplete action/ownership mapping remain. |
| 02 Automatic failed-work deletion | Fixed in reviewed code and existing unit regression; device verification still absent. |
| 03 In-flight newest edit loss | Still fails: V01–V04. |
| 04 Older revision falsely acknowledged | Specific existing regression passes; atomic server/version protections incomplete. |
| 05 Snag field stripping | Normalization and regression pass; complete backend path unverified. |
| 06 Attachment preservation | Ordinary coalescing passes; V02 proves concurrent cleanup still loses files. |
| 07 Interrupted/auth-paused recovery | Lease recovery and explicit resume tests pass; complete session/native recovery remains partial. |
| 08 Cross-account manual sync | Known-owner regression passes; unmapped replay and UI deletion remain V05/V12. |
| 09 Cross-account cache isolation | Still fails: V06 and API offline manager-filter gap. |
| 10 Offline navigation | Improved: return-home no longer falsifies connectivity; capability/readiness checks incomplete. |
| 11 Face cache stubs | Real descriptor/gate-user cache exists; model/device restart verification absent. |
| 12 Attendance cache/date retention | New ID/range reader exists; old cache retention can still prune attendance settings; shift/reference-time test fails. |
| 13 All-employee cached attendance | Metadata getter now returns data; timestamp/staleness values are fabricated. |
| 14 Native relative API URLs | Still present at multiple callers. |
| 15 iOS project/offline launch | Incomplete project; remote-first WKWebView fallback alone does not establish Capacitor parity. |
| 16 iOS steps/background wiring | Partial bridge added; JS steps remain zero and native durability incomplete. |
| 17 Android background GPS loss | Partial buffer added; persist-before-send/ownership missing; Java scope error. |
| 18 Gate roster overwrite | Still fails: V09. |
| 19 Gate concurrent queue deletion | Still fails for the retained legacy queue: V10. |
| 20 Gate false local success | New entry awaits authoritative IDB enqueue; native/restart/full-storage end-to-end evidence absent. |
| 21 Gate startup auto-sync | Main outbox now handles new entries at app level; legacy queue remains separately replayed. |
| 22 Site cache store/key mismatch | Store and matching fallback keys exist; relevant tests pass. |
| 23 Upgrade cache destruction | Partial offline guard only; connected-but-unreachable cleanup still violates retention requirement. |
| 24 Enrollment canonical paths overwritten | Online-only canonical cache retained by code; broader attachment/restart tests remain necessary. |

**Reproduction commands**

Run from the repository root with installed dependencies. `npm.cmd` avoids PowerShell's disabled script policy. The test configuration disables production env-file loading.

```powershell
npm.cmd run typecheck
node node_modules/vitest/vitest.mjs run --config test-results/offline-verification.config.mjs --exclude test-results/offline-plan-verification-regressions.test.ts
node node_modules/vitest/vitest.mjs run test-results/offline-plan-verification-regressions.test.ts --config test-results/offline-verification.config.mjs
node node_modules/vite/bin/vite.js build --outDir node_modules/.cache/offline-verification-build-rerun
```

The recorded build was created under `test-results/offline-verification-build` and then moved to `node_modules/.cache/offline-verification-build-2026-11-19` to keep generated assets out of the review diff. No application source, native identifiers, versions, backend data, or deployment was changed by this verification.

**Work required before completion can be claimed**

Repair V01–V12 and the attendance regression; preserve authoritative owner/revision/file identity through one transactional repository; finish explicit domain replay and server version/idempotency handling; implement verified pull sync and migration; complete and compile native targets; then execute and record the plan's feature/platform acceptance matrix against a test backend and real devices. Passing compilation and helper tests alone cannot close those requirements.
