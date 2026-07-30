/**
 * Outbox — Paradigm FMS Offline Layer
 *
 * All offline mutations are written here first.
 * The sync engine reads pending items and uploads them on reconnect.
 *
 * Status lifecycle:
 *   pending → syncing → synced  (success)
 *                     → failed  (validation / RLS error — visible, never dropped)
 */

import { getDb, type OutboxItem, type OutboxAction } from './db';

// ─── Enqueue ─────────────────────────────────────────────────────────────────

export interface EnqueueParams {
  /** Client-generated UUID — must be the record's permanent ID */
  id: string;
  tableName: string;
  action: OutboxAction;
  payload: Record<string, unknown>;
  /** Optional photo blob ID in the `photos` store */
  photoId?: string;
}

export async function enqueue(params: EnqueueParams): Promise<OutboxItem> {
  const db = await getDb();
  const item: OutboxItem = {
    id: params.id,
    tableName: params.tableName,
    action: params.action,
    payload: params.payload,
    photoId: params.photoId,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
  };
  await db.put('outbox', item);
  console.debug(`[Outbox] Enqueued ${params.action} → ${params.tableName} (id=${params.id})`);
  return item;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Returns all items with status `pending`, ordered by createdAt (FIFO), whose nextAttemptAt timestamp has passed. */
export async function getPending(): Promise<OutboxItem[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('outbox', 'by-status', 'pending');
  const now = Date.now();
  return all
    .filter((item) => !item.nextAttemptAt || item.nextAttemptAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Returns all items with status `failed`. */
export async function getFailed(): Promise<OutboxItem[]> {
  const db = await getDb();
  return db.getAllFromIndex('outbox', 'by-status', 'failed');
}

export async function getFailedCount(): Promise<number> {
  return (await getFailed()).length;
}

/** Returns ALL outbox items (any status) — used for UI display. */
export async function getAll(): Promise<OutboxItem[]> {
  const db = await getDb();
  return db.getAll('outbox');
}

// ─── Status updates ───────────────────────────────────────────────────────────

export async function markSyncing(id: string): Promise<void> {
  await _updateStatus(id, 'syncing');
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('outbox', id);
  console.debug(`[Outbox] Marked synced & removed: ${id}`);
}

export async function markFailed(id: string, reason: string, maxAttempts = 5): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;

  const nextAttempts = item.attempts + 1;
  const isTransient = /network|offline|timeout|fetch|connection|socket|502|503|504|429|econnreset|etimedout/i.test(reason);

  if (isTransient && nextAttempts < maxAttempts) {
    // Retryable with exponential backoff (2s, 4s, 8s, 16s, 32s, max 60s)
    const baseDelay = 2000;
    const expDelay = Math.min(baseDelay * Math.pow(2, nextAttempts - 1), 60000);
    const updated: OutboxItem = {
      ...item,
      status: 'pending',
      attempts: nextAttempts,
      failureReason: reason,
      nextAttemptAt: Date.now() + expDelay,
    };
    await db.put('outbox', updated);
    console.warn(`[Outbox] Transient failure (attempt ${nextAttempts}/${maxAttempts}), retrying in ${expDelay}ms: ${id} — ${reason}`);
  } else {
    // Permanent failure (RLS error, permission denied, schema error, or maxAttempts reached)
    const updated: OutboxItem = {
      ...item,
      status: 'failed',
      attempts: nextAttempts,
      failureReason: reason,
      nextAttemptAt: undefined,
    };
    await db.put('outbox', updated);
    console.warn(`[Outbox] Permanently marked failed (attempt ${nextAttempts}/${maxAttempts}): ${id} — ${reason}`);
  }
}

/** Resets a failed item back to pending for immediate manual retry. */
export async function retryFailedItem(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;
  const updated: OutboxItem = {
    ...item,
    status: 'pending',
    attempts: 0,
    failureReason: undefined,
    nextAttemptAt: undefined,
  };
  await db.put('outbox', updated);
  console.log(`[Outbox] Reset item for manual retry: ${id}`);
}

/** Discards a failed item, deleting it from outbox, photo store, and target IDB cache. */
export async function discardFailedItem(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;

  if (item.photoId) {
    await db.delete('photos', item.photoId).catch(() => {});
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
  }

  await db.delete('outbox', id);
  console.log(`[Outbox] Discarded item and cleaned cache: ${id}`);
}

/**
 * Cancels a local-only INSERT for the given ID without sending a DELETE to Supabase.
 *
 * Handles the edge case: "record was created offline and deleted offline before
 * it ever successfully synced." This covers two states:
 *
 *   - status === 'pending'  — never attempted; server has definitely never seen it
 *   - status === 'failed'   — attempted, rejected (e.g. RLS); server row was never
 *                             created, so a DELETE would target a non-existent row
 *
 * 'syncing' is excluded: the upload may already be in-flight and could have
 * reached Supabase. In that case, fall through to the normal DELETE path.
 *
 * Returns true and cleans up IDB if cancelled locally.
 * Returns false if no cancellable INSERT exists (safe to enqueue DELETE).
 */
export async function cancelPendingInsert(id: string): Promise<boolean> {
  const db = await getDb();
  const item = await db.get('outbox', id);

  // Cancel pending or failed INSERTs — both are local-only (server row never created).
  // Do NOT cancel 'syncing' — the upload may already be in-flight.
  const isCancellable =
    item &&
    item.action === 'INSERT' &&
    (item.status === 'pending' || item.status === 'failed');

  if (!isCancellable) {
    return false;
  }

  // Clean up the photo blob if one was attached
  if (item.photoId) {
    await db.delete('photos', item.photoId).catch(() => { /* non-fatal */ });
  }

  await db.delete('outbox', id);
  console.debug(`[Outbox] Cancelled local INSERT (status=${item.status}) for id=${id} — record never reached Supabase`);
  return true;
}


// ─── Photo helpers ────────────────────────────────────────────────────────────

import type { StoredPhoto } from './db';

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

// ─── Private helpers ──────────────────────────────────────────────────────────

async function _updateStatus(id: string, status: OutboxItem['status']): Promise<void> {
  const db = await getDb();
  const item = await db.get('outbox', id);
  if (!item) return;
  await db.put('outbox', { ...item, status });
}
