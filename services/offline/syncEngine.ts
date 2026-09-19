/**
 * Sync Engine — Paradigm FMS Offline Layer
 *
 * Listens for network reconnection and drains the outbox FIFO:
 *   1. Refreshes auth session before draining
 *   2. Uploads attachments with deterministic paths and per-file resume checkpoints
 *   3. Optimistic locking / conflict detection for versioned records
 *   4. Upsert the clean payload to target Supabase table
 *   5. On success  → markSynced (removes from IDB outbox)
 *   6. On failure  → markFailed (classified as network, auth, conflict, or permanent)
 *
 * Start once on app boot:
 *   const stop = syncEngine.start();
 */

import toast from 'react-hot-toast';
import { supabase } from '../supabase';
import { isDrainEnabled } from './featureFlag';
import { initNetworkStatus, isOnline, isReachable, onStatusChange } from './networkStatus';
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
  clearAllFailed,
  pruneStaleFailedItems,
  emitOutboxEvent,
} from './outbox';
import { getDb, type OutboxItem, type Attachment, getStoragePersistenceState } from './db';
import {
  migrateLocalStoragePpmDrafts,
  cacheSnagEntry,
  cachePpmExecution,
  cacheHtYardAudit,
  cacheOnboardingSubmission,
} from './cache';
import { api } from '../api';

// Lightweight sync user resolution (avoids heavy store import during startup/tests)
export function getCurrentUserId(): string | undefined {
  try {
    if (typeof localStorage !== 'undefined') {
      const authKey = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.includes('-auth-token'));
      if (authKey) {
        const raw = localStorage.getItem(authKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user?.id) return parsed.user.id;
        }
      }
    }
  } catch (err) {
    console.warn('[SyncEngine] Error reading auth token:', err);
  }
  return undefined;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
}

// ─── Helpers: Path Setting & Stripping ────────────────────────────────────────

function setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  const lastKey = parts[parts.length - 1];
  if (
    current[lastKey] &&
    typeof current[lastKey] === 'object' &&
    !Array.isArray(current[lastKey]) &&
    typeof value === 'string'
  ) {
    current[lastKey] = {
      ...current[lastKey],
      url: value,
      path: current[lastKey].path || value,
      preview: value,
    };
  } else {
    current[lastKey] = value;
  }
}

export const TABLE_COLUMN_ALLOWLIST: Record<string, readonly string[]> = {
  snag_audits: [
    'id',
    'timestamp',
    'email_address',
    'name_of_site',
    'purpose_of_visit',
    'department',
    'snag_picture_url',
    'snag_picture_name',
    'criticality',
    'snag_description',
    'action_to_be_taken',
    'remarks',
    'status',
    'submitted_by',
    'created_at',
    'client_revision',
  ],
  ppm_executions: [
    'id',
    'site_name',
    'reference_number',
    'category_id',
    'audit_date',
    'client_division',
    'status',
    'auditor_name',
    'organization_id',
    'observations',
    'summary_counts',
    'snag_ids',
    'photo_urls',
    'created_at',
    'client_revision',
  ],
  ht_yard_audits: [
    'id',
    'site_name',
    'reference_number',
    'audit_date',
    'client_division',
    'status',
    'auditor_name',
    'equipment_instances',
    'responses',
    'snag_items',
    'duplicated_stages',
    'audit_logs',
    'created_at',
    'client_revision',
  ],
  onboarding_submissions: [
    'id',
    'employee_id',
    'status',
    'portal_sync_status',
    'organization_id',
    'organization_name',
    'enrollment_date',
    'requires_manual_verification',
    'forms_generated',
    'created_user_id',
    'user_id',
    'personal',
    'address',
    'family',
    'education',
    'bank',
    'uan',
    'esi',
    'gmc',
    'organization',
    'uniforms',
    'biometrics',
    'salary_change_request',
    'verification_usage',
    'ismw_flags',
    'recruiter_gps',
    'fraud_check_result',
    'esign_request_id',
    'esign_document_url',
    'esign_signed_at',
    'esign_vendor',
    'kyc_vendor',
    'local_address',
    'languages',
    'osh_checklist',
    'compensation_flags',
    'shift_config',
    'badge_name',
    'verified_by',
    'verified_at',
    'verification_mode',
    'verified_by_photo',
    'submission_mode',
    'fcu_status',
    'fcu_acknowledged_by',
    'fcu_acknowledged_at',
    'fcu_verified_by',
    'fcu_verified_at',
    'fcu_notes',
    'created_at',
    'client_revision',
  ],
};

