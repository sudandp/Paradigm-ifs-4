/**
 * Read-Through Cache — Paradigm FMS Offline Layer
 *
 * Used for read-only reference data:
 *   - ht_master_options (HT Yard master data)
 *
 * Strategy: Try network first → on success, write to IDB → return data.
 *           On network failure → read from IDB → return cached data.
 *
 * This is read-only — no outbox needed. The cache is invalidated by
 * calling invalidate(category), which clears the IDB records for that key.
 */

import { getDb } from './db';
import { isOfflineEnabled } from './featureFlag';
import type { SnagEntry } from '../../types/operations';
import type { HTMasterOption, OfflineHTYardAuditRecord } from '../../types/htYard';
import type { PPMExecutionRecord } from '../../types/ppm';

// ─── ht_master_options cache ─────────────────────────────────────────────────

/**
 * Writes an array of master-option rows to the IDB cache.
 * Called by htYardMasterDataService after a successful Supabase fetch.
 */
export async function cacheMasterOptions(
  rows: HTMasterOption[]
): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    const tx = db.transaction('ht_master_options', 'readwrite');
    await Promise.all([
      ...rows.map((row) => tx.store.put(row)),
      tx.done,
    ]);
    console.debug(`[Cache] Stored ${rows.length} ht_master_options rows`);
  } catch (err) {
    console.warn('[Cache] Failed to cache ht_master_options:', err);
  }
}

/**
 * Returns cached master-option rows for a given category.
 * Returns an empty array if nothing is cached.
 */
export async function getCachedMasterOptions(
  category: string
): Promise<HTMasterOption[]> {
  if (!isOfflineEnabled()) return [];
  try {
    const db = await getDb();
    return db.getAllFromIndex('ht_master_options', 'by-category', category);
  } catch (err) {
    console.warn('[Cache] Failed to read ht_master_options cache:', err);
    return [];
  }
}

/**
 * Clears cached master-option rows for a given category.
 * Call after a successful remote save to force a re-fetch on next read.
 */
export async function invalidateMasterOptions(category?: string): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    if (!category) {
      await db.clear('ht_master_options');
      return;
    }
    const cached = await db.getAllFromIndex(
      'ht_master_options',
      'by-category',
      category
    );
    const tx = db.transaction('ht_master_options', 'readwrite');
    await Promise.all([
      ...cached.map((row) => tx.store.delete(row.id)),
      tx.done,
    ]);
  } catch (err) {
    console.warn('[Cache] Failed to invalidate ht_master_options cache:', err);
  }
}

// ─── snag_audits local read ───────────────────────────────────────────────────

export type CachedSnagEntry = SnagEntry & { pending?: boolean };

/**
 * Returns all locally stored snag entries from IDB.
 * Used to serve the list while offline.
 */
export async function getCachedSnagEntries(): Promise<CachedSnagEntry[]> {
  if (!isOfflineEnabled()) return [];
  try {
    const db = await getDb();
    const rows = await db.getAll('snag_audits');
    return rows.sort((a, b) => {
      const at = a.timestamp || '';
      const bt = b.timestamp || '';
      return bt.localeCompare(at);
    });
  } catch (err) {
    console.warn('[Cache] Failed to read snag_audits cache:', err);
    return [];
  }
}

/**
 * Writes a single snag entry to the local IDB mirror.
 */
export async function cacheSnagEntry(entry: CachedSnagEntry): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    await db.put('snag_audits', entry);
  } catch (err) {
    console.warn('[Cache] Failed to cache snag entry:', err);
  }
}

/**
 * Caches an array of snag entries (used after a successful online fetch).
 *
 * NOTE (Risk #3 partial): This does NOT clear stale rows before writing.
 * Records deleted online may persist until the same ID is fetched again.
 * deleteSnagEntryFromCache() must be called explicitly on every delete.
 */
export async function cacheSnagEntries(
  entries: CachedSnagEntry[]
): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    const tx = db.transaction('snag_audits', 'readwrite');
    await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done]);
  } catch (err) {
    console.warn('[Cache] Failed to bulk-cache snag entries:', err);
  }
}

/**
 * Removes a single snag entry from IDB.
 * Call after a successful Supabase delete to prevent withdrawn records
 * from reappearing in the offline list (compliance/safety risk).
 */
export async function deleteSnagEntryFromCache(id: string): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    await db.delete('snag_audits', id);
    console.debug(`[Cache] Deleted snag entry from IDB: ${id}`);
  } catch (err) {
    console.warn('[Cache] Failed to delete snag entry from IDB:', err);
  }
}

