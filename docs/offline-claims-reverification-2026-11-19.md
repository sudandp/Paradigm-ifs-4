**Offline fix claims — independent re-verification, 19 November 2026**

Reviewed commit: `d3ddfd2`. Verdict: substantial progress, but the supplied blanket PASSED status is not justified. All 209 previously available checks pass, including the original 12 regressions and attendance test. Seven additional boundary checks fail. TypeScript passes. No application source was changed during this review.

Evidence: [209-test results](../test-results/offline-reverification-results.json), [test console](../test-results/offline-reverification-tests.txt), [TypeScript log](../test-results/offline-reverification-typecheck.txt), [new boundary tests](../test-results/offline-claims-boundaries.test.ts), [boundary results](../test-results/offline-claims-boundaries-results.json).

These are production-function tests with synthetic storage/network boundaries. They establish the reproduced defects, not real-device acceptance. Native builds, SQLite integration, backend constraints and physical-device execution were not performed. Existing logs and reports are preserved as historical evidence.

**Assessment of every supplied claim**

| Item | Assessment | Evidence and limit |
|---|---|---|
| V01 | Partial; not atomic or replacement-safe | Original regression passes. Checkpoint still uses separate `db.get`/`db.put`. It matches an attachment by photo ID **or payload path**, so old content marks replacement bytes uploaded (RV06). |
| V02 | Partial | Original photo-retention regression passes. `isPhotoReferenced` scans only outbox records, not retained drafts/domain caches; reference check and deletion are separate operations. It is a reference scan, not transactional reference counting. |
| V03 | Partial | Revision argument is now supplied and the original regression passes. `removeForRecord` still reads, awaits photo checks/deletions, then deletes the queue without a transaction. Another edit can land in between. |
| V04 | Fails atomicity requirement | A second read was added; there is no atomic compare-and-swap. RV01 inserts the newer revision after the final read and it is deleted. |
| V05 | Partial | Explicit-user pending query is stricter and original regression passes. `resumeAuthPausedItems` still assigns anonymous/unowned paused work to the supplied user (RV04). No-user pending queries remain unscoped. |
| V06 | Fails real cached-record shape | Original snake_case fixture passes. Production caches use camelCase records too; `!s.user_id` allows every such record, including another user's record (RV02). Missing active identity also returns all rows. |
| V07 | Verified for stated nested-hash defect | Recursive sorted serialization is present and original regression passes. This does not establish complete migration: extra target rows, binary verification and migration integration remain separate requirements. |
| V08 | Verified for missing-store error | `putRecord` throws and original regression passes. This is an ordinary `Error`, not a dedicated storage error type, and does not implement missing stores or prove quota/restart handling. |
| V09 | Partial | Original roster-error regression passes. Error guard checks units, residents and helpers but omits `checkpointsRes.error`; a failed checkpoint fetch can still replace cached checkpoints with an empty list. |
| V10 | Verified for original in-flight append scenario; partial overall | Original regression passes because removal filters sent IDs. Legacy dual-writing/replay remains; localStorage read-modify-write is not serialized across tabs, and the code treats the entire submitted list as acknowledged on RPC success. |
| V11 | Verified for stated fetch-failure defect | Fetch failures now throw; original regression proves the local draft survives. Concurrent edits during user resolution still require revision-safe transactions. |
| V12 | Fails when authentication is absent | Original signed-in fixture passes. `clearAllFailed` calls `getFailed(undefined)` when identity is missing, then deletes all accounts' failed records (RV03). |
| V13 | Verified for original reference-clock regression; timezone coverage partial | All 11 attendance tests pass. Shift hour extraction uses Asia/Kolkata and open duration uses `referenceDate`. Query date boundaries still use device-local `setDate`/`setHours`, so full timezone invariance is not established. |
| V14 | Verified for removal of conflict record ID | Conflict metadata now contains only the table name. This supports the narrow removal claim, not a blanket certification that all diagnostics contain zero personal data. |
| G01 | Verified in the three named files; incomplete application-wide | Relative fetch search finds none in those named files. A native-relative request remains in `services/api.ts:11982`. Packaged authentication/CORS behavior was not executed. |
| G02 | Fails transaction claim; serialization partial | IndexedDB `runTransaction` merely invokes `fn()` (RV05). SQLite adds columns and BEGIN/COMMIT calls, but no adapter transaction tests exist and existing version-1 databases receive no ALTER/version migration. `lastError` still is not serialized. |
| G06 | Probe implemented; upgrade guarantee remains partial | `isReachable(3000)` gates cleanup. A successful probe still precedes deletion of caches/attendance context without verified replacement data. The probe also accepts responses below HTTP 500, so it is not proof of usable authenticated reference-data downloads. |
| G07 | Source scope defect corrected; build unverified | `body` is now declared outside the try and null-checked in catch. This confirms the specific source fix, not successful Android compilation or GPS durability. |
| G09 | Document exists; completeness and platform sign-off unsupported | Matrix has 33 broad route/action rows against 233 route-declaration lines in App.tsx (including wrappers). It omits substantial CRM/HR/configuration actions, lacks per-action execution artifacts and contains inaccurate mappings. It cannot establish complete platform coverage. |

