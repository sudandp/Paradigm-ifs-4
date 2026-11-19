import { withIdbTransaction } from './idbTransaction';
/**
 * Outbox — Paradigm FMS Offline Layer
 *
 * All offline mutations are written here first.
 * The sync engine reads pending items and uploads them on reconnect.
 *
 * Status lifecycle:
 *   pending → syncing → synced       (success, row deleted from IDB outbox)
 *                     → failed       (permanent / validation / RLS error — visible in "Needs attention")
 *                     → conflict     (version mismatch — preserved for visual resolution)
 *                     → auth_paused  (401 / session expired — held until re-login)
 */

import { getDb, type OutboxItem, type OutboxAction, type OutboxStatus, type Attachment, type OutboxError, type StoredPhoto } from './db';

export type { OutboxItem, OutboxAction, OutboxStatus, Attachment, OutboxError, StoredPhoto };

// ─── Real-Time Event Emitter ──────────────────────────────────────────────────

export type OutboxEventType =
  | 'enqueued'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict'
  | 'auth_paused'
  | 'drained';

export interface OutboxEvent {
  type: OutboxEventType;
  item?: OutboxItem;
  timestamp: number;
}

type OutboxEventListener = (event: OutboxEvent) => void;
const _listeners = new Set<OutboxEventListener>();

export function emitOutboxEvent(event: OutboxEvent): void {
  _listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.warn('[Outbox] Listener error:', e);
    }
  });
}

/**
 * Subscribe to real-time outbox mutation events.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeOutbox(listener: OutboxEventListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// ─── Enqueue with True Coalescing ─────────────────────────────────────────────

export interface EnqueueParams {
  /** Client-generated UUID — must be the record's permanent ID */
  id: string;
  tableName: string;
  action?: OutboxAction;
  payload: Record<string, unknown>;
  /** Legacy single photo ID */
  photoId?: string;
  /** Rich multi-attachment list */
  attachments?: Attachment[];
  /** Server version for optimistic locking / conflict detection */
  baseUpdatedAt?: string;
  /** Prior client revision tokens preserved across coalesces */
  priorRevisions?: string[];
  /** Schema shape version for migration compatibility */
  schemaVersion?: number;
  /** Owner user ID for device isolation */
  userId?: string;
  /** Organization ID for multi-tenant device isolation */
  orgId?: string;
  /** Device ISO timestamp */
  capturedAt?: string;
  /** Optional parent record ID for dependency-ordered sync */
  dependsOn?: string;
}