export function stripLocalFields(tableName: string, payload: Record<string, unknown>): Record<string, unknown> {
  const allowlist = TABLE_COLUMN_ALLOWLIST[tableName];
  if (allowlist) {
    const clean: Record<string, unknown> = {};
    for (const col of allowlist) {
      if (col in payload && payload[col] !== undefined) {
        clean[col] = payload[col];
      }
    }
    // updated_at is never sent in the write payload (the server trigger sets it freshly)
    delete clean.updated_at;
    return clean;
  }

  // Fallback for non-allowlisted tables
  const clean = { ...payload };
  delete clean.pending;
  delete clean.failed;
  delete clean.attempt_count;
  delete clean.next_attempt_at;
  delete clean.isNew;
  delete clean._localId;
  delete clean.updated_at;
  return clean;
}

// ─── Storage Upload Helpers ───────────────────────────────────────────────────

/**
 * Uploads an attachment Blob to Supabase Storage with deterministic upsert.
 */
async function uploadAttachmentBlob(
  blob: Blob,
  fileName: string,
  storagePath: string
): Promise<string> {
  const bucket = storagePath.startsWith('ht_yard') ? 'ht-yard-photos' : 'onboarding-documents';

  const { error } = await supabase.storage.from(bucket).upload(storagePath, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });

  if (error) {
    throw new Error(`Attachment upload failed (${error.message})`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  if (bucket === 'onboarding-documents') {
    try {
      await supabase.from('user_documents').insert({
        user_id: storagePath.split('/')[0] || null,
        name: fileName,
        bucket: 'onboarding-documents',
        path: storagePath,
        file_type: blob.type || 'image/jpeg',
        file_size: blob.size || 0,
      });
    } catch {
      // Best-effort registration
    }
  }

  return data.publicUrl;
}

/** Legacy single-photo upload fallback */
async function uploadPhotoBlob(
  blob: Blob,
  fileName: string,
  linkedToId: string,
  userId = 'anonymous'
): Promise<string> {
  const ext = fileName.split('.').pop() ?? 'jpg';
  const sanitized = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
  const storagePath = `${userId}/snags/${linkedToId}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('onboarding-documents').upload(storagePath, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });

  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  const { data } = supabase.storage.from('onboarding-documents').getPublicUrl(storagePath);
  return data.publicUrl;
}

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

// ─── Per-Item Sync ────────────────────────────────────────────────────────────

async function syncItem(item: OutboxItem): Promise<'synced' | 'failed'> {
  await markSyncing(item.id);

  try {
    const payload = { ...item.payload };

    // ── Step 1: Upload rich attachments with checkpointing ────────────────────
    if (item.attachments && item.attachments.length > 0) {
      const db = await getDb();
      for (const att of item.attachments) {
        if (att.uploadedUrl) {
          setNestedProperty(payload, att.payloadPath, att.uploadedUrl);
          continue;
        }

        const photo = await getPhoto(att.photoId);
        if (photo) {
          const publicUrl = await uploadAttachmentBlob(photo.blob, photo.fileName, att.storagePath);
          att.uploadedUrl = publicUrl;
          setNestedProperty(payload, att.payloadPath, publicUrl);

          // Checkpoint uploaded URL so crash doesn't re-upload
          await db.put('outbox', item);
        }
      }
    } else if (item.photoId) {
      // Legacy single photo
      const photo = await getPhoto(item.photoId);
      if (photo) {
        const publicUrl = await uploadPhotoBlob(photo.blob, photo.fileName, photo.linkedToId, item.userId || 'anonymous');
        payload.snag_picture_url = publicUrl;
        payload.snag_picture_name = photo.fileName;
      }
    } else if (
      typeof payload.snag_picture_url === 'string' &&
      payload.snag_picture_url.startsWith('data:')
    ) {
      // Base64 Data URL fallback
      try {
        const res = await fetch(payload.snag_picture_url);
        const blob = await res.blob();
        const fileName = (payload.snag_picture_name as string) || 'snag_photo.jpg';
        const publicUrl = await uploadPhotoBlob(blob, fileName, item.id, item.userId || 'anonymous');
        payload.snag_picture_url = publicUrl;
      } catch (dataUrlErr) {
        console.warn('[SyncEngine] Failed to upload base64 fallback photo:', dataUrlErr);
      }
    }

    // ── Step 2: Strip local-only fields before sending to Supabase ────────────
    const cleanPayload = stripLocalFields(item.tableName, payload);

    // ── Step 3: Concurrency & Lost-Response Retry Conflict Matching ───────────
    if (item.baseUpdatedAt && item.action !== 'DELETE') {
      const { data: serverRecord, error: checkError } = await supabase
        .from(item.tableName)
        .select('id, updated_at, client_revision')
        .eq('id', item.id)
        .maybeSingle();

      if (checkError) {
        console.warn(`[SyncEngine] Pre-sync version check error for ${item.tableName}/${item.id}:`, checkError.message);
      } else if (serverRecord && serverRecord.updated_at !== item.baseUpdatedAt) {
        // Concurrency mismatch! Check if server already has our client_revision (lost response on previous attempt)
        const isOurRevision =
          (cleanPayload.client_revision && serverRecord.client_revision === cleanPayload.client_revision) ||
          (item.priorRevisions && item.priorRevisions.includes(serverRecord.client_revision));

        if (isOurRevision) {
          // This write ALREADY committed on the server in a previous attempt whose response dropped!
          console.log(`[SyncEngine] Retry match: client_revision ${serverRecord.client_revision} already committed on ${item.tableName}. Marking synced.`);
          await markSynced(item.id);
          await updateLocalCacheAfterSync(item.tableName, cleanPayload, serverRecord.updated_at, serverRecord.client_revision);
          return 'synced';
        }

        // Real conflict: server modified by another user
        const conflictMsg = `Conflict detected: server version (${serverRecord.updated_at}) differs from local base version (${item.baseUpdatedAt})`;
        await markFailed(item.id, { kind: 'conflict', message: conflictMsg });
        return 'failed';
      }
    }

    // ── Step 4: Upsert / Delete in Supabase ───────────────────────────────────
    let returnedUpdatedAt: string | undefined;
    let returnedClientRevision: string | undefined;

    if (item.action === 'DELETE') {
      const { error } = await supabase
        .from(item.tableName)
        .delete()
        .eq('id', item.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: upsertData, error } = await supabase
        .from(item.tableName)
        .upsert(cleanPayload, { onConflict: 'id' })
        .select('id, updated_at, client_revision')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (upsertData) {
        returnedUpdatedAt = upsertData.updated_at;
        returnedClientRevision = upsertData.client_revision;
      }
    }

    // ── Step 5: Cleanup & Local Domain Cache Update ───────────────────────────
    await markSynced(item.id);

    if (item.photoId) {
      await deletePhoto(item.photoId).catch(() => {});
    }
    if (item.attachments) {
      for (const att of item.attachments) {
        await deletePhoto(att.photoId).catch(() => {});
      }
    }

    // Write returned updated_at and client_revision back into local cache to prevent self-conflict on next edit
    await updateLocalCacheAfterSync(item.tableName, cleanPayload, returnedUpdatedAt, returnedClientRevision);

    return 'synced';
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Unknown sync error';
    await markFailed(item.id, reason);
    console.error(`[SyncEngine] Failed to sync item ${item.id}:`, reason);
    return 'failed';
  }
}

async function updateLocalCacheAfterSync(
  tableName: string,
  cleanPayload: Record<string, unknown>,
  updatedAt?: string,
  clientRevision?: string
): Promise<void> {
  const merged: Record<string, unknown> = {
    ...cleanPayload,
    ...(updatedAt ? { updated_at: updatedAt } : {}),
    ...(clientRevision ? { client_revision: clientRevision } : {}),
    pending: false,
    failed: false,
  };

  if (tableName === 'snag_audits') {
    try {
      const camelEntry = api.toCamelCase ? api.toCamelCase(merged) : merged;
      if (updatedAt) (camelEntry as any).updatedAt = updatedAt;
      await cacheSnagEntry(camelEntry as any);
    } catch (cacheErr) {
      console.warn('[SyncEngine] Failed to update local snag cache after sync:', cacheErr);
    }
  } else if (tableName === 'ppm_executions') {
    try {
      await cachePpmExecution(merged as any);
    } catch (cacheErr) {
      console.warn('[SyncEngine] Failed to update PPM cache after sync:', cacheErr);
    }
  } else if (tableName === 'ht_yard_audits') {
    try {
      await cacheHtYardAudit(merged as any);
    } catch (cacheErr) {
      console.warn('[SyncEngine] Failed to update HT Yard cache after sync:', cacheErr);
    }
  } else if (tableName === 'onboarding_submissions') {
    try {
      await cacheOnboardingSubmission(merged as any);
    } catch (cacheErr) {
      console.warn('[SyncEngine] Failed to update onboarding submission cache after sync:', cacheErr);
    }
  }
}

// ─── Drain Loop with Auth & Reachability ──────────────────────────────────────

async function drainOutbox(isManual = false): Promise<SyncResult> {
  await pruneStaleFailedItems().catch(() => {});

  if (isManual) {
    try {
      const failedItems = await getFailed();
      if (failedItems.length > 0) {
        console.log(`[SyncEngine] Manual retry of ${failedItems.length} previously-failed item(s)…`);
        await Promise.all(failedItems.map((item) => retryFailedItem(item.id)));
      }
    } catch (retryErr) {
      console.warn('[SyncEngine] Manual retry reset error (non-fatal):', retryErr);
    }
  }

  // Identify current user to isolate drains on shared devices
  const currentUserId = getCurrentUserId();
  const pending = await getPending(currentUserId);
  if (pending.length === 0) {
    const totalFailed = await getFailedCount(currentUserId).catch(() => 0);
    if (totalFailed === 0) {
      toast.dismiss('sync-failed-toast');
    }
    emitOutboxEvent({ type: 'drained', timestamp: Date.now() });
    return { synced: 0, failed: 0 };
  }

  // Pre-drain reachability check
  const reachable = await isReachable(3000);
  if (!reachable) {
    console.debug('[SyncEngine] Backend not reachable; holding drain.');
    return { synced: 0, failed: 0 };
  }

  // Pre-drain session validation & token refresh
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData?.session) {
      console.warn('[SyncEngine] No active auth session before drain; pausing items.');
      for (const item of pending) {
        await markFailed(item.id, { kind: 'auth', message: 'Authentication required' });
      }
      return { synced: 0, failed: pending.length };
    }

    const expiresAt = sessionData.session.expires_at;
    const nowSec = Math.floor(Date.now() / 1000);
    if (expiresAt && expiresAt - nowSec < 60) {
      console.log('[SyncEngine] Token expiring in <60s; refreshing session...');
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.warn('[SyncEngine] Token refresh failed:', refreshErr.message);
        for (const item of pending) {
          await markFailed(item.id, { kind: 'auth', message: `Token refresh failed: ${refreshErr.message}` });
        }
        return { synced: 0, failed: pending.length };
      }
    }
  } catch (authErr) {
    console.warn('[SyncEngine] Auth check exception:', authErr);
  }

  console.log(`[SyncEngine] Draining ${pending.length} pending items…`);

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await syncItem(item);
    if (result === 'synced') synced++;
    else failed++;
  }

  emitOutboxEvent({ type: 'drained', timestamp: Date.now() });
  return { synced, failed };
}

// ─── Toast Summary ────────────────────────────────────────────────────────────

async function showSyncToast(result: SyncResult, isManual = false): Promise<void> {
  const currentUserId = getCurrentUserId();
  const totalFailed = await getFailedCount(currentUserId);

  if (totalFailed === 0) {
    toast.dismiss('sync-failed-toast');
  }

  if (result.synced > 0 && totalFailed === 0) {
    toast.success(`✅ ${result.synced} item${result.synced > 1 ? 's' : ''} synced successfully`, {
      duration: 3000,
    });
  } else if (result.synced > 0 && totalFailed > 0) {
    toast.success(`✅ ${result.synced} synced (${totalFailed} need attention)`, { duration: 3000 });
  } else if (isManual && (result.failed > 0 || totalFailed > 0)) {
    toast.error(`⚠️ ${totalFailed} sync item${totalFailed > 1 ? 's' : ''} need attention`, {
      duration: 4000,
      id: 'sync-failed-toast',
    });
  }
}

// ─── Storage Persistence Warning ──────────────────────────────────────────────

const STORAGE_WARN_KEY = 'paradigm_storage_warn_shown';

function showStorageDenialToastIfNeeded(): void {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return;
  }

  const state = getStoragePersistenceState();
  if (state !== false) return;

  const lastShown = localStorage.getItem(STORAGE_WARN_KEY);
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (lastShown && Date.now() - parseInt(lastShown, 10) < oneDayMs) return;

  localStorage.setItem(STORAGE_WARN_KEY, String(Date.now()));
  toast('⚠️ Storage not guaranteed — install app to protect offline data', {
    id: 'storage-persist-denied',
    duration: 10000,
    icon: '💾',
    style: { background: '#92400e', color: '#fef3c7', fontSize: '13px' },
  });
}

// ─── Engine Class ─────────────────────────────────────────────────────────────

class SyncEngine {
  private _running = false;
  private _cleanup: (() => void) | null = null;
  private _retryTimer: ReturnType<typeof setInterval> | null = null;
  private _draining = false;

  /**
   * Starts the sync engine. Idempotent. Returns a cleanup function for React useEffect.
   */
  start(): () => void {
    if (!isDrainEnabled()) return () => {};
    if (this._running) return () => this.stop();
    this._running = true;

    this._startAsync().catch((err) => {
      console.warn('[SyncEngine] Startup warning:', err);
    });

    return () => this.stop();
  }

  private async _startAsync(): Promise<void> {
    await initNetworkStatus();
    await pruneStaleFailedItems().catch(() => {});
    toast.dismiss('sync-failed-toast');

    migrateLocalStoragePpmDrafts().catch(() => {});
    setTimeout(showStorageDenialToastIfNeeded, 2000);

    if (isOnline()) {
      this._drain(false);
    }

    this._cleanup = onStatusChange(async (online) => {
      if (online) {
        console.log('[SyncEngine] Network reconnected — initiating drain');
        await this._drain(false);
      }
    });

    this._retryTimer = setInterval(async () => {
      if (!isOnline()) return;
      const currentUserId = getCurrentUserId();
      const pendingCount = (await getPending(currentUserId).catch(() => [])).length;
      if (pendingCount > 0) {
        console.log(`[SyncEngine] Periodic retry — ${pendingCount} pending`);
        await this._drain(false);
      }
    }, 5 * 60 * 1000);

    console.log('[SyncEngine] Started with cross-tab WebLock + token refresh');
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

  /** Public manual drain trigger */
  async drain(): Promise<SyncResult> {
    return this._drain(true);
  }

  async clearAllFailed(): Promise<number> {
    const count = await clearAllFailed();
    toast.dismiss('sync-failed-toast');
    return count;
  }

  private async _drain(isManual = false): Promise<SyncResult> {
    if (this._draining || !isOnline()) return { synced: 0, failed: 0 };

    // Cross-tab concurrency guard using Web Locks API
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      return await (navigator as any).locks.request(
        'outbox-drain',
        { ifAvailable: true },
        async (lock: any) => {
          if (!lock) {
            console.debug('[SyncEngine] Another tab holds outbox-drain lock. Skipping.');
            return { synced: 0, failed: 0 };
          }
          return this._drainInner(isManual);
        }
      );
    }

    return this._drainInner(isManual);
  }

  private async _drainInner(isManual: boolean): Promise<SyncResult> {
    this._draining = true;
    try {
      const result = await drainOutbox(isManual);
      if (result.synced > 0 || (isManual && result.failed > 0)) {
        await showSyncToast(result, isManual);
      }
      return result;
    } finally {
      this._draining = false;
    }
  }
}

// ─── Singleton & Aliases ──────────────────────────────────────────────────────

export const syncEngine = new SyncEngine();
export const syncNow = () => syncEngine.drain();