**New reproducible failures**

| Check | Result | Production evidence |
|---|---|---|
| RV01 | New edit arriving after the second/final acknowledgment read is deleted. | [outbox.ts](../services/offline/outbox.ts), `markSynced`, line 344 |
| RV02 | Account B receives A's camelCase onboarding cache record. | [cache.ts](../services/offline/cache.ts), `getCachedOnboardingSubmissions`, line 418 |
| RV03 | Without local authentication identity, bulk failed cleanup deletes account A's record. | [outbox.ts](../services/offline/outbox.ts), `clearAllFailed`, line 627 |
| RV04 | Auth recovery changes an anonymous paused operation's owner to B and makes it eligible for B's drain. | [outbox.ts](../services/offline/outbox.ts), `resumeAuthPausedItems`, line 410 |
| RV05 | A failed transaction callback leaves its earlier domain write committed. | [storageRepository.ts](../services/offline/storageRepository.ts), `runTransaction`, line 136 |
| RV06 | Replacing a photo during upload gives the replacement the old photo's uploaded URL, so a later retry may skip uploading its new bytes. | [syncEngine.ts](../services/offline/syncEngine.ts), checkpoint merge, line 799 |
| RV07 | Revision 2 stays queued, but completion of revision 1 overwrites the cached domain record with revision 1. | [syncEngine.ts](../services/offline/syncEngine.ts), unconditional `updateLocalCacheAfterSync`, after line 1010 |

RV05 uses the same synthetic boundary style as the existing tests; it exposes that the repository does not start any transaction. A real IndexedDB rollback/restart suite is still required for eventual acceptance.

**Why G02 and G09 cannot be marked complete**

The IndexedDB transaction method ignores both mode and stores, and its callback's CRUD calls open independent transactions. Adding BEGIN/COMMIT strings on SQLite does not prove transaction ownership, plugin compatibility, rollback, isolation, or concurrent writer safety. Existing `storage-repository.test.ts` exercises only the IndexedDB class. SQLite keeps database version 1 and uses `CREATE TABLE IF NOT EXISTS` with new column definitions; an already-created table will retain the old columns and the new INSERT can fail. A versioned migration and real native tests are necessary.

The acceptance matrix names IDB `face_descriptors`, `leave_balances` and `holidays`, and uses `field_tasks` for task replay; these claims do not match the reviewed schema/queue paths (`face_profiles`, `tasks`, among others). `/attendance/punch` and `/attendance/face` appear in the offline allowlist but have no matching route declaration in App.tsx. Existing tests passing cannot prove every role/platform cell marked “Full.” No linked execution evidence supports the document's certification, 100% platform parity or production sign-off assertions. The iOS folder still lacks a project.pbxproj, Podfile or Package.swift.

**Next repair gate**

Implement genuine transactional read/compare/write and record-cache updates, identify attachment versions by immutable content identity, fail closed when account scope is absent, preserve unmapped work during authentication recovery, and apply cache scope to the actual stored record format. Then run all existing and new checks together and add real storage contract/native migration tests. Keep G09 platform cells unverified until execution evidence is attached.

Reproduce from the repository root:

```powershell
npm.cmd run typecheck
node node_modules/vitest/vitest.mjs run --config test-results/offline-verification.config.mjs --exclude test-results/offline-claims-boundaries.test.ts
node node_modules/vitest/vitest.mjs run test-results/offline-claims-boundaries.test.ts --config test-results/offline-verification.config.mjs
```

The first test command covers the 209-check baseline. The second covers the seven new failures; the unfiltered configuration now discovers both sets. No claim of a newly executed production web or native build is made in this re-verification.
