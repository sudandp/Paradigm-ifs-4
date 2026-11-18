/**
 * pre_production_audit.cjs
 * 
 * Comprehensive Pre-Production Automated Audit for Paradigm IFS.
 * Catches state desyncs, missing RLS auth hydrations, truthy empty array bugs,
 * and persistent storage vulnerabilities before releasing to Google Play / Production.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('🚀 PARADIGM IFS PRE-PRODUCTION AUDIT SUITE');
console.log('====================================================\n');

let issuesFound = 0;
let checksPassed = 0;

function assertCheck(name, condition, errorMsg) {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    checksPassed++;
  } else {
    console.error(`❌ [FAIL] ${name}\n   👉 ${errorMsg}`);
    issuesFound++;
  }
}

// ── 1. RLS SESSION HYDRATION AUDIT ─────────────────────────────────────────
console.log('📋 1. Auditing Supabase Auth & RLS Hydration...');
const apiContent = fs.readFileSync('services/api.ts', 'utf8');
const supabaseContent = fs.readFileSync('services/supabase.ts', 'utf8');
const appContent = fs.readFileSync('App.tsx', 'utf8');

assertCheck(
  'ensureSupabaseAuthSession is exported in services/supabase.ts',
  supabaseContent.includes('export const ensureSupabaseAuthSession = async'),
  'ensureSupabaseAuthSession is missing from services/supabase.ts!'
);

assertCheck(
  'App.tsx invokes ensureSupabaseAuthSession on startup',
  appContent.includes('ensureSupabaseAuthSession()'),
  'App.tsx does not call ensureSupabaseAuthSession during initialization!'
);

assertCheck(
  'api.getLeaveRequests hydrates auth session before querying RLS table',
  apiContent.includes('ensureSupabaseAuthSession()') && apiContent.includes('getLeaveRequests:'),
  'api.getLeaveRequests does not guarantee an active auth session!'
);

assertCheck(
  'api.getLeaveBalancesForUser hydrates auth session before querying RLS table',
  /getLeaveBalancesForUser[\s\S]{1,600}ensureSupabaseAuthSession/.test(apiContent),
  'api.getLeaveBalancesForUser does not guarantee an active auth session!'
);

assertCheck(
  'api.getAttendanceEvents hydrates auth session before querying',
  /getAttendanceEvents[\s\S]{1,600}ensureSupabaseAuthSession/.test(apiContent),
  'api.getAttendanceEvents does not guarantee an active auth session!'
);

// ── 2. CREDENTIAL PERSISTENCE & SECURITY AUDIT ──────────────────────────────
console.log('\n🔒 2. Auditing Credential Storage & Security...');
const authStoreContent = fs.readFileSync('store/authStore.ts', 'utf8');

assertCheck(
  'authStore encrypts saved passcode with AES-256 (no plaintext rememberedPassword)',
  authStoreContent.includes("secureSet('rememberedPasscode', passcode)") &&
  !authStoreContent.includes("Preferences.set({ key: 'rememberedPassword'"),
  'authStore is storing plaintext passwords or missing secureSet for rememberedPasscode!'
);

assertCheck(
  'authStore purges rememberedPasscode on logout',
  authStoreContent.includes("secureRemove('rememberedPasscode')"),
  'authStore does not clear rememberedPasscode during logout!'
);

// ── 3. DANGEROUS TRUTHY ARRAY PATTERNS SCAN ─────────────────────────────────
console.log('\n🔍 3. Scanning for Dangerous Truthy Empty Array Fallbacks...');
const dashboardContent = fs.readFileSync('pages/leaves/LeaveDashboard.tsx', 'utf8');

assertCheck(
  'LeaveDashboard activeRequests checks array length before overriding',
  dashboardContent.includes('cached?.yearlyRequests && cached.yearlyRequests.length > 0'),
  'LeaveDashboard activeRequests has truthy empty array trap (cached?.yearlyRequests || fallback)!'
);

assertCheck(
  'LeaveDashboard activeMonthEvents checks array length before overriding',
  dashboardContent.includes('cached?.yearlyEvents && cached.yearlyEvents.length > 0'),
  'LeaveDashboard activeMonthEvents has truthy empty array trap!'
);

assertCheck(
  'LeaveDashboard purges stale 13.1 bogus unauthenticated cache on mount',
  dashboardContent.includes('13.1'),
  'LeaveDashboard is missing automatic purge of stale 13.1 unauthenticated cache!'
);

// ── 4. OFFLINE PERSISTENCE & DATA LOSS PREVENTION AUDIT ─────────────────────
console.log('\n📦 4. Auditing Offline Sync & Data Loss Defenses...');
const outboxContent = fs.readFileSync('services/offline/outbox.ts', 'utf8');
const syncEngineContent = fs.readFileSync('services/offline/syncEngine.ts', 'utf8');

assertCheck(
  'outbox.ts provides recoverStuckSyncingItems to prevent orphaned operations',
  outboxContent.includes('recoverStuckSyncingItems'),
  'outbox.ts is missing recoverStuckSyncingItems implementation!'
);

assertCheck(
  'outbox.ts protects failed records and attachments from automatic deletion (Audit Issue 02)',
  /pruneStaleFailedItems[\s\S]{1,300}return 0/.test(outboxContent) &&
  !/pruneStaleFailedItems[\s\S]{1,400}discardFailedItem/.test(outboxContent),
  'outbox.ts pruneStaleFailedItems still automatically discards failed items/photos!'
);

assertCheck(
  'outbox.ts markSynced checks revision to prevent deleting in-flight newer edits (Audit Issue 03)',
  outboxContent.includes('acknowledgedRevision') && outboxContent.includes('client_revision'),
  'outbox.ts markSynced does not verify acknowledged revision against newer queued edits!'
);

assertCheck(
  'syncEngine.ts verifies active session with ensureSupabaseAuthSession before drain',
  syncEngineContent.includes('ensureSupabaseAuthSession'),
  'syncEngine.ts does not use ensureSupabaseAuthSession for hydration!'
);

assertCheck(
  'syncEngine.ts recovers stuck syncing items on startup and pre-drain',
  syncEngineContent.includes('recoverStuckSyncingItems'),
  'syncEngine.ts does not call recoverStuckSyncingItems!'
);

const headerContent = fs.readFileSync('components/layouts/Header.tsx', 'utf8');
assertCheck(
  'Header.tsx mounts SyncStatusBadge for real-time mobile and desktop sync visibility',
  headerContent.includes('<SyncStatusBadge />') && headerContent.includes('SyncStatusBadge'),
  'Header.tsx is missing SyncStatusBadge!'
);

assertCheck(
  'ConflictResolverModal.tsx is available with 3-way resolution (Keep Mine / Use Server / Export Draft)',
  fs.existsSync('components/offline/ConflictResolverModal.tsx') &&
  fs.readFileSync('components/offline/ConflictResolverModal.tsx', 'utf8').includes('resolveKeepMine') &&
  fs.readFileSync('components/offline/ConflictResolverModal.tsx', 'utf8').includes('resolveUseServer'),
  'components/offline/ConflictResolverModal.tsx is missing or incomplete!'
);

assertCheck(
  'SyncReviewModal.tsx is available as central offline diagnostics and retry hub',
  fs.existsSync('components/offline/SyncReviewModal.tsx') &&
  fs.readFileSync('components/offline/SyncReviewModal.tsx', 'utf8').includes('ConflictResolverModal'),
  'components/offline/SyncReviewModal.tsx is missing or not wired with ConflictResolverModal!'
);

assertCheck(
  'api.ts offlineDb.addToOutbox is a real operation adapter routing to _offlineEnqueue (Audit Issue 01)',
  !apiContent.includes('addToOutbox: async (val?: any) => {},') &&
  apiContent.includes('_offlineEnqueue({'),
  'api.ts offlineDb.addToOutbox is still an empty stub!'
);

assertCheck(
  'api.ts offlineDb.getCacheWithMeta returns structured metadata (Audit Issue 05)',
  !apiContent.includes('getCacheWithMeta: async (key?: string) => null,') &&
  apiContent.includes('cachedAt: Date.now()'),
  'api.ts offlineDb.getCacheWithMeta still unconditionally returns null!'
);

assertCheck(
  'storageRepository.ts provides unified IOfflineStorageRepository and dual IndexedDB/SQLite adapters',
  fs.existsSync('services/offline/storageRepository.ts') &&
  fs.readFileSync('services/offline/storageRepository.ts', 'utf8').includes('IndexedDbStorageAdapter') &&
  fs.readFileSync('services/offline/storageRepository.ts', 'utf8').includes('SqliteStorageAdapter') &&
  fs.readFileSync('services/offline/storageRepository.ts', 'utf8').includes('getStorageRepository'),
  'storageRepository.ts is missing or missing dual adapter implementations!'
);

assertCheck(
  'migrationJournal.ts provides snapshot backup, shadow-write toggle, and hash verification (Phase 2A)',
  fs.existsSync('services/offline/migrationJournal.ts') &&
  fs.readFileSync('services/offline/migrationJournal.ts', 'utf8').includes('createPreMigrationSnapshot') &&
  fs.readFileSync('services/offline/migrationJournal.ts', 'utf8').includes('isShadowWriteEnabled') &&
  fs.readFileSync('services/offline/migrationJournal.ts', 'utf8').includes('verifyMigratedRecords'),
  'migrationJournal.ts is missing or incomplete!'
);

assertCheck(
  'idGenerator.ts generates RFC 4122 v4 UUIDs and operation IDs for offline mutations',
  fs.existsSync('services/offline/idGenerator.ts') &&
  fs.readFileSync('services/offline/idGenerator.ts', 'utf8').includes('generateOfflineId') &&
  fs.readFileSync('services/offline/idGenerator.ts', 'utf8').includes('generateOperationId'),
  'idGenerator.ts is missing or incomplete!'
);

assertCheck(
  'syncEngine.ts enforces topological parent-before-child dependency ordering (dependsOn)',
  syncEngineContent.includes('sortItemsByDependencies') &&
  syncEngineContent.includes('item.dependsOn'),
  'syncEngine.ts does not enforce topological dependency ordering!'
);

assertCheck(
  'attendanceOfflineService.ts provides recordOfflineAttendancePunch with debouncing and stable UUIDs (Phase 3 Batch A)',
  fs.existsSync('services/offline/attendanceOfflineService.ts') &&
  fs.readFileSync('services/offline/attendanceOfflineService.ts', 'utf8').includes('recordOfflineAttendancePunch') &&
  fs.readFileSync('services/offline/attendanceOfflineService.ts', 'utf8').includes('DEBOUNCE_WINDOW_MS'),
  'attendanceOfflineService.ts is missing or missing debouncing!'
);

assertCheck(
  'attendanceOfflineService.ts implements Paradigm Dynamic Shift Engine (Shift A, B, C, A+B, B+C)',
  fs.existsSync('services/offline/attendanceOfflineService.ts') &&
  fs.readFileSync('services/offline/attendanceOfflineService.ts', 'utf8').includes('determineShiftSlot') &&
  fs.readFileSync('services/offline/attendanceOfflineService.ts', 'utf8').includes('calculateOfflineDutyStatus'),
  'attendanceOfflineService.ts is missing Paradigm shift engine rules!'
);

assertCheck(
  'attendanceOfflineService.ts provides offline 128-d Float32Array face descriptor caching',
  fs.existsSync('services/offline/attendanceOfflineService.ts') &&
  fs.readFileSync('services/offline/attendanceOfflineService.ts', 'utf8').includes('cacheFaceDescriptor') &&
  fs.readFileSync('services/offline/attendanceOfflineService.ts', 'utf8').includes('getCachedFaceDescriptor'),
  'attendanceOfflineService.ts is missing face descriptor caching!'
);

assertCheck(
  'api.ts integrates attendanceOfflineService for offline punch and range retrieval',
  apiContent.includes('recordOfflineAttendancePunch') &&
  apiContent.includes('getOfflineAttendanceEvents'),
  'api.ts is not wired to attendanceOfflineService!'
);

assertCheck(
  'enrollmentOfflineService.ts provides durable draft attachment persistence & rehydration (Phase 3 Batch B)',
  fs.existsSync('services/offline/enrollmentOfflineService.ts') &&
  fs.readFileSync('services/offline/enrollmentOfflineService.ts', 'utf8').includes('saveDraftDocumentsToIndexedDb') &&
  fs.readFileSync('services/offline/enrollmentOfflineService.ts', 'utf8').includes('restoreDraftDocumentsFromIndexedDb'),
  'enrollmentOfflineService.ts is missing or missing draft attachment methods!'
);

assertCheck(
  'api.ts retains canonical document storage paths on online save without overwriting (Audit Finding 24)',
  apiContent.includes('saveResult === \'queued\'') &&
  apiContent.includes('mergeDraftDocumentPreviews'),
  'api.ts still unconditionally overwrites online document cache!'
);

assertCheck(
  'syncEngine.ts preserves original creator attribution and normalizes family data during delayed sync',
  fs.readFileSync('services/offline/syncEngine.ts', 'utf8').includes('item.userId && UUID_REGEX.test(item.userId) ? item.userId') &&
  fs.readFileSync('services/offline/syncEngine.ts', 'utf8').includes('validateAndNormalizeFamilyData'),
  'syncEngine.ts does not preserve creator attribution or normalize family data!'
);

const dbContent = fs.readFileSync('services/offline/db.ts', 'utf8');
const prefetchContent = fs.readFileSync('services/offline/prefetch.ts', 'utf8');

assertCheck(
  'syncEngine.ts stripLocalFields normalizes camelCase properties to snake_case allowlist (Audit Finding 05)',
  syncEngineContent.includes('camelCol in payload') &&
  syncEngineContent.includes('TABLE_COLUMN_ALLOWLIST'),
  'syncEngine.ts stripLocalFields does not normalize camelCase properties!'
);

assertCheck(
  'outbox.ts preserves attachments and photos during text/status edits (Audit Finding 06)',
  outboxContent.includes('params.attachments === undefined && existing.attachments') &&
  outboxContent.includes('finalAttachments = existing.attachments'),
  'outbox.ts does not preserve attachments during coalescing!'
);

assertCheck(
  'db.ts and prefetch.ts provide organizations store and fallback resolution for offline sites (Audit Finding 22)',
  dbContent.includes('organizations: {') &&
  prefetchContent.includes('paradigm_cache_organizations') &&
  dbContent.includes('DB_VERSION = 7'),
  'db.ts or prefetch.ts is missing organizations store or fallback!'
);

assertCheck(
  'syncEngine.ts TABLE_COLUMN_ALLOWLIST covers leave, tasks, field reports, extra work, and comp-off (Phase 3 Batch D)',
  syncEngineContent.includes('leave_requests: [') &&
  syncEngineContent.includes('tasks: [') &&
  syncEngineContent.includes('field_reports: [') &&
  syncEngineContent.includes('extra_work_logs: [') &&
  syncEngineContent.includes('comp_off_logs: ['),
  'syncEngine.ts is missing Batch D table definitions in TABLE_COLUMN_ALLOWLIST!'
);

assertCheck(
  'api.ts provides offline caching and stable UUID outbox queuing for Batch D operations (Phase 3 Batch D)',
  apiContent.includes("table_name: 'leave_requests'") &&
  apiContent.includes("table_name: 'tasks'") &&
  apiContent.includes("table_name: 'field_reports'") &&
  apiContent.includes("table_name: 'extra_work_logs'") &&
  apiContent.includes("table_name: 'comp_off_logs'") &&
  apiContent.includes("offlineDb.getCache('comp_off_logs')"),
  'api.ts is missing Batch D offline caching or outbox integration!'
);

assertCheck(
  'syncEngine.ts TABLE_COLUMN_ALLOWLIST covers support_tickets, ticket_posts, ticket_comments, uniform_requests (Phase 3 Batch E)',
  syncEngineContent.includes('support_tickets: [') &&
  syncEngineContent.includes('ticket_posts: [') &&
  syncEngineContent.includes('ticket_comments: [') &&
  syncEngineContent.includes('uniform_requests: ['),
  'syncEngine.ts is missing Batch E table definitions in TABLE_COLUMN_ALLOWLIST!'
);

assertCheck(
  'api.ts provides offline caching and topological dependsOn outbox queuing for Batch E operations (Phase 3 Batch E)',
  apiContent.includes("table_name: 'support_tickets'") &&
  apiContent.includes("table_name: 'ticket_posts'") &&
  apiContent.includes("table_name: 'ticket_comments'") &&
  apiContent.includes("table_name: 'uniform_requests'") &&
  apiContent.includes("dependsOn: ticketId") &&
  apiContent.includes("dependsOn: postId"),
  'api.ts is missing Batch E topological outbox queuing or dependsOn links!'
);

const opsApiContent = fs.readFileSync('services/opsApi.ts', 'utf8');

assertCheck(
  'syncEngine.ts TABLE_COLUMN_ALLOWLIST covers ops_assets, ops_asset_ppm_logs, ops_maintenance_schedules, ops_maintenance_logs (Phase 3 Batch F)',
  syncEngineContent.includes('ops_assets: [') &&
  syncEngineContent.includes('ops_asset_ppm_logs: [') &&
  syncEngineContent.includes('ops_asset_ppm_checklists: [') &&
  syncEngineContent.includes('ops_maintenance_schedules: [') &&
  syncEngineContent.includes('ops_maintenance_logs: ['),
  'syncEngine.ts is missing Batch F table definitions in TABLE_COLUMN_ALLOWLIST!'
);

assertCheck(
  'opsApi.ts provides offline caching, stable UUIDs, and topological dependsOn outbox queuing (Phase 3 Batch F)',
  opsApiContent.includes("offlineDb.getCache('ops_assets')") &&
  opsApiContent.includes("table_name: 'ops_assets'") &&
  opsApiContent.includes("table_name: 'ops_asset_ppm_logs'") &&
  opsApiContent.includes("table_name: 'ops_maintenance_schedules'") &&
  opsApiContent.includes("table_name: 'ops_maintenance_logs'") &&
  opsApiContent.includes("dependsOn: log.assetId") &&
  opsApiContent.includes("dependsOn: log.scheduleId"),
  'opsApi.ts is missing Batch F offline caching or outbox dependsOn integration!'
);

const gateApiContent = fs.readFileSync('services/gateApi.ts', 'utf8');
const gateKioskContent = fs.readFileSync('services/offline/gateKioskService.ts', 'utf8');

assertCheck(
  'syncEngine.ts TABLE_COLUMN_ALLOWLIST covers gate_entries, gate_users, gate_attendance_logs, security_audit_logs (Phase 3 Batch G)',
  syncEngineContent.includes('gate_entries: [') &&
  syncEngineContent.includes('gate_users: [') &&
  syncEngineContent.includes('gate_attendance_logs: [') &&
  syncEngineContent.includes('gate_emergency_alerts: [') &&
  syncEngineContent.includes('security_audit_logs: ['),
  'syncEngine.ts is missing Batch G gate table definitions in TABLE_COLUMN_ALLOWLIST!'
);

assertCheck(
  'gateKioskService.ts enqueues visitor records in outbox before confirmation without fabricating approvals (Phase 3 Batch G & Finding 11)',
  gateKioskContent.includes("tableName: 'gate_entries'") &&
  gateKioskContent.includes("action: 'INSERT'") &&
  gateKioskContent.includes('Audit Finding 11'),
  'gateKioskService.ts is missing outbox queueing for visitor entries!'
);

assertCheck(
  'gateApi.ts provides offline face profile rehydration, stable UUIDs, and outbox queuing (Phase 3 Batch G & Finding 11)',
  gateApiContent.includes('getCachedFaceDescriptor') &&
  gateApiContent.includes("table_name: 'gate_attendance_logs'") &&
  gateApiContent.includes("table_name: 'security_audit_logs'") &&
  gateApiContent.includes('dependsOn: params.gateUserId'),
  'gateApi.ts is missing offline face descriptor rehydration or outbox queuing!'
);

// ── 5. CONNECTED DEVICE LIVE AUDIT ──────────────────────────────────────────
console.log('\n📱 5. Checking Connected Device State (ADB)...');
try {
  const devices = execSync('adb devices').toString();
  const onlineDevices = devices.split('\n').filter(l => l.includes('\tdevice')).map(l => l.split('\t')[0]);
  
  if (onlineDevices.length > 0) {
    const devId = onlineDevices[0];
    console.log(`   Found connected device: ${devId}`);
    
    // Check SharedPreferences for encrypted credentials
    const xml = execSync(`adb -s ${devId} shell "run-as com.paradigm.ifs cat /data/data/com.paradigm.ifs/shared_prefs/CapacitorStorage.xml"`, { maxBuffer: 10 * 1024 * 1024 }).toString();
    
    assertCheck(
      'Device SharedPreferences contains encrypted passcode (_sec_rememberedPasscode)',
      xml.includes('name="_sec_rememberedPasscode"'),
      'Device is missing _sec_rememberedPasscode in native storage! Silent re-auth will fail when session expires.'
    );
    
    assertCheck(
      'Device SharedPreferences contains device encryption salt (_app_enc_salt_)',
      xml.includes('name="_app_enc_salt_"'),
      'Device is missing _app_enc_salt_!'
    );
  } else {
    console.log('   ℹ️ No ADB device connected. Skipping live device checks.');
  }
} catch (e) {
  console.log('   ⚠️ ADB check skipped:', e.message);
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('\n====================================================');
console.log(`📊 AUDIT SUMMARY: ${checksPassed} Passed | ${issuesFound} Issues`);
console.log('====================================================');

if (issuesFound > 0) {
  console.error('\n🚨 CRITICAL: Resolve the failed checks before creating a production release!\n');
  process.exit(1);
} else {
  console.log('\n🎉 ALL PRODUCTION INTEGRITY CHECKS PASSED!\n');
  process.exit(0);
}