export async function enqueue(params: EnqueueParams): Promise<OutboxItem> {
  const db = await getDb();
  const existing = await db.get('outbox', params.id);

  // If item already exists and is pending/failed/conflict, coalesce with latest payload
  let createdAt = Date.now();
  let baseUpdatedAt = params.baseUpdatedAt;
  const revisionsSet = new Set<string>(params.priorRevisions || []);
  let finalAttachments = params.attachments;
  let finalPhotoId = params.photoId;
  let finalPayload = params.payload;

  if (existing) {
    createdAt = existing.createdAt; // Preserve FIFO queue ordering
    baseUpdatedAt = existing.baseUpdatedAt || params.baseUpdatedAt;

    // Retain all prior revisions from previous saves of this item
    if (existing.priorRevisions) {
      existing.priorRevisions.forEach((r) => revisionsSet.add(r));
    }
    const oldRev = existing.payload?.client_revision as string | undefined;
    if (oldRev) {
      revisionsSet.add(oldRev);
    }

    // Attachment coalescing (Audit Finding 06):
    // If new attachments are NOT specified (e.g. text or status edit), preserve existing attachments!
    if (params.attachments === undefined && existing.attachments) {
      finalAttachments = existing.attachments;
    } else if (existing.attachments && params.attachments) {
      // Replace only attachments for matching payloadPath; clean up orphaned blobs
      const newPaths = new Set(params.attachments.map((a) => a.payloadPath));
      const newPhotoIds = new Set(params.attachments.map((a) => a.photoId));
      for (const oldAtt of existing.attachments) {
        if (newPaths.has(oldAtt.payloadPath) && !newPhotoIds.has(oldAtt.photoId)) {
          await db.delete('photos', oldAtt.photoId).catch(() => {});
        }
      }
      const preserved = existing.attachments.filter((a) => !newPaths.has(a.payloadPath));
      finalAttachments = [...preserved, ...params.attachments];
    }

    // PhotoId coalescing (Audit Finding 06):
    if (params.photoId === undefined && existing.photoId) {
      finalPhotoId = existing.photoId;
    } else if (params.photoId && existing.photoId && existing.photoId !== params.photoId) {
      // Only delete old photo if explicitly replaced by a new defined photoId
      await db.delete('photos', existing.photoId).catch(() => {});
    }

    // Payload coalescing: preserve existing photo URLs and details on text/status partial updates
    if (existing.payload && params.payload) {
      finalPayload = {
        ...existing.payload,
        ...params.payload,
      };
      if (existing.payload.snag_picture_url && !params.payload.snag_picture_url) {
        finalPayload.snag_picture_url = existing.payload.snag_picture_url;
      }
      if (existing.payload.snag_picture_name && !params.payload.snag_picture_name) {
        finalPayload.snag_picture_name = existing.payload.snag_picture_name;
      }
      if (existing.payload.photo_urls && !params.payload.photo_urls) {
        finalPayload.photo_urls = existing.payload.photo_urls;
      }
    }
  }

  const priorRevisions = Array.from(revisionsSet).filter(Boolean);

  const item: OutboxItem = {
    id: params.id,
    recordId: params.id,
    tableName: params.tableName,
    action: params.action || 'UPSERT',
    payload: finalPayload,
    photoId: finalPhotoId,
    attachments: finalAttachments,
    baseUpdatedAt,
    priorRevisions: priorRevisions.length > 0 ? priorRevisions : undefined,
    schemaVersion: params.schemaVersion || 1,
    userId: params.userId,
    orgId: params.orgId,
    capturedAt: params.capturedAt || new Date().toISOString(),
    status: 'pending',
    createdAt,
    attempts: 0,
    failureReason: undefined,
    lastError: undefined,
    nextAttemptAt: undefined,
    dependsOn: params.dependsOn,
  };

  await db.put('outbox', item);

  // If shadow-write mode is active (Phase 2A safety protocol), mirror to storage repository
  try {
    const { isShadowWriteEnabled } = await import('./migrationJournal');
    if (isShadowWriteEnabled()) {
      const { getStorageRepository } = await import('./storageRepository');
      await getStorageRepository().enqueueOutbox(item);
    }
  } catch (err) {
    console.warn('[Outbox] Shadow write error (non-fatal):', err);
  }

  console.debug(`[Outbox] Enqueued ${item.action} → ${item.tableName} (id=${params.id})`);
  emitOutboxEvent({ type: 'enqueued', item, timestamp: Date.now() });
  return item;
}

// ─── Read & Query ─────────────────────────────────────────────────────────────

function getCurrentUserFromStorage(): string | undefined {
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
      const zustandAuth = localStorage.getItem('paradigm-auth-storage') || localStorage.getItem('auth-storage');
      if (zustandAuth) {
        const parsed = JSON.parse(zustandAuth);
        if (parsed?.state?.user?.id) return parsed.state.user.id;
      }
    }
  } catch {}
  return undefined;
}

/** Checks if any pending or failed outbox item still references a given photo ID. */
export async function isPhotoReferenced(photoId: string, excludeRecordId?: string): Promise<boolean> {
  const db = await getDb();
  const all = await db.getAll('outbox');
  for (const item of all) {
    if (excludeRecordId && item.id === excludeRecordId) continue;
    if (item.photoId === photoId) return true;
    if (item.attachments?.some((a) => a.photoId === photoId)) return true;
  }
  return false;
}

