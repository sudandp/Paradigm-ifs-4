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
  markSyncing,
  markSynced,
  markFailed,
  getPhoto,
  deletePhoto,
  getFailedCount,
} from './outbox';
import { type OutboxItem, getStoragePersistenceState } from './db';
import { migrateLocalStoragePpmDrafts } from './cache';

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
  const storagePath = `documents/offline/${linkedToId}.${ext}`;

  const { error } = await supabase.storage
    .from('documents')
    .upload(storagePath, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });

  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
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

    // ── Step 3: Cleanup ───────────────────────────────────────────────────────
    await markSynced(item.id);
    if (item.photoId) {
      await deletePhoto(item.photoId).catch(() => {
        /* non-fatal */
      });
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

    // Drain immediately on start in case items were queued during a previous session
    if (isOnline()) {
      this._drain();
    }

    // Drain whenever we reconnect
    this._cleanup = onStatusChange(async (online) => {
      if (online) {
        console.log('[SyncEngine] Network reconnected — starting drain');
        await this._drain();
      }
    });

    console.log('[SyncEngine] Started and listening for reconnects');
  }

  stop(): void {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
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
