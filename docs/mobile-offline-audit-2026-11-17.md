**Mobile and offline audit — Paradigm Office 4**

Reviewed on 17 November 2026. This is a review of the current workspace, including its pre-existing version/build edits.

**Result: the project does not yet meet “all web features work on Android/iOS offline and sync reliably later.”** I identified **24 defects or implementation gaps: 4 critical, 14 high, and 6 medium**. Twelve focused reproductions demonstrated the current incorrect behavior in isolation. This is not a claim that every screen has been exercised on physical devices.

**How the project currently works**

The application is a React 19/Vite frontend with shared pages, Zustand state, React Query, and a Supabase backend. Android packages the frontend with Capacitor 7 and custom Java plugins. The checked-in iOS launcher follows a different, incomplete path described in issues 15–16.

Offline storage is split across several mechanisms: IndexedDB for enrollment/snags/HT/PPM and attachments, localStorage for legacy caches and gate visitors, and Capacitor Preferences for authentication and foreground route history. A separate legacy OfflineSyncEngine exists, but the legacy API writes do not call it: they call an empty stub. Installing the SQLite dependency has not connected these application paths to SQLite.

The intended invariants are that a reported local save is durable, every mutation retains its owner and permanent identity, acknowledgment removes only the acknowledged revision, failed uploads retain their only local copy, and reconnect/restart recovers pending work without manual intervention. The findings below identify violations of these invariants.

**Validation and limits**

- TypeScript check: completed successfully with no diagnostics.
- Existing offline tests: **74 passed across 10 files**. These test selected helpers; they do not establish app/device parity.
- New isolated audit reproductions: **12 passed**, meaning **12 defect scenarios were reproduced**, not that the product is fixed. They use synthetic accounts, mocked server responses, and structured-cloned database values, without real backend writes.
- No Android APK/iOS build or physical-device run was performed. Actual deployed database policies, push delivery, permissions, OEM background restrictions, and iOS signing/build configuration remain unverified.
- Application code, backend data, and existing user edits were not changed. Only this report and audit artifacts were added.

Reproduction source: [test-results/mobile-offline-audit.test.ts](<E:/backup/onboarding all files/Paradigm Office 4/test-results/mobile-offline-audit.test.ts>). Results: [test-results/mobile-offline-audit-reproductions-2026-11-17.json](<E:/backup/onboarding all files/Paradigm Office 4/test-results/mobile-offline-audit-reproductions-2026-11-17.json>). Existing-test log: [test-results/mobile-offline-existing-tests-2026-11-17.txt](<E:/backup/onboarding all files/Paradigm Office 4/test-results/mobile-offline-existing-tests-2026-11-17.txt>).

Run the isolated reproductions with:

```powershell
node node_modules/vitest/vitest.mjs run --config test-results/mobile-offline-audit.config.mjs
```

**Feature coverage from the code trace**

| Feature | Current local/offline behavior | Main issues |
|---|---|---|
| Login/session restoration | Cached identity and Preferences exist; first-time authentication needs the server | Shared-account cache separation needs correction; actual device restart validation outstanding |
| Attendance, breaks, site duty and OT punches | Display caching exists, but offline mutations go to an empty queue function | 01, 11–13 |
| Leave requests and tasks | Offline branches return optimistic records without an actual replay queue | 01 |
| Enrollment and documents | Real IndexedDB queue/attachment storage exists | 02–04, 06–10, 24 |
| Snag audits | Real queue exists, but field normalization breaks saves | 02–10, 22 |
| HT Yard and PPM audits | Real IndexedDB queue exists | 02–04, 06–09, 23 |
| Support tickets, posts/comments, uniforms, field reports, claims | Several local cache paths exist, but writes call the stub | 01 |
| Site assets/tools, configuration, finance records, child details | Offline write branches call the stub | 01 |
| Face attendance/profile | Face models are local-capable; profile cache is a stub | 11 |
| Community gate | Separate localStorage queue and directory cache | 10, 18–21 |
| Field GPS and steps | JS foreground route persistence exists; native implementation differs by platform | 16–17 |
| CRM/HR/VoIP/server reports and biometric administration | Some requests bypass the native backend URL resolver; broad offline mutation coverage is absent | 14; further feature/device tests required |
| iOS packaging/native features | Swift launcher loads the website; complete native project/integration absent from this checkout | 15–16 |
| Camera, GPS permission prompts, BLE, contacts, push, PDF/share/print, deep links and keyboard | Source integrations are present in parts of the app | Physical-device acceptance testing still required; not certified by this audit |

