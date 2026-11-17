/**
 * Conflict Resolution Service — Paradigm Offline Hardening
 *
 * Provides safe resolution paths when concurrent edits or version mismatches occur:
 * 1. resolveKeepMine(outboxId)  — Re-bases client mutation on latest server state,
 *                                generates a fresh client_revision, and queues for sync.
 * 2. resolveUseServer(outboxId) — Discards the conflicting local mutation and updates
 *                                local cache with the latest server data.
 * 3. exportConflictDraft(id)    — Exports the unsaved local edits to a downloadable
 *                                JSON backup so field staff never lose data.
 */

import { supabase } from '../supabase';
import { getDb, type OutboxItem } from './db';
import { discardFailedItem, emitOutboxEvent } from './outbox';
import { syncEngine } from './syncEngine';

export interface ConflictDiffField {
  key: string;
  label: string;
  clientValue: unknown;
  serverValue: unknown;
  isDifferent: boolean;
}

export interface ConflictComparison {
  outboxItem: OutboxItem;
  serverRecord: Record<string, unknown> | null;
  fields: ConflictDiffField[];
  hasServerRecord: boolean;
}

/**
 * Fetches the current live server record for a conflicting outbox item.
 */
export async function fetchServerConflictRecord(
  tableName: string,
  recordId: string
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', recordId)
      .maybeSingle();

    if (error) {
      console.warn(`[ConflictActions] Error fetching server record for ${tableName}/${recordId}:`, error.message);
      return null;
    }
    return (data as Record<string, unknown>) || null;
  } catch (err) {
    console.warn('[ConflictActions] Network exception fetching server record:', err);
    return null;
  }
}

/**
 * Builds a structured field-by-field diff between local outbox payload and server record.
 */
export function buildConflictComparison(
  item: OutboxItem,
  serverRecord: Record<string, unknown> | null
): ConflictComparison {
  const clientPayload = item.payload || {};
  const server = serverRecord || {};

  // Collect all distinct keys (excluding internal metadata)
  const ignoredKeys = new Set([
    'created_at',
    'updated_at',
    'client_revision',
    'pending',
    'failed',
    'photoId',
    'attachments',
    'fcu_notes',
    'status_reason',
  ]);

  const allKeys = Array.from(
    new Set([...Object.keys(clientPayload), ...Object.keys(server)])
  ).filter((k) => !ignoredKeys.has(k) && !k.startsWith('_'));

  const fields: ConflictDiffField[] = allKeys.map((key) => {
    const clientVal = clientPayload[key];
    const serverVal = server[key];
    const isDifferent = JSON.stringify(clientVal) !== JSON.stringify(serverVal);

    // Humanize key label (e.g. "snag_description" -> "Snag Description")
    const label = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      key,
      label,
      clientValue: clientVal,
      serverValue: serverVal,
      isDifferent,
    };
  });

  // Sort: different fields first
  fields.sort((a, b) => (b.isDifferent ? 1 : 0) - (a.isDifferent ? 1 : 0));

  return {
    outboxItem: item,
    serverRecord,
    fields,
    hasServerRecord: Boolean(serverRecord),
  };
}

/**
 * Path 1: "Keep Mine"
 * Re-bases the user's local edits onto the latest server record,
 * assigns a fresh client_revision, and enqueues for immediate synchronization.
 */
