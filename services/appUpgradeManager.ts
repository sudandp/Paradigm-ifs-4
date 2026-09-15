/**
 * App Upgrade & Cache Management Service — Paradigm FMS
 *
 * Automatically detects when a new APK or web bundle version is installed.
 * On first launch after an update:
 *   - Wipes stale browser/WebView CacheStorage and unregisters old ServiceWorkers.
 *   - Safely flushes stale non-essential localStorage caches (settings, permissions, UI paths).
 *   - Preserves authentication sessions, Supabase tokens, device credentials, and pending offline outboxes (Option A).
 *   - Clears read-only IndexedDB caches (ht_master_options, ht_custom_field_specs) while preserving outbox/photos.
 *   - Updates stored version metadata so cleanup runs exactly once per upgrade.
 */

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getDb } from './offline/db';
import { APP_VERSION, APP_BUILD_NUMBER } from '../src/config/appVersion';

export const STORED_VERSION_CODE_KEY = 'paradigm_last_installed_build_code';
export const STORED_VERSION_NAME_KEY = 'paradigm_last_installed_version_name';

/**
 * Storage keys that MUST NEVER be wiped during upgrade cleanup (Option A).
 * Preserves user login state, security tokens, device ID, and offline sync queues.
 */
const PRESERVED_STORAGE_PREFIXES = [
  'sb-',                             // Supabase auth tokens and sessions
  'supabase.',                       // Supabase client storage keys
  'paradigm-auth-storage',           // Zustand auth store (login identity, punch status)
  'paradigm_device_fingerprint',     // Device fingerprint
  'paradigm_device_id',              // Unique device identifier
  'paradigm_offline_sync_queue_v1',  // Offline sync queue
  'offline_queue',                   // Fallback offline queue
  'user_credentials',                // Stored user credentials fallback
  'auth_token',                      // Stored JWT fallback
  'paradigm_impersonation_session',  // Active admin impersonation session
  'gate-kiosk-storage',              // Gate kiosk mode device config
];

/**
 * Checks whether a given localStorage key should be preserved.
 */
function isPreservedKey(key: string): boolean {
  return PRESERVED_STORAGE_PREFIXES.some(prefix => key === prefix || key.startsWith(prefix));
}

/**
 * Performs selective cache clearance (Option A: Safe Mode).
 * Clears volatile/stale caches without disrupting user login or pending mutations.
 */
export async function executeSafeCacheClearance(): Promise<void> {
  console.info('[AppUpgrade] Starting safe cache clearance (Option A)...');

  // 1. Clear Browser / WebView CacheStorage (HTTP response caches & JS chunks)
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(k => caches.delete(k)));
      console.log(`[AppUpgrade] Purged ${cacheKeys.length} CacheStorage entries.`);
    }
  } catch (cacheErr) {
    console.warn('[AppUpgrade] CacheStorage cleanup warning:', cacheErr);
  }

  // 2. Unregister Service Workers
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      if (registrations.length > 0) {
        console.log(`[AppUpgrade] Unregistered ${registrations.length} Service Worker(s).`);
      }
    }
  } catch (swErr) {
    console.warn('[AppUpgrade] ServiceWorker cleanup warning:', swErr);
  }

  // 3. Selective localStorage Cleanup (Purge stale UI state, settings & permissions)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Never touch our version tracking keys
        if (key === STORED_VERSION_CODE_KEY || key === STORED_VERSION_NAME_KEY) continue;

        // Check if key is explicitly protected
        if (isPreservedKey(key)) continue;

        // Target keys known to cause stale schema or wrong data issues across versions
        const isStaleTarget =
          key.includes('permissions') ||
          key.includes('settings') ||
          key.includes('fcu_announced_version') ||
          key.includes('enrollment') ||
          key.includes('paradigm_lastPath') ||
          key.includes('cache') ||
          key.includes('options') ||
          key.includes('theme');

        if (isStaleTarget) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(k => localStorage.removeItem(k));
      console.log(`[AppUpgrade] Removed ${keysToRemove.length} stale localStorage cache keys:`, keysToRemove);
    }
  } catch (lsErr) {
    console.warn('[AppUpgrade] LocalStorage selective cleanup warning:', lsErr);
  }

  // 4. Purge Read-Only Caches in IndexedDB (paradigmOfflineDB)
  // Strictly preserves outbox, photos, and pending submission records
  try {
    const db = await getDb();
    if (db.objectStoreNames.contains('ht_master_options')) {
      await db.clear('ht_master_options');
      console.log('[AppUpgrade] Cleared IndexedDB ht_master_options cache.');
    }
    if (db.objectStoreNames.contains('ht_custom_field_specs')) {
      await db.clear('ht_custom_field_specs');
      console.log('[AppUpgrade] Cleared IndexedDB ht_custom_field_specs cache.');
    }
  } catch (idbErr) {
    console.warn('[AppUpgrade] IndexedDB cache cleanup warning:', idbErr);
  }
}

/**
 * Detects version upgrade and triggers automatic safe cache cleanup.
 * Returns true if an upgrade cleanup was executed, false otherwise.
 */
export async function checkAndHandleAppUpgrade(): Promise<boolean> {
  try {
    let currentBuild = String(APP_BUILD_NUMBER || '1');
    let currentVersion = APP_VERSION || '1.0.0';

    // Retrieve native version if running in Capacitor
    if (Capacitor.isNativePlatform()) {
      try {
        const appInfo = await App.getInfo();
        if (appInfo.build) currentBuild = String(appInfo.build);
        if (appInfo.version) currentVersion = String(appInfo.version);
      } catch (nativeErr) {
        console.warn('[AppUpgrade] Could not read native App.getInfo, using fallback version:', nativeErr);
      }
    }

    const lastBuild = localStorage.getItem(STORED_VERSION_CODE_KEY);

    // Initial run on new device / fresh installation
    if (!lastBuild) {
      localStorage.setItem(STORED_VERSION_CODE_KEY, currentBuild);
      localStorage.setItem(STORED_VERSION_NAME_KEY, currentVersion);
      console.log(`[AppUpgrade] Baseline version registered: Build ${currentBuild} (${currentVersion})`);
      return false;
    }

    // No upgrade detected
    if (lastBuild === currentBuild) {
      return false;
    }

    // Version mismatch detected -> App was upgraded!
    console.info(
      `[AppUpgrade] Version upgrade detected: Build ${lastBuild} -> ${currentBuild} (v${currentVersion}). Initiating automated cache cleanup...`
    );

    // Perform safe cleanup
    await executeSafeCacheClearance();

    // Persist new version info so cleanup only runs once
    localStorage.setItem(STORED_VERSION_CODE_KEY, currentBuild);
    localStorage.setItem(STORED_VERSION_NAME_KEY, currentVersion);

    console.info(`[AppUpgrade] Automated cleanup successfully completed for Build ${currentBuild}.`);
    return true;
  } catch (err) {
    console.error('[AppUpgrade] Unexpected error during version upgrade check:', err);
    return false;
  }
}
