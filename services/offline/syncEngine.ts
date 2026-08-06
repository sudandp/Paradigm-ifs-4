/**
 * Sync Engine — Paradigm FMS Offline Layer
 *
 * Listens for network reconnection and drains the outbox FIFO:
 *   1. If the outbox item has a photoId → upload the Blob to Supabase Storage first
 *   2. Upsert the record payload to the target Supabase table
 *   3. On success  → markSynced (removes from IDB outbox)
 *   4. On failure  → markFailed (stays in IDB, visible in UI as "sync failed")
 *
 * After drain, shows a react-hot-toast summary:
 *   ✅ N items synced
 *   ⚠️  N failed — tap to review  (links to /operations/snag-audit)
 *
 * Start once on app boot:
 *   import { syncEngine } from './services/offline/syncEngine';
 *   syncEngine.start();
 */

import toast from 'react-hot-toast';
import { supabase } from '../supabase';
import { isOfflineEnabled } from './featureFlag';
import { initNetworkStatus, isOnline, onStatusChange } from './networkStatus';
import {
  getPending,
  getFailed,
  retryFailedItem,
  markSyncing,
  markSynced,
  markFailed,
  getPhoto,
  deletePhoto,
  getFailedCount,
} from './outbox';
import { type OutboxItem, getStoragePersistenceState } from './db';
import { migrateLocalStoragePpmDrafts, cacheSnagEntry, cachePpmExecution, cacheHtYardAudit, cacheOnboardingSubmission } from './cache';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
}

// ─── Supabase Storage upload ──────────────────────────────────────────────────

/**
 * Uploads a photo Blob to Supabase Storage → returns the public URL.
 * Throws if the upload fails (caller will markFailed the outbox item).
 */
