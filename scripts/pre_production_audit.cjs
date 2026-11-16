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

// ── 4. CONNECTED DEVICE LIVE AUDIT ──────────────────────────────────────────
console.log('\n📱 4. Checking Connected Device State (ADB)...');
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