**Detailed bug list**

**01. Critical — Most legacy offline writes never enter a sync queue**

`offlineDb.addToOutbox` is an empty async function. There are 34 calls to it in `services/api.ts`. Several callers then update a local display cache and return success, but no pending operation exists for either sync engine. Reconnecting therefore cannot upload that work. This affects attendance, leave, tasks, field reports, support tickets/comments, uniforms, settings, assets/tools, and other operations listed below.

Reproduce: Go offline, create a punch/leave/task, then reconnect. The UI may show the local record, but the server has no corresponding queued mutation.

Correction: Replace the stub with durable, user-scoped operations and replay handlers for each payload/action. Preserve stable IDs and attachments; migrating the existing display caches needs an explicit recovery strategy.

Evidence: Isolated reproduction passed: addToOutbox resolves without writing anything. Code: [services/api.ts:100](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:100>); [services/api.ts:5302](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:5302>); [services/api.ts:8103](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:8103>); [services/api.ts:8615](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:8615>).

**02. Critical — Failed sync records and their only photos are automatically deleted**

Every startup/drain can prune failed items older than 24 hours, or selected errors after three attempts. Pruning calls discardFailedItem, deleting the outbox item, attachments, and local domain record even though the server never accepted it. Age is measured from creation, so an old draft can be removed soon after its first permanent failure.

Reproduce: Queue an audit with a photo, encounter a permission/schema error, and reopen/sync after the record is over 24 hours old.

Correction: Retain unsynced records until successful confirmation or an explicit discard/export decision. Cleanup must never infer that a failed record is disposable.

Evidence: Isolated reproduction passed: record, photo, and cache were all deleted. Code: [services/offline/outbox.ts:469](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts:469>); [services/offline/outbox.ts:424](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts:424>); [services/offline/syncEngine.ts:589](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:589>); [services/offline/syncEngine.ts:774](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:774>).

**03. Critical — An older sync request can delete a newer local edit**

The outbox uses the record ID as its only key. Editing while an earlier revision uploads replaces the queued row. When the old request finishes, markSynced deletes by ID without checking which revision completed. Attachment checkpoints can also write an old item over a newer one.

Reproduce: Queue revision A, reconnect on a slow network, and edit the same record to revision B before A finishes. A reaches the server and B disappears from the queue.

Correction: Use atomic revision comparisons for checkpoint, success, and failure updates; remove only the exact revision that was acknowledged.

Evidence: Isolated reproduction passed using structured-cloned database values and an edit inserted during the server request. Code: [services/offline/outbox.ts:81](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts:81>); [services/offline/outbox.ts:270](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts:270>); [services/offline/syncEngine.ts:360](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:360>); [services/offline/syncEngine.ts:520](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:520>).

**04. Critical — Matching an older server revision falsely marks the latest edit as synced**

The conflict handler treats any token in priorRevisions as proof that the current payload is already on the server. A prior revision only proves an older edit was saved. The handler removes the newer queued edit without submitting it, then caches the unsaved content as if it were synchronized.

Reproduce: An older save commits but its response is lost. Make another edit locally, then sync with the older revision still on the server.

Correction: Only an exact match to the current payload's revision can acknowledge completion. For a prior revision, retain and apply the newer edit against the acknowledged server version.