// ─── ht_yard_audits local read ────────────────────────────────────────────────

export async function getCachedHtYardAudits(): Promise<OfflineHTYardAuditRecord[]> {
  if (!isOfflineEnabled()) return [];
  try {
    const db = await getDb();
    return db.getAll('ht_yard_audits');
  } catch (err) {
    console.warn('[Cache] Failed to read ht_yard_audits cache:', err);
    return [];
  }
}

export async function cacheHtYardAudit(audit: OfflineHTYardAuditRecord): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    await db.put('ht_yard_audits', audit);
  } catch (err) {
    console.warn('[Cache] Failed to cache HT Yard audit:', err);
  }
}

/**
 * Removes a single HT Yard audit from IDB.
 * Call after a successful Supabase delete for parity with snag delete-mirror.
 */
export async function deleteHtYardAuditFromCache(id: string): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    await db.delete('ht_yard_audits', id);
    console.debug(`[Cache] Deleted HT Yard audit from IDB: ${id}`);
  } catch (err) {
    console.warn('[Cache] Failed to delete HT Yard audit from IDB:', err);
  }
}

// ─── ppm_executions local read & one-time migration ───────────────────────────

export async function getCachedPpmExecutions(): Promise<PPMExecutionRecord[]> {
  if (!isOfflineEnabled()) return [];
  try {
    const db = await getDb();
    return db.getAll('ppm_executions');
  } catch (err) {
    console.warn('[Cache] Failed to read ppm_executions cache:', err);
    return [];
  }
}

export async function cachePpmExecution(execution: PPMExecutionRecord): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    await db.put('ppm_executions', execution);
  } catch (err) {
    console.warn('[Cache] Failed to cache PPM execution:', err);
  }
}

export async function deletePpmExecutionFromCache(id: string): Promise<void> {
  if (!isOfflineEnabled()) return;
  try {
    const db = await getDb();
    await db.delete('ppm_executions', id);
    console.debug(`[Cache] Deleted PPM execution from IDB: ${id}`);
  } catch (err) {
    console.warn('[Cache] Failed to delete PPM execution from IDB:', err);
  }
}

const PPM_MIGRATION_FLAG_KEY = 'paradigm_ppm_localStorage_migrated_v1';

/**
 * One-time migration: imports existing PPM drafts sitting in localStorage
 * (`paradigm_ppm_audits_list`) into the IndexedDB store (`ppm_executions`).
 * Prevents loss of existing local PPM data upon upgrade.
 */
export async function migrateLocalStoragePpmDrafts(): Promise<number> {
  if (!isOfflineEnabled()) return 0;
  if (typeof localStorage === 'undefined') return 0;

  const alreadyMigrated = localStorage.getItem(PPM_MIGRATION_FLAG_KEY);
  if (alreadyMigrated === 'true') return 0;

  try {
    const rawList = localStorage.getItem('paradigm_ppm_audits_list');
    if (!rawList) {
      localStorage.setItem(PPM_MIGRATION_FLAG_KEY, 'true');
      return 0;
    }

    const items = JSON.parse(rawList);
    if (!Array.isArray(items) || items.length === 0) {
      localStorage.setItem(PPM_MIGRATION_FLAG_KEY, 'true');
      return 0;
    }

    const db = await getDb();
    const tx = db.transaction('ppm_executions', 'readwrite');

    let count = 0;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const record: PPMExecutionRecord = {
        id: raw.id || crypto.randomUUID(),
        site_name: raw.site || raw.site_name || 'Unassigned Site',
        reference_number: raw.reference_number || raw.referenceNumber || `PPM-${Date.now()}`,
        category_id: raw.type || raw.category_id || 'HT_YARD',
        audit_date: raw.date || raw.audit_date || new Date().toISOString().split('T')[0],
        status: raw.status || 'DRAFT',
        auditor_name: raw.tech || raw.auditor_name || 'Field Technician',
        observations: raw.observations || {},
        summary_counts: raw.summary_counts || { critical: 0, major: 0, medium: 0, minor: 0, total: 0 },
        snag_ids: raw.snag_ids || [],
        created_at: raw.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pending: true,
      };
      await tx.store.put(record);
      count++;
    }

    await tx.done;
    localStorage.setItem(PPM_MIGRATION_FLAG_KEY, 'true');
    console.info(`[Offline] Migrated ${count} legacy localStorage PPM drafts to IDB`);
    return count;
  } catch (err) {
    console.warn('[Offline] Failed to migrate localStorage PPM drafts:', err);
    return 0;
  }
}