/** Returns all pending items ordered by createdAt (FIFO) whose nextAttemptAt has passed. */
export async function getPending(userId?: string): Promise<OutboxItem[]> {
  const db = await getDb();
  let all: OutboxItem[];
  if (userId) {
    try {
      all = await db.getAllFromIndex('outbox', 'by-user', userId);
    } catch {
      all = await db.getAll('outbox');
      all = all.filter((i) => i.userId === userId);
    }
    // Strictly isolate by userId - never automatically pull unmapped or unowned items
    // into another user's drain batch (V05 & Security Boundary).
    all = all.filter((i) => i.userId === userId);
  } else {
    all = await db.getAllFromIndex('outbox', 'by-status', 'pending');
  }

  const now = Date.now();
  return all
    .filter((item) => item.status === 'pending' && (!item.nextAttemptAt || item.nextAttemptAt <= now))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Returns all items with status `failed`. */
export async function getFailed(userId?: string): Promise<OutboxItem[]> {
  const db = await getDb();
  let all: OutboxItem[];
  if (userId) {
    try {
      all = await db.getAllFromIndex('outbox', 'by-user', userId);
    } catch {
      all = await db.getAll('outbox');
      all = all.filter((i) => i.userId === userId);
    }
    all = all.filter((i) => i.userId === userId);
  } else {
    all = await db.getAll('outbox');
  }

  return all.filter((item) => item.status === 'failed');
}

export async function getFailedCount(userId?: string): Promise<number> {
  return (await getFailed(userId)).length;
}

/** Returns a single outbox item by record ID. */
export async function getItem(id: string): Promise<OutboxItem | undefined> {
  const db = await getDb();
  return db.get('outbox', id);
}

/** Returns ALL outbox items (any status) — optionally filtered by user. */
export async function getAll(userId?: string): Promise<OutboxItem[]> {
  const db = await getDb();
  let all = await db.getAll('outbox');
  if (userId) {
    all = all.filter((i) => !i.userId || i.userId === userId);
  }
  return all;
}

/** Returns outbox items for a specific table — optionally filtered by user. */
export async function getForTable(tableName: string, userId?: string): Promise<OutboxItem[]> {
  const all = await getAll(userId);
  return all.filter((i) => i.tableName === tableName);
}

export interface OutboxSummary {
  pending: number;
  syncing: number;
  failed: number;
  conflict: number;
  authPaused: number;
  total: number;
}

export async function getOutboxSummary(userId?: string): Promise<OutboxSummary> {
  const all = await getAll(userId);
  const summary: OutboxSummary = {
    pending: 0,
    syncing: 0,
    failed: 0,
    conflict: 0,
    authPaused: 0,
    total: all.length,
  };
  for (const item of all) {
    if (item.status === 'pending') summary.pending++;
    else if (item.status === 'syncing') summary.syncing++;
    else if (item.status === 'failed') summary.failed++;
    else if (item.status === 'conflict') summary.conflict++;
    else if (item.status === 'auth_paused') summary.authPaused++;
  }
  return summary;
}

// ─── Status Updates & Error Classification ────────────────────────────────────

export async function markSyncing(id: string, leaseDurationMs = 2 * 60 * 1000): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;
  const updated: OutboxItem = {
    ...item,
    status: 'syncing',
    leaseExpiresAt: Date.now() + leaseDurationMs,
  };
  await db.put('outbox', updated);
  emitOutboxEvent({ type: 'syncing', item: updated, timestamp: Date.now() });
}

export async function markSynced(id: string, acknowledgedRevision?: string): Promise<'deleted' | 'preserved' | 'not_found'> {
  const result = await withIdbTransaction(['outbox'], 'readwrite', async (db) => {
    let current: OutboxItem | undefined = await db.get('outbox', id);
    if (!current) return { status: 'not_found' as const };
    const initialRev = current.payload?.client_revision;
    if (initialRev && initialRev !== acknowledgedRevision) {
      const updated: OutboxItem = { ...current, status: 'pending', attempts: 0, leaseExpiresAt: undefined };
      await db.put('outbox', updated);
      return { status: 'preserved' as const, item: updated };
    }

    // Atomic CAS verification loop: ensure no concurrent write has committed
    // an updated revision before proceeding with outbox deletion.
    for (let check = 0; check < 3; check++) {
      const verify: OutboxItem | undefined = await db.get('outbox', id);
      if (!verify) return { status: 'not_found' as const };
      const verifyRev = verify.payload?.client_revision;
      if (verifyRev && verifyRev !== acknowledgedRevision) {
        const updated: OutboxItem = { ...verify, status: 'pending', attempts: 0, leaseExpiresAt: undefined };
        await db.put('outbox', updated);
        return { status: 'preserved' as const, item: updated };
      }
    }

    await db.delete('outbox', id);
    return { status: 'deleted' as const, item: current };
  });
  if (result.item) emitOutboxEvent({
    type: result.status === 'deleted' ? 'synced' : 'enqueued',
    item: result.item, timestamp: Date.now(),
  });
  return result.status;
}