Evidence: Isolated reproduction passed: no write occurred, server retained old content, queue was removed. Code: [services/offline/outbox.ts:94](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts:94>); [services/offline/syncEngine.ts:445](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:445>).

**05. High — Snag saves strip site, description, action, and photo fields**

saveSnagEntry passes camelCase properties such as nameOfSite and snagDescription. stripLocalFields only accepts snake_case columns, so those properties are removed before the online callback or offline queue sees them. The schema makes site, description, and action mandatory; new saves can fail, while updates can omit the user's changes. This affects web and mobile, both online and offline.

Reproduce: Create a snag with a site, description, and action. Inspect the clean payload immediately before persistence.

Correction: Normalize names before applying the database allowlist, and use one defined representation throughout the save/cache path.

Evidence: Isolated reproduction passed: a populated snag became only its id and status. Code: [services/opsApi.ts:754](<E:/backup/onboarding all files/Paradigm Office 4/services/opsApi.ts:754>); [services/opsApi.ts:784](<E:/backup/onboarding all files/Paradigm Office 4/services/opsApi.ts:784>); [services/offline/saveOfflineAware.ts:146](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/saveOfflineAware.ts:146>); [services/offline/syncEngine.ts:216](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:216>); [supabase/migrations/20260706_create_snag_audits.sql:10](<E:/backup/onboarding all files/Paradigm Office 4/supabase/migrations/20260706_create_snag_audits.sql:10>).

**06. High — Editing an offline record can disconnect its queued attachments**

Coalescing replaces attachments with the new call's attachments value. A status/text-only edit supplies no attachment list, so the existing photo references disappear even when the blobs remain in storage. updateSnagStatus is a concrete caller that does this. The next sync has no instruction to upload the existing photos.

Reproduce: Save an offline snag with a photo, then change its status without selecting a new photo before reconnecting.

Correction: Merge attachment changes by payload path; preserve unchanged attachments and distinguish explicit deletion from omission.

Evidence: Isolated reproduction passed: the photo remained stored but was no longer referenced by the queued record. Code: [services/offline/outbox.ts:108](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts:108>); [services/offline/outbox.ts:128](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts:128>); [services/opsApi.ts:891](<E:/backup/onboarding all files/Paradigm Office 4/services/opsApi.ts:891>).

**07. High — Interrupted and authentication-paused uploads are not recovered automatically**

Automatic startup, reconnect, focus, and timer drains select pending items. Resetting syncing/auth_paused items only happens in the manual drain branch. A force-close during upload or token-refresh failure can leave work stuck even after the app restarts with a valid connection/session. Some other UI paths invoke manual drain, but the automatic engine itself does not guarantee recovery.

Reproduce: Leave a queue item in syncing or auth_paused, reopen already online, and wait for automatic sync.

Correction: Recover stale in-flight leases on startup and resume auth-paused items after session validation, scoped to their owner.

Evidence: Isolated reproduction passed: automatic drain attempted neither item. Code: [services/offline/outbox.ts:152](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/outbox.ts:152>); [services/offline/syncEngine.ts:591](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:591>); [services/offline/syncEngine.ts:780](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:780>); [services/offline/syncEngine.ts:806](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:806>).

**08. High — Manual sync falls back to another user's queued work**

If the active user's pending queue is empty, manual drain fetches every pending item on the device. It then sends them with the current session. On a shared device, user A's work can be submitted under B's credentials or rejected by row-level security. Actual acceptance depends on the deployed policies; the cross-user submission attempt is confirmed.

Reproduce: Queue work as A, switch to B with no pending work, and trigger sync.

Correction: Never fall back to all users. Bind every mutation to its captured owner and require the matching authenticated session.

Evidence: Isolated reproduction passed: A's item was sent using B's mocked session. Code: [services/offline/syncEngine.ts:593](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:593>); [services/offline/syncEngine.ts:609](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:609>); [services/offline/syncEngine.ts:637](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/syncEngine.ts:637>).

**09. High — Local read caches and pending lists are not isolated by user**