async function uploadPhotoBlob(
  blob: Blob,
  fileName: string,
  linkedToId: string
): Promise<string> {
  const ext = fileName.split('.').pop() ?? 'jpg';
  const sanitized = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
  const storagePath = `snags/offline/${linkedToId}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('onboarding-documents')
    .upload(storagePath, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });

  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from('onboarding-documents').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Throttles an array of async task functions to run with a maximum concurrency pool limit.
 * Helps prevent network saturation on mobile connections during multi-photo uploads.
 */
export async function throttleUploads<T>(
  tasks: (() => Promise<T>)[],
  concurrency = 2
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── Per-item sync ────────────────────────────────────────────────────────────

async function syncItem(item: OutboxItem): Promise<'synced' | 'failed'> {
  await markSyncing(item.id);

  try {
    let payload = { ...item.payload };

    // ── Step 1: Upload photo if present ──────────────────────────────────────
    if (item.photoId) {
      const photo = await getPhoto(item.photoId);
      if (photo) {
        const publicUrl = await uploadPhotoBlob(
          photo.blob,
          photo.fileName,
          photo.linkedToId
        );
        // Patch the snag payload with the real cloud URL
        payload = {
          ...payload,
          snag_picture_url: publicUrl,
          snag_picture_name: photo.fileName,
        };
      }
    } else if (
      typeof payload.snag_picture_url === 'string' &&
      payload.snag_picture_url.startsWith('data:')
    ) {
      // Base64 Data URL fallback upload
      try {
        const res = await fetch(payload.snag_picture_url);
        const blob = await res.blob();
        const fileName = (payload.snag_picture_name as string) || 'snag_photo.jpg';
        const publicUrl = await uploadPhotoBlob(blob, fileName, item.id);
        payload = {
          ...payload,
          snag_picture_url: publicUrl,
        };
      } catch (dataUrlErr) {
        console.warn('[SyncEngine] Failed to upload base64 fallback photo:', dataUrlErr);
      }
    }

    // Strip transient UI flags from database payload
    delete (payload as any).pending;
    delete (payload as any).failed;
    delete (payload as any).attempt_count;
    delete (payload as any).next_attempt_at;

    // Strip user_id — snag_audits has no such column. Old outbox entries may
    // have been created with user_id in the payload (before this was understood),
    // causing every upsert to fail with "column does not exist". Remove it here
    // so those entries can be retried successfully.
    if (item.tableName === 'snag_audits') {
      delete (payload as any).user_id;
    }

    // ── Step 2: Upsert / update / delete in Supabase ─────────────────────────
    if (item.action === 'INSERT' || item.action === 'UPDATE') {
      const { error } = await supabase
        .from(item.tableName)
        .upsert(payload as Record<string, unknown>, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    } else if (item.action === 'DELETE') {
      const { error } = await supabase
        .from(item.tableName)
        .delete()
        .eq('id', payload['id'] as string);
      if (error) throw new Error(error.message);
    }

    // ── Step 3: Cleanup & Local Cache Update ──────────────────────────────────
    await markSynced(item.id);
    if (item.photoId) {
      await deletePhoto(item.photoId).catch(() => {
        /* non-fatal */
      });
    }

    if (item.tableName === 'snag_audits' && api.toCamelCase) {
      try {
        const camelEntry = api.toCamelCase({
          ...payload,
          pending: false,
          failed: false,
        });
        await cacheSnagEntry(camelEntry as any);
      } catch (cacheErr) {
        console.warn('[SyncEngine] Failed to update local cache after sync:', cacheErr);
      }
    } else if (item.tableName === 'ppm_executions') {
      try {
        await cachePpmExecution({
          ...payload,
          pending: false,
          failed: false,
        } as any);
      } catch (cacheErr) {
        console.warn('[SyncEngine] Failed to update PPM cache after sync:', cacheErr);
      }
    } else if (item.tableName === 'ht_yard_audits') {
      try {
        await cacheHtYardAudit({
          ...payload,
          pending: false,
          failed: false,
        } as any);
      } catch (cacheErr) {
        console.warn('[SyncEngine] Failed to update HT Yard cache after sync:', cacheErr);
      }
    } else if (item.tableName === 'onboarding_submissions') {
      try {
        await cacheOnboardingSubmission({
          ...(payload as any),
          pending: false,
          failed: false,
        });
      } catch (cacheErr) {
        console.warn('[SyncEngine] Failed to update onboarding submission cache after sync:', cacheErr);
      }
    }

    return 'synced';
  } catch (err: unknown) {
    const reason =
      err instanceof Error ? err.message : 'Unknown sync error';
    await markFailed(item.id, reason);
    console.error(`[SyncEngine] Failed to sync item ${item.id}:`, reason);
    return 'failed';
  }
}

// ─── Drain loop ───────────────────────────────────────────────────────────────

async function drainOutbox(): Promise<SyncResult> {
  // ── Auto-retry permanently-failed items ──────────────────────────────────
  // Items reach 'failed' status for two reasons:
  //   1. A transient error that exhausted all backoff attempts (network blip)
  //   2. A payload bug (e.g. missing user_id) that has since been fixed
  // Resetting them to 'pending' with 0 attempts gives them a fresh chance.
  try {
    const failedItems = await getFailed();
    if (failedItems.length > 0) {
      console.log(`[SyncEngine] Auto-retrying ${failedItems.length} previously-failed item(s)…`);
      await Promise.all(failedItems.map(item => retryFailedItem(item.id)));
    }
  } catch (retryErr) {
    console.warn('[SyncEngine] Auto-retry reset error (non-fatal):', retryErr);
  }

  const pending = await getPending();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  console.log(`[SyncEngine] Draining ${pending.length} pending items…`);

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await syncItem(item);
    if (result === 'synced') synced++;
    else failed++;
  }

  return { synced, failed };
}

// ─── Toast summary ────────────────────────────────────────────────────────────

async function showSyncToast(result: SyncResult): Promise<void> {
  const totalFailed = await getFailedCount(); // includes pre-existing failures

  if (result.synced > 0 && totalFailed === 0) {
    toast.success(`✅ ${result.synced} item${result.synced > 1 ? 's' : ''} synced successfully`, {
      duration: 4000,
    });
  } else if (result.synced > 0 && totalFailed > 0) {
    toast.success(`✅ ${result.synced} synced`, { duration: 3000 });
    toast.error(
      `⚠️ ${totalFailed} failed — tap to review`,
      {
        duration: 8000,
        id: 'sync-failed-toast',
        style: { cursor: 'pointer' },
        onClick: () => {
          window.location.hash = '/operations/snag-audit';
        },
      } as Parameters<typeof toast.error>[1]
    );
  } else if (result.synced === 0 && totalFailed > 0) {
    toast.error(`⚠️ ${totalFailed} sync failure${totalFailed > 1 ? 's' : ''} — needs attention`, {
      duration: 8000,
      id: 'sync-failed-toast',
    });
  }
}

// ─── Storage persistence warning ─────────────────────────────────────────────

const STORAGE_WARN_KEY = 'paradigm_storage_warn_shown';

/**
 * Shows a toast if durable storage was denied — at most once per 24 hours.
 * Called after a short delay to allow the storage.persist() Promise to resolve.
 * Keeps the toast layer (syncEngine) separate from the data layer (db.ts).
 */
function showStorageDenialToastIfNeeded(): void {
  // Do not display storage denial warning banner in local development or localhost testing
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return;
  }

  const state = getStoragePersistenceState();
  if (state !== false) return; // granted, or API unavailable — no toast needed

  const lastShown = localStorage.getItem(STORAGE_WARN_KEY);
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (lastShown && Date.now() - parseInt(lastShown, 10) < oneDayMs) return;

  localStorage.setItem(STORAGE_WARN_KEY, String(Date.now()));
  toast(
    '⚠️ Storage not guaranteed — install the app to protect offline data',
    {
      id: 'storage-persist-denied',
      duration: 10000,
      icon: '💾',
      style: { background: '#92400e', color: '#fef3c7', fontSize: '13px' },
    }
  );
}


// ─── Engine class ─────────────────────────────────────────────────────────────

class SyncEngine {
  private _running = false;
  private _cleanup: (() => void) | null = null;
  private _retryTimer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (!isOfflineEnabled()) return;
    if (this._running) return;
    this._running = true;

    await initNetworkStatus();

    // One-time migration of existing localStorage PPM drafts into IDB
    migrateLocalStoragePpmDrafts().catch(() => {});

    // Check storage persistence state after a short delay to allow
    // the navigator.storage.persist() Promise in db.ts to resolve first.
    setTimeout(showStorageDenialToastIfNeeded, 2000);

    // Drain immediately on start — picks up any items queued in a previous session
    if (isOnline()) {
      this._drain();
    }

    // Drain whenever the network reports reconnection
    this._cleanup = onStatusChange(async (online) => {
      if (online) {
        console.log('[SyncEngine] Network reconnected — starting drain');
        await this._drain();
      }
    });

    // ── Periodic background retry (every 5 minutes while online) ─────────────
    // Catches items that failed silently without a network-change event.
    this._retryTimer = setInterval(async () => {
      if (!isOnline()) return;
      const failedCount = await getFailedCount().catch(() => 0);
      const pendingCount = (await getPending().catch(() => [])).length;
      if (failedCount > 0 || pendingCount > 0) {
        console.log(`[SyncEngine] Periodic retry — ${pendingCount} pending, ${failedCount} failed`);
        await this._drain();
      }
    }, 5 * 60 * 1000); // every 5 minutes

    console.log('[SyncEngine] Started, listening for reconnects + 5-min periodic retry');
  }

  stop(): void {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
    if (this._retryTimer) {
      clearInterval(this._retryTimer);
      this._retryTimer = null;
    }
    this._running = false;
  }

  /** Public drain — e.g. called manually from a "Retry" button */
  async drain(): Promise<SyncResult> {
    return this._drain();
  }

  private _draining = false;

  private async _drain(): Promise<SyncResult> {
    if (this._draining || !isOnline()) return { synced: 0, failed: 0 };
    this._draining = true;

    try {
      const result = await drainOutbox();
      if (result.synced > 0 || result.failed > 0) {
        await showSyncToast(result);
      }
      return result;
    } finally {
      this._draining = false;
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const syncEngine = new SyncEngine();