/**
 * Recovers items stuck in 'syncing' status whose lease has expired (e.g. from an app crash
 * or background kill mid-upload). Resets them back to 'pending' so they can be processed on next reconnect/drain.
 */
export async function recoverStuckSyncingItems(maxAgeMs = 2 * 60 * 1000): Promise<number> {
  const db = await getDb();
  const all = await db.getAll('outbox');
  const now = Date.now();
  let recoveredCount = 0;

  for (const item of all) {
    if (item.status === 'syncing') {
      const isExpired = item.leaseExpiresAt ? item.leaseExpiresAt <= now : (now - (item.createdAt || 0) > maxAgeMs);
      if (isExpired) {
        const updated: OutboxItem = {
          ...item,
          status: 'pending',
          leaseExpiresAt: undefined,
        };
        await db.put('outbox', updated);
        recoveredCount++;
        emitOutboxEvent({ type: 'enqueued', item: updated, timestamp: now });
      }
    }
  }

  if (recoveredCount > 0) {
    console.warn(`[Outbox] Auto-recovered ${recoveredCount} stuck 'syncing' item(s) back to pending.`);
  }
  return recoveredCount;
}

/**
 * Resumes items in 'auth_paused' status for the specified authenticated user.
 */
export async function resumeAuthPausedItems(userId: string): Promise<number> {
  if (!userId) return 0;
  const db = await getDb();
  const all = await db.getAll('outbox');
  const now = Date.now();
  let resumed = 0;

  for (const item of all) {
    if (item.status === 'auth_paused' && item.userId === userId) {
      const updated: OutboxItem = {
        ...item,
        status: 'pending',
        attempts: 0,
        userId: userId,
        failureReason: undefined,
        lastError: undefined,
      };
      await db.put('outbox', updated);
      resumed++;
      emitOutboxEvent({ type: 'enqueued', item: updated, timestamp: now });
    }
  }

  if (resumed > 0) {
    console.log(`[Outbox] Resumed ${resumed} auth-paused item(s) for user ${userId}`);
  }
  return resumed;
}

/** Removes an outbox item for a record when an online save succeeds. */
export async function removeForRecord(tableName: string, recordId: string, currentRevision?: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('outbox', recordId);
  if (existing && existing.tableName === tableName) {
    const existingRevision = (existing.payload?.client_revision as string) || undefined;
    if (currentRevision && existingRevision && existingRevision !== currentRevision) {
      console.log(`[Outbox] Preserving newer outbox revision (${existingRevision}) for record ${recordId} after online save of ${currentRevision}`);
      return;
    }
    if (existing.photoId && !(await isPhotoReferenced(existing.photoId, recordId))) {
      await db.delete('photos', existing.photoId).catch(() => {});
    }
    if (existing.attachments) {
      for (const att of existing.attachments) {
        if (!(await isPhotoReferenced(att.photoId, recordId))) {
          await db.delete('photos', att.photoId).catch(() => {});
        }
      }
    }
    await db.delete('outbox', recordId);
    emitOutboxEvent({ type: 'synced', item: existing, timestamp: Date.now() });
  }
}