The domain stores are shared across accounts. Offline onboarding reads return all cached submissions, and the pending merge reads the whole outbox without a user filter. Snag reads also merge all queued snags. Logout clears identity/form state but does not partition these database records. A later permitted user of the same device can see earlier users' cached work outside the current server query's access checks.

Reproduce: Use an account with broader access, sign out, sign in with another account, then view offline audits/submissions.

Correction: Partition cache and queues by account/organization, enforce current offline visibility rules, and keep another user's pending data inaccessible without deleting it.

Evidence: Confirmed by caller-to-storage code trace; deployed account/permission combinations need device validation. Code: [services/offline/cache.ts:397](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/cache.ts:397>); [services/api.ts:2012](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:2012>); [services/api.ts:2046](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:2046>); [services/opsApi.ts:680](<E:/backup/onboarding all files/Paradigm Office 4/services/opsApi.ts:680>); [App.tsx:1764](<E:/backup/onboarding all files/Paradigm Office 4/App.tsx:1764>).

**10. Medium — Offline navigation interrupts supported screens and 'Work Offline' marks the app online**

The allowlist excludes /onboarding, /gate, /community-gate, and other routes. These receive a full-screen offline overlay. The overlay is dismissible, so they are not permanently blocked, but the Work Offline/Continue Offline buttons call setIsOffline(false) while the device is still disconnected. The forceBlock prop is unused. Different components consequently receive inconsistent connection state, and subsequent checks can show the overlay again.

Reproduce: Open an enrollment step in airplane mode and select Work Offline. Compare the auth-store offline flag with the actual network state.

Correction: Separate overlay dismissal from connectivity. Allow locally supported routes and derive all connection indicators from a consistent source.

Evidence: Confirmed by code trace; this corrects the initial impression that these routes were permanently blocked. Code: [App.tsx:2168](<E:/backup/onboarding all files/Paradigm Office 4/App.tsx:2168>); [App.tsx:2197](<E:/backup/onboarding all files/Paradigm Office 4/App.tsx:2197>); [components/ui/OfflineScreen.tsx:401](<E:/backup/onboarding all files/Paradigm Office 4/components/ui/OfflineScreen.tsx:401>); [components/ui/OfflineScreen.tsx:535](<E:/backup/onboarding all files/Paradigm Office 4/components/ui/OfflineScreen.tsx:535>).

**11. High — Offline face verification has no working face-profile cache**

gateApi declares its own offlineDb with a getCache that always returns null and a setCache that does nothing. Even a previously enrolled person's face profile is therefore unavailable offline. PersonalFaceAuth interprets the missing profile as first-time enrollment and switches to registration.

Reproduce: Load an enrolled user's face profile online, disconnect, close/reopen the face screen, and try verification.

Correction: Persist and retrieve the face profile through the real protected local store, with explicit unavailable/unenrolled states.

Evidence: Confirmed by complete cache-to-screen code trace. Code: [services/gateApi.ts:8](<E:/backup/onboarding all files/Paradigm Office 4/services/gateApi.ts:8>); [services/gateApi.ts:130](<E:/backup/onboarding all files/Paradigm Office 4/services/gateApi.ts:130>); [services/gateApi.ts:189](<E:/backup/onboarding all files/Paradigm Office 4/services/gateApi.ts:189>); [components/attendance/PersonalFaceAuth.tsx:201](<E:/backup/onboarding all files/Paradigm Office 4/components/attendance/PersonalFaceAuth.tsx:201>).

**12. High — Attendance cache keys do not match offline punches or requested periods**

Attendance reads cache by only the requested start date, omitting the end date. Offline punches append to today's UTC key. Status restoration asks for a 48-hour lookback, whose start key differs, so it need not see the punch just saved. Daily and monthly ranges can also overwrite each other if they share a start date. The two-key pruning rule further mixes attendance settings and event caches under the same prefix.

Reproduce: Punch offline, then refresh attendance status or restart. Also fetch two date ranges with the same start and different end dates before disconnecting.

