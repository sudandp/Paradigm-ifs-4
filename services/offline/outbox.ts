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

    // Clean up orphaned legacy photo if replaced
    if (existing.photoId && existing.photoId !== params.photoId) {
      await db.delete('photos', existing.photoId).catch(() => {});
    }

    // Clean up orphaned attachments
    if (existing.attachments && params.attachments) {
      const newPhotoIds = new Set(params.attachments.map((a) => a.photoId));
      for (const oldAtt of existing.attachments) {
        if (!newPhotoIds.has(oldAtt.photoId)) {
          await db.delete('photos', oldAtt.photoId).catch(() => {});
        }
      }
    }
  }

  const priorRevisions = Array.from(revisionsSet).filter(Boolean);

  const item: OutboxItem = {
    id: params.id,
    recordId: params.id,
    tableName: params.tableName,
    action: params.action || 'UPSERT',
    payload: params.payload,
    photoId: params.photoId,
    attachments: params.attachments,
    baseUpdatedAt,
    priorRevisions: priorRevisions.length > 0 ? priorRevisions : undefined,
    schemaVersion: params.schemaVersion || 1,
    userId: params.userId,
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
  console.debug(`[Outbox] Enqueued ${item.action} → ${item.tableName} (id=${params.id})`);
  emitOutboxEvent({ type: 'enqueued', item, timestamp: Date.now() });
  return item;
}

// ─── Read & Query ─────────────────────────────────────────────────────────────

/** Returns all pending items ordered by createdAt (FIFO) whose nextAttemptAt has passed. */
export async function getPending(userId?: string): Promise<OutboxItem[]> {
  const db = await getDb();
  let all: OutboxItem[];
  if (userId) {
    try {
      all = await db.getAllFromIndex('outbox', 'by-user', userId);
    } catch {
      all = await db.getAll('outbox');
      all = all.filter((i) => !i.userId || i.userId === userId);
    }
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
      all = all.filter((i) => !i.userId || i.userId === userId);
    }
  } else {
    all = await db.getAllFromIndex('outbox', 'by-status', 'failed');
  }
  return all.filter((i) => i.status === 'failed');
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

export async function markSyncing(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;
  const updated: OutboxItem = { ...item, status: 'syncing' };
  await db.put('outbox', updated);
  emitOutboxEvent({ type: 'syncing', item: updated, timestamp: Date.now() });
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  await db.delete('outbox', id);
  console.debug(`[Outbox] Marked synced & removed: ${id}`);
  emitOutboxEvent({ type: 'synced', item: item || ({ id, status: 'synced' } as any), timestamp: Date.now() });
}

/** Removes an outbox item for a record when an online save succeeds. */
export async function removeForRecord(tableName: string, recordId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('outbox', recordId);
  if (existing && existing.tableName === tableName) {
    if (existing.photoId) {
      await db.delete('photos', existing.photoId).catch(() => {});
    }
    if (existing.attachments) {
      for (const att of existing.attachments) {
        await db.delete('photos', att.photoId).catch(() => {});
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

/** Discards all currently failed items from the outbox. */
export async function clearAllFailed(): Promise<number> {
  const failed = await getFailed();
  for (const item of failed) {
    await discardFailedItem(item.id);
  }
  console.log(`[Outbox] Cleared ${failed.length} failed items`);
  return failed.length;
}

/** Automatically prunes stale or fatal failed items (older than 24 hours or maxAttempts exceeded) */
export async function pruneStaleFailedItems(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const failed = await getFailed();
    const now = Date.now();
    let pruned = 0;
    for (const item of failed) {
      const isStale = now - item.createdAt > maxAgeMs;
      const reason = item.failureReason || '';
      const isFatal =
        item.attempts >= 3 &&
        /violates|column.*does not exist|foreign key|invalid input|relation.*does not exist|permission denied|row-level security|schema cache/i.test(reason);
      if (isStale || isFatal) {
        await discardFailedItem(item.id);
        pruned++;
      }
    }
    if (pruned > 0) {
      console.log(`[Outbox] Auto-pruned ${pruned} stale or fatal failed outbox items`);
    }
    return pruned;
  } catch (err) {
    console.warn('[Outbox] Error pruning stale failed items:', err);
    return 0;
  }
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