export async function markFailed(
  id: string,
  errorInput: string | Error | OutboxError,
  maxAttempts?: number
): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;

  const nextAttempts = item.attempts + 1;

  // Extract structured error kind and message
  let errorObj: OutboxError;
  if (typeof errorInput === 'string') {
    const isAuth = /401|jwt|expired token|invalid token|unauthorized/i.test(errorInput);
    const isConflict = /conflict|version mismatch|out of date/i.test(errorInput);
    const isTransient = /network|offline|timeout|fetch|connection|socket|502|503|504|429|econnreset|etimedout/i.test(errorInput);

    if (isAuth) {
      errorObj = { kind: 'auth', message: errorInput };
    } else if (isConflict) {
      errorObj = { kind: 'conflict', message: errorInput };
    } else if (isTransient) {
      errorObj = { kind: 'network', message: errorInput };
    } else {
      errorObj = { kind: 'permanent', message: errorInput };
    }
  } else if (errorInput instanceof Error) {
    const isAuth = /401|jwt|expired|unauthorized/i.test(errorInput.message);
    const isConflict = /conflict|version mismatch/i.test(errorInput.message);
    const isTransient = /network|offline|timeout|fetch|connection|socket|502|503|504|429/i.test(errorInput.message);
    const kind = isAuth ? 'auth' : isConflict ? 'conflict' : isTransient ? 'network' : 'permanent';
    errorObj = { kind, message: errorInput.message };
  } else {
    errorObj = errorInput;
  }

  if (errorObj.kind === 'network') {
    if (maxAttempts !== undefined && nextAttempts >= maxAttempts) {
      const updated: OutboxItem = {
        ...item,
        status: 'failed',
        attempts: nextAttempts,
        failureReason: errorObj.message,
        lastError: errorObj,
        nextAttemptAt: undefined,
      };
      await db.put('outbox', updated);
      console.warn(`[Outbox] Permanently marked failed (max attempts ${maxAttempts} reached): ${id}`);
      emitOutboxEvent({ type: 'failed', item: updated, timestamp: Date.now() });
      return;
    }

    // Retryable with exponential backoff (2s, 4s, 8s, 16s, 32s, max 5m)
    const baseDelay = 2000;
    const expDelay = Math.min(baseDelay * Math.pow(2, nextAttempts - 1), 300000);
    const updated: OutboxItem = {
      ...item,
      status: 'pending',
      attempts: nextAttempts,
      failureReason: errorObj.message,
      lastError: errorObj,
      nextAttemptAt: Date.now() + expDelay,
    };
    await db.put('outbox', updated);
    console.warn(`[Outbox] Transient network failure (attempt ${nextAttempts}), retrying in ${Math.round(expDelay)}ms: ${id}`);
    emitOutboxEvent({ type: 'failed', item: updated, timestamp: Date.now() });
  } else if (errorObj.kind === 'auth') {
    // Auth error: pause item until session is refreshed/re-authenticated
    const updated: OutboxItem = {
      ...item,
      status: 'auth_paused',
      attempts: nextAttempts,
      failureReason: errorObj.message,
      lastError: errorObj,
      nextAttemptAt: undefined,
    };
    await db.put('outbox', updated);
    console.warn(`[Outbox] Auth paused on item ${id}: ${errorObj.message}`);
    emitOutboxEvent({ type: 'auth_paused', item: updated, timestamp: Date.now() });
  } else if (errorObj.kind === 'conflict') {
    // Conflict error: retain item for visual review
    const updated: OutboxItem = {
      ...item,
      status: 'conflict',
      attempts: nextAttempts,
      failureReason: errorObj.message,
      lastError: errorObj,
      nextAttemptAt: undefined,
    };
    await db.put('outbox', updated);
    console.warn(`[Outbox] Conflict detected on item ${id}: ${errorObj.message}`);
    emitOutboxEvent({ type: 'conflict', item: updated, timestamp: Date.now() });
  } else {
    // Permanent error (RLS denial, schema mismatch, validation error)
    const updated: OutboxItem = {
      ...item,
      status: 'failed',
      attempts: nextAttempts,
      failureReason: errorObj.message,
      lastError: errorObj,
      nextAttemptAt: undefined,
    };
    await db.put('outbox', updated);
    console.warn(`[Outbox] Permanently marked failed (attempt ${nextAttempts}${maxAttempts ? `/${maxAttempts}` : ''}): ${id} — ${errorObj.message}`);
    emitOutboxEvent({ type: 'failed', item: updated, timestamp: Date.now() });
  }
}

/** Resets a failed, conflict, or auth_paused item back to pending for immediate manual retry. */
export async function retryFailedItem(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;
  const updated: OutboxItem = {
    ...item,
    status: 'pending',
    attempts: 0,
    failureReason: undefined,
    lastError: undefined,
    nextAttemptAt: undefined,
  };
  await db.put('outbox', updated);
  console.log(`[Outbox] Reset item for manual retry: ${id}`);
  emitOutboxEvent({ type: 'enqueued', item: updated, timestamp: Date.now() });
}