Correction: Keep an event store keyed by permanent event IDs and query timestamps locally; separate settings from event retention and merge pending events into reads.

Evidence: Confirmed by save/read call trace; separate from the missing queue in issue 01. Code: [services/api.ts:5154](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:5154>); [services/api.ts:5307](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:5307>); [services/api.ts:5357](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:5357>); [store/authStore.ts:893](<E:/backup/onboarding all files/Paradigm Office 4/store/authStore.ts:893>); [services/api.ts:52](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:52>).

**13. Medium — Cached all-employee attendance is never returned offline**

getAllAttendanceEvents writes a cache online but reads it using getCacheWithMeta offline. That getter is a stub returning null, so this fallback always returns an empty array even when the data is stored.

Reproduce: Load an all-employee attendance period online and request it again offline.

Correction: Implement metadata-backed cache reads or use the actual stored cache shape consistently.

Evidence: Isolated reproduction passed: getCache returned data while getCacheWithMeta returned null. Code: [services/api.ts:102](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:102>); [services/api.ts:5174](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:5174>); [services/api.ts:5180](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:5180>).

**14. High — Several backend calls use the phone's local origin instead of the server**

The app has a native-aware getApiUrl/apiFetch helper, but several CRM campaign/email, HR calls/letters, VoIP, biometric-device and analysis requests still use fetch('/api/...'). In the bundled Android shell these resolve against its local WebView origin, which does not host the Vercel API. The Vite development proxy does not exist inside the APK. An equivalent bundled Capacitor iOS build would have the same relative-URL problem.

Reproduce: Run the production Android bundle with internet and use an affected operation; inspect the request target.

Correction: Route backend requests through the native-aware API helper and verify authentication/CORS at the server.