export async function resolveKeepMine(outboxId: string): Promise<boolean> {
  const db = await getDb();
  const item = await db.get('outbox', outboxId);
  if (!item) {
    console.warn(`[ConflictActions] Item ${outboxId} not found in outbox`);
    return false;
  }

  // Fetch current server version to update baseUpdatedAt
  const serverRecord = await fetchServerConflictRecord(item.tableName, item.id);
  const now = Date.now();
  const freshRevision = `rev-${now}-${Math.random().toString(36).substring(2, 9)}`;

  // Update priorRevisions to track history
  const existingRevision = (item.payload?.client_revision as string) || undefined;
  const priorRevisions = [...(item.priorRevisions || [])];
  if (existingRevision && !priorRevisions.includes(existingRevision)) {
    priorRevisions.push(existingRevision);
  }

  const updatedPayload: Record<string, unknown> = {
    ...item.payload,
    client_revision: freshRevision,
  };

  const updatedItem: OutboxItem = {
    ...item,
    status: 'pending',
    attempts: 0,
    baseUpdatedAt: (serverRecord?.updated_at as string) || item.baseUpdatedAt || new Date().toISOString(),
    priorRevisions,
    payload: updatedPayload,
    failureReason: undefined,
    lastError: undefined,
    nextAttemptAt: undefined,
    leaseExpiresAt: undefined,
  };

  await db.put('outbox', updatedItem);
  emitOutboxEvent({ type: 'enqueued', item: updatedItem, timestamp: now });
  console.log(`[ConflictActions] Resolved conflict for ${item.id} with 'Keep Mine' (rev ${freshRevision})`);

  // Trigger sync in background
  syncEngine.drain().catch((err) => {
    console.warn('[ConflictActions] Auto-drain after Keep Mine warning:', err);
  });

  return true;
}

/**
 * Path 2: "Use Server"
 * Discards the local conflicting outbox item and refreshes local IDB domain cache
 * with the server's authoritative version.
 */
export async function resolveUseServer(outboxId: string): Promise<boolean> {
  const db = await getDb();
  const item = await db.get('outbox', outboxId);
  if (!item) {
    console.warn(`[ConflictActions] Item ${outboxId} not found in outbox`);
    return false;
  }

  // 1. Fetch server state to update local cache
  const serverRecord = await fetchServerConflictRecord(item.tableName, item.id);

  // 2. Discard local conflicting outbox item & attached local photo blobs
  await discardFailedItem(outboxId);

  // 3. Update local IDB cache if server row is available
  if (serverRecord) {
    try {
      if (item.tableName === 'snag_audits') {
        const { cacheSnagEntry } = await import('./cache');
        await cacheSnagEntry(serverRecord as any);
      } else if (item.tableName === 'ppm_executions') {
        const { cachePpmExecution } = await import('./cache');
        await cachePpmExecution(serverRecord as any);
      } else if (item.tableName === 'ht_yard_audits') {
        const { cacheHtYardAudit } = await import('./cache');
        await cacheHtYardAudit(serverRecord as any);
      } else if (item.tableName === 'onboarding_submissions') {
        const { cacheOnboardingSubmission } = await import('./cache');
        await cacheOnboardingSubmission(serverRecord as any);
      }
    } catch (cacheErr) {
      console.warn('[ConflictActions] Cache update after Use Server warning:', cacheErr);
    }
  }

  console.log(`[ConflictActions] Resolved conflict for ${item.id} with 'Use Server'`);
  return true;
}

/**
 * Path 3: "Export Draft"
 * Creates a structured JSON export of the user's conflicting edits so they can be saved
 * locally before the record is overwritten or discarded.
 */
export async function exportConflictDraft(
  outboxId: string
): Promise<{ success: boolean; filename: string; jsonContent: string }> {
  const db = await getDb();
  const item = await db.get('outbox', outboxId);
  if (!item) {
    throw new Error(`Outbox item ${outboxId} not found`);
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    recordId: item.id,
    tableName: item.tableName,
    action: item.action,
    capturedAt: item.capturedAt || new Date(item.createdAt).toISOString(),
    userId: item.userId,
    status: item.status,
    failureReason: item.failureReason,
    payload: item.payload,
    attachments: (item.attachments || []).map((a) => ({
      path: a.storagePath,
      payloadPath: a.payloadPath,
    })),
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `paradigm_conflict_draft_${item.tableName}_${item.id.slice(0, 8)}_${timestamp}.json`;

  // Download directly on web/browser if available
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (dlErr) {
      console.warn('[ConflictActions] Web download exception:', dlErr);
    }
  }

  return { success: true, filename, jsonContent };
}