/** Discards an outbox item, deleting it from outbox, photo store, and target IDB cache. */
export async function discardFailedItem(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;

  if (item.photoId) {
    await db.delete('photos', item.photoId).catch(() => {});
  }
  if (item.attachments) {
    for (const att of item.attachments) {
      await db.delete('photos', att.photoId).catch(() => {});
    }
  }

  // Also remove from local IDB domain cache
  if (item.tableName === 'snag_audits') {
    const { deleteSnagEntryFromCache } = await import('./cache');
    await deleteSnagEntryFromCache(id).catch(() => {});
  } else if (item.tableName === 'ht_yard_audits') {
    const { deleteHtYardAuditFromCache } = await import('./cache');
    await deleteHtYardAuditFromCache(id).catch(() => {});
  } else if (item.tableName === 'ppm_executions') {
    const { deletePpmExecutionFromCache } = await import('./cache');
    await deletePpmExecutionFromCache(id).catch(() => {});
  } else if (item.tableName === 'onboarding_submissions') {
    const { deleteOnboardingSubmissionFromCache } = await import('./cache');
    await deleteOnboardingSubmissionFromCache(id).catch(() => {});
  }

  await db.delete('outbox', id);
  console.log(`[Outbox] Discarded item and cleaned cache: ${id}`);
  emitOutboxEvent({ type: 'synced', item: { ...item, status: 'synced' }, timestamp: Date.now() });
}

/** Discards all currently failed items from the outbox for the active account (V12). */
export async function clearAllFailed(userId?: string): Promise<number> {
  const currentUid = userId || getCurrentUserFromStorage();
  if (!currentUid || currentUid === 'anonymous' || currentUid === '00000000-0000-0000-0000-000000000000') return 0;
  const failed = await getFailed(currentUid);
  for (const item of failed) {
    await discardFailedItem(item.id);
  }
  console.log(`[Outbox] Cleared ${failed.length} failed items for user ${currentUid || 'all'}`);
  return failed.length;
}

/**
 * In accordance with Offline Hardening Plan Phase 1 & Audit Finding 02:
 * Automatic deletion of failed records & photos is disabled to prevent permanent data loss.
 * Failed items remain preserved in the outbox for user inspection, retry, or explicit manual discard.
 */
export async function pruneStaleFailedItems(_maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  // Retain all failed records and attachments. They are never automatically purged without explicit user action.
  return 0;
}

/** Cancels a local-only item for the given ID without sending a DELETE to Supabase. */
export async function cancelPendingInsert(id: string): Promise<boolean> {
  const db = await getDb();
  const item = await db.get('outbox', id);

  const isCancellable =
    item &&
    (item.action === 'INSERT' || item.action === 'UPSERT') &&
    (item.status === 'pending' || item.status === 'failed');

  if (!isCancellable) {
    return false;
  }

  if (item.photoId) {
    await db.delete('photos', item.photoId).catch(() => {});
  }
  if (item.attachments) {
    for (const att of item.attachments) {
      await db.delete('photos', att.photoId).catch(() => {});
    }
  }

  await db.delete('outbox', id);
  console.debug(`[Outbox] Cancelled local item (status=${item.status}) for id=${id}`);
  emitOutboxEvent({ type: 'synced', item: { ...item, status: 'synced' }, timestamp: Date.now() });
  return true;
}

// ─── Attachment & Photo Helpers ───────────────────────────────────────────────

/** Stores an attachment blob in IDB and returns an Attachment reference */
export async function storeAttachment(
  blob: Blob,
  payloadPath: string,
  storagePath: string
): Promise<Attachment> {
  const db = await getDb();
  const photoId = crypto.randomUUID();
  const photo: StoredPhoto = {
    id: photoId,
    blob,
    fileName: storagePath.split('/').pop() || 'attachment.jpg',
    linkedToId: storagePath,
    createdAt: Date.now(),
  };
  await db.put('photos', photo);
  return {
    photoId,
    payloadPath,
    storagePath,
  };
}

export async function storePhoto(
  blob: Blob,
  fileName: string,
  linkedToId: string
): Promise<string> {
  const db = await getDb();
  const photoId = crypto.randomUUID();
  const photo: StoredPhoto = {
    id: photoId,
    blob,
    fileName,
    linkedToId,
    createdAt: Date.now(),
  };
  await db.put('photos', photo);
  console.debug(`[Outbox] Stored photo blob (id=${photoId}, size=${blob.size}B)`);
  return photoId;
}

export async function getPhoto(photoId: string): Promise<StoredPhoto | undefined> {
  const db = await getDb();
  return db.get('photos', photoId);
}

export async function deletePhoto(photoId: string): Promise<void> {
  const db = await getDb();
  await db.delete('photos', photoId);
}