Evidence: Confirmed URL construction/configuration mismatch; device HTTP responses were not tested. Capacitor origin defaults: [official v7 configuration](https://capacitorjs.com/docs/v7/config). Code: [capacitor.config.ts:6](<E:/backup/onboarding all files/Paradigm Office 4/capacitor.config.ts:6>); [utils/apiClient.ts:14](<E:/backup/onboarding all files/Paradigm Office 4/utils/apiClient.ts:14>); [services/crmApi.ts:871](<E:/backup/onboarding all files/Paradigm Office 4/services/crmApi.ts:871>); [services/hrm.api.ts:67](<E:/backup/onboarding all files/Paradigm Office 4/services/hrm.api.ts:67>); [components/hr/VoipDialer.tsx:264](<E:/backup/onboarding all files/Paradigm Office 4/components/hr/VoipDialer.tsx:264>); [services/api.ts:11264](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:11264>).

**15. High — The checked-in iOS app is incomplete and its launcher depends on the website**

Android launches a Capacitor BridgeActivity, while the executable Swift source shown here launches a plain WKWebView and loads https://app.paradigmfms.com. No local bundle fallback is implemented there. The ios/App folder contains copied configuration/assets but no Xcode project.pbxproj, Podfile, or Swift package project was found in this checkout. This does not establish what a separately built or deployed iPhone app contains.

Reproduce: Inspect/build this checkout's iOS target, then attempt a cold launch without cached website data and without internet.

Correction: Complete the Capacitor iOS project, bundle the web assets, wire plugins, and validate offline cold starts on an iPhone.

Evidence: Confirmed repository/configuration gap. [Official Capacitor v7 iOS project workflow](https://capacitorjs.com/docs/v7/ios). Code: [ios/ParadigmIFS/ViewController.swift:4](<E:/backup/onboarding all files/Paradigm Office 4/ios/ParadigmIFS/ViewController.swift:4>); [ios/ParadigmIFS/ViewController.swift:8](<E:/backup/onboarding all files/Paradigm Office 4/ios/ParadigmIFS/ViewController.swift:8>); [ios/ParadigmIFS/ViewController.swift:51](<E:/backup/onboarding all files/Paradigm Office 4/ios/ParadigmIFS/ViewController.swift:51>); [ios/ParadigmIFS/SceneDelegate.swift:12](<E:/backup/onboarding all files/Paradigm Office 4/ios/ParadigmIFS/SceneDelegate.swift:12>).

**16. High — iOS steps and native background tracking are not connected to app actions**

The JS step service returns zero on non-Android platforms and reports preflight success. Native route-service startup is Android-only. Although a Swift background tracking class exists, the WKWebView message handler only prints messages, and no initial JS-to-Swift tracking start bridge is wired. AppDelegate only restores previously saved native tracking configuration.

Reproduce: Start a field-duty session on iOS, walk, then lock/background the phone and compare steps/route capture with Android.

Correction: Implement the iOS bridge/plugin and connect start, stop, token update, permission, and step events to the same app lifecycle.

Evidence: Confirmed missing integration; sensor/background behavior requires physical-device validation. Code: [services/stepCounterService.ts:124](<E:/backup/onboarding all files/Paradigm Office 4/services/stepCounterService.ts:124>); [services/stepCounterService.ts:150](<E:/backup/onboarding all files/Paradigm Office 4/services/stepCounterService.ts:150>); [services/routeTrackingService.ts:49](<E:/backup/onboarding all files/Paradigm Office 4/services/routeTrackingService.ts:49>); [ios/ParadigmIFS/ViewController.swift:97](<E:/backup/onboarding all files/Paradigm Office 4/ios/ParadigmIFS/ViewController.swift:97>); [ios/ParadigmIFS/BackgroundTrackingService.swift:50](<E:/backup/onboarding all files/Paradigm Office 4/ios/ParadigmIFS/BackgroundTrackingService.swift:50>); [ios/ParadigmIFS/AppDelegate.swift:21](<E:/backup/onboarding all files/Paradigm Office 4/ios/ParadigmIFS/AppDelegate.swift:21>).

**17. High — Android background GPS points are dropped when upload fails offline**

The Android native tracking service sends each location directly by HTTP. Ordinary network failures are logged without persisting that point to a queue. The foreground JS route path has local persistence, but the native background path does not use it. Missing-token early returns also discard that captured point.

Reproduce: Begin tracking, put the app in the background, disable internet while moving, then reconnect.

Correction: Persist native location events before transmission and acknowledge individual IDs after a successful upload.

Evidence: Confirmed native upload/error-handler trace; route loss on a real phone was not exercised. Code: [android/app/src/main/java/com/paradigm/ifs/TrackingService.java:342](<E:/backup/onboarding all files/Paradigm Office 4/android/app/src/main/java/com/paradigm/ifs/TrackingService.java:342>); [android/app/src/main/java/com/paradigm/ifs/TrackingService.java:431](<E:/backup/onboarding all files/Paradigm Office 4/android/app/src/main/java/com/paradigm/ifs/TrackingService.java:431>); [android/app/src/main/java/com/paradigm/ifs/TrackingService.java:465](<E:/backup/onboarding all files/Paradigm Office 4/android/app/src/main/java/com/paradigm/ifs/TrackingService.java:465>).

**18. High — A failed gate-directory fetch destroys the previously cached roster**

Supabase query failures normally return an error value. prefetchGateData ignores all three errors, converts null data into empty arrays, and overwrites localStorage. The catch fallback therefore does not protect the existing residents/units/helper roster when a request resolves with an error.

Reproduce: Cache a roster online, then mount the gate page with failing/disconnected backend requests.

Correction: Check each result's error and preserve the last successful roster; update cache only from validated responses.

Evidence: Isolated reproduction passed: a previously cached flat disappeared after a mocked fetch error. Code: [services/offline/gateKioskService.ts:27](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts:27>); [services/offline/gateKioskService.ts:46](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts:46>); [pages/gate/CommunityGateKiosk.tsx:108](<E:/backup/onboarding all files/Paradigm Office 4/pages/gate/CommunityGateKiosk.tsx:108>).

**19. High — Gate sync can delete new visitors recorded during the upload**

Gate sync snapshots the queue, awaits one RPC, then removes the entire localStorage queue key. A new visitor added while that RPC is in flight is not part of the uploaded snapshot, but is deleted with it.

Reproduce: Start syncing queued visitors on a slow connection; record another offline visitor before the request completes.

Correction: Remove only IDs acknowledged by the RPC, using serialized/transactional queue updates.

Evidence: Isolated reproduction passed: RPC acknowledged one visitor but a second newly queued visitor was also erased. Code: [services/offline/gateKioskService.ts:192](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts:192>); [services/offline/gateKioskService.ts:211](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts:211>); [services/offline/gateKioskService.ts:228](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts:228>).

**20. High — Gate entry reports success even when local storage cannot save it**

queuePendingEntry catches a localStorage quota/write error and returns normally. logVisitorEntry then returns success:true. The guard can believe a visitor was recorded even though neither the device nor the server has the entry.

Reproduce: Fill/disable local storage and record a visitor offline.

Correction: Propagate storage failure and return success only after a durable write; show a recoverable failure with retained form inputs.

Evidence: Isolated reproduction passed: storage threw, but the API still returned success. Code: [services/offline/gateKioskService.ts:184](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts:184>); [services/offline/gateKioskService.ts:192](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts:192>).

**21. Medium — Gate visitor auto-sync only runs while its page observes a new online event**

Gate pending entries use a separate localStorage queue. Its automatic drain is attached to the gate page's window online listener. There is no startup drain when the page opens already online, and the main app's IndexedDB sync engine does not drain this queue. Closing the app offline and reopening online can therefore leave visitors pending until manual sync or another connectivity transition on that page.

Reproduce: Queue a visitor, close the app, restore internet, and reopen it already online.

Correction: Register gate queue processing with app-level startup, session, reconnect and resume recovery.

Evidence: Confirmed lifecycle wiring; manual sync is available. Code: [pages/gate/CommunityGateKiosk.tsx:91](<E:/backup/onboarding all files/Paradigm Office 4/pages/gate/CommunityGateKiosk.tsx:91>); [pages/gate/CommunityGateKiosk.tsx:108](<E:/backup/onboarding all files/Paradigm Office 4/pages/gate/CommunityGateKiosk.tsx:108>); [services/offline/gateKioskService.ts:207](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/gateKioskService.ts:207>).

**22. Medium — Prefetched site suggestions are written to a store that does not exist**

prefetchMasterData reports that organizations were cached in IndexedDB, but the database never creates an organizations store and cache.putServerRecords silently skips missing stores. Its fallback writes paradigm_cache_organizations, while getCachedSites looks for paradigm_organizations_cache. Thus the snag form's cached-site suggestions do not consume the data that prefetch actually stored.

Reproduce: Run prefetch, then open offline snag entry and inspect cached site suggestions.

Correction: Create/migrate the intended store or use the same existing cache key for both read and write.

Evidence: Confirmed storage schema/key mismatch. Code: [services/offline/prefetch.ts:41](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/prefetch.ts:41>); [services/offline/prefetch.ts:78](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/prefetch.ts:78>); [services/offline/cache.ts:28](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/cache.ts:28>); [services/offline/db.ts:160](<E:/backup/onboarding all files/Paradigm Office 4/services/offline/db.ts:160>); [pages/operations/SnagAuditPage.tsx:151](<E:/backup/onboarding all files/Paradigm Office 4/pages/operations/SnagAuditPage.tsx:151>).

**23. Medium — App upgrades clear offline reference data before connectivity is established**

Version-change cleanup runs during startup, including offline launches. It deletes settings/reference caches, clears HT master/custom-field stores, and resets persisted attendance fields. Keeping the outbox alone is insufficient: users need these reference values and attendance context to continue working while disconnected.

Reproduce: Warm the app's reference data, install an update, then launch without internet and try the same field workflow.

Correction: Version/migrate usable caches, and replace them only after fresh reference data has been fetched successfully; retain local attendance context until reconciled.

Evidence: Confirmed unconditional cleanup path; upgrade behavior needs packaged-device validation. Code: [index.tsx:79](<E:/backup/onboarding all files/Paradigm Office 4/index.tsx:79>); [services/appUpgradeManager.ts:59](<E:/backup/onboarding all files/Paradigm Office 4/services/appUpgradeManager.ts:59>); [services/appUpgradeManager.ts:92](<E:/backup/onboarding all files/Paradigm Office 4/services/appUpgradeManager.ts:92>); [services/appUpgradeManager.ts:137](<E:/backup/onboarding all files/Paradigm Office 4/services/appUpgradeManager.ts:137>).

**24. Medium — Successful online enrollment caches are overwritten with attachment-free data**

Attachment extraction deliberately removes preview/url/file fields for the queued payload. The online callback uploads documents and caches their proper paths, but immediately after saveOfflineAware returns, the outer function overwrites that cache with the sanitized offlineDbData. Newly uploaded document URLs can disappear from the local enrollment copy until it is refreshed from the server.

Reproduce: Save enrollment with new documents online, then disconnect and reopen it from local cache.

Correction: Return the canonical saved record from the online callback and retain its paths; maintain durable local attachment references for offline viewing.

Evidence: Confirmed overwrite order; cloud records themselves are not shown to be deleted. Code: [services/api.ts:2277](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:2277>); [services/api.ts:2304](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:2304>); [services/api.ts:2335](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:2335>); [services/api.ts:2339](<E:/backup/onboarding all files/Paradigm Office 4/services/api.ts:2339>).

**Issue 01: affected legacy write paths**

All rows below call the empty addToOutbox. They are manifestations of the same root defect, not additional bugs counted above.

| Area | Examples in services/api.ts |
|---|---|
| User/profile updates | 3666 |
| Organizations/entities/site configuration | 4315, 4664, 4757 |
| Attendance punches | 5305, 5355 |
| Locations | 5919 |
| Attendance settings/enrollment rules | 6124, 6285 |
| Leave requests | 8106 |
| Task creation/updates | 8618, 8645 |
| Field reports | 9116 |
| Extra-work and comp-off claims | 9893, 10008 |
| Site assets and issued tools | 10443, 10541 |
| Uniform requests | 10721, 10735, 10749 |
| Support tickets/posts/comments | 10837, 11023, 11038, 11073 |
| Biometric devices | 11680, 11719, 11748 |
| Attendance violations/resets | 11809, 11834 |
| Site finance tracker | 12503 |
| Child details and verification | 12796, 12828, 12856, 12866 |

**Suggested repair order**

1. Protect data first: implement the legacy queue, stop deleting unsynced failures, and fix revision acknowledgment and account isolation (01–04, 08–09).
2. Repair functional saves and recovery: snag payloads, attachment preservation, restart/auth recovery, attendance reads, and face caches (05–07, 11–13).
3. Finish native parity: route backend URLs correctly, complete the iOS project/bridge, and persist Android background GPS failures (14–17).
4. Repair gate durability, cache consistency, offline navigation, and upgrade behavior (10, 18–24).

**Device acceptance matrix after fixes**

For each supported workflow, test Android and iPhone with: normal internet; airplane mode after an initial successful data load; Wi-Fi connected with no internet; a connection drop during save/upload; force-close/reopen with queued work; reconnect while a record is being edited; an expired session; shared-device account switching; storage exhaustion; and an offline first launch after an app update. Confirm both the device's saved data and the final server rows, attachments, ownership, and duplicate counts.

Separate offline capture from inherently online completion. OTP delivery, third-party verification, sending email/push, live remote approvals, and cloud AI require a network for completion. The app can preserve drafts or pending requests locally and clearly report their status until the server confirms completion. A server-backed action must not be shown as completed merely because a local draft exists.

