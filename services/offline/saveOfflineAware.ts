/**
 * saveOfflineAware.ts — Unified Offline-Aware Save Wrapper
 *
 * The single entry point for writes in all 4 offline-enabled modules:
 *   - Snag Audit (`snag_audits`)
 *   - PPM Audit (`ppm_executions`)
 *   - Site Audit / HT Yard (`ht_yard_audits`)
 *   - New Enrollment (`onboarding_submissions`)
 *
 * Behavior:
 * 1. Always write locally to IDB first (Local-First).
 * 2. Try online save with a 10s timeout (if online and capture enabled).
 *    - On online success: removes any older outbox copy, returns 'synced'.
 *    - On business/RLS errors: throws immediately so form validation / permissions surface to the user.
 * 3. On network error / offline:
 *    - Stores attachments in IDB `photos` store with deterministic paths.
 *    - Enqueues into outbox with clean payload, baseUpdatedAt, and current user ID.
 *    - Returns 'queued'.
 */

import * as cache from './cache';
import * as outbox from './outbox';
import { isOnline } from './networkStatus';
import { isCaptureEnabled } from './featureFlag';
import { stripLocalFields, getCurrentUserId } from './syncEngine';
import type { Attachment } from './db';

export type SaveResult = 'synced' | 'queued';

export interface AttachmentInput {
  blob: Blob;
  payloadPath: string; // target field path in payload, e.g. 'snag_picture_url' or 'documents.aadhaar_url'
  key: string;         // e.g. 'photo' or 'aadhaar_card'
}

export interface SaveOfflineAwareOptions<T extends { id: string }> {
  table: 'onboarding_submissions' | 'snag_audits' | 'ht_yard_audits' | 'ppm_executions' | string;
  record: T;
  attachments?: AttachmentInput[];
  baseUpdatedAt?: string;
  onlineSave: (clean: T) => Promise<void>;
  timeoutMs?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wraps a promise with a timeout rejection */
export function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Request timed out after ${timeoutMs}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Unwraps a Supabase response tuple { data, error }.
 * Supabase SDK does NOT throw on network/HTTP errors by default — it returns { error }.
 * This helper ensures errors throw so the offline fallback catches them.
 */
export function unwrap<T>(res: { data: T | null; error: any }): T {
  if (res.error) {
    const message = res.error.message || res.error.details || JSON.stringify(res.error);
    const err: any = new Error(message);
    err.code = res.error.code;
    err.status = res.error.status;
    err.details = res.error.details;
    throw err;
  }
  return res.data as T;
}

/**
 * Returns true for genuine network reachability / connection failures.
 * Returns false for 4xx validation errors, Postgres constraints, and RLS denials.
 */
export function isNetworkError(e: unknown): boolean {
  if (!e) return false;

  const err = e as any;
  const message = String(err.message || '').toLowerCase();
  const name = String(err.name || '').toLowerCase();
  const status = Number(err.status || err.statusCode || 0);

  // Explicit non-network business errors (never queue these as network retry)
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return false;
  }
  if (err.code && /^23|^42/.test(String(err.code))) {
    // Postgres 23xxx (integrity constraint) or 42xxx (syntax/schema error)
    return false;
  }
  if (/row-level security|violates|not-null|foreign key|unique constraint|permission denied/i.test(message)) {
    return false;
  }

  // Network failures
  if (
    name === 'timeouterror' ||
    name === 'aborterror' ||
    name === 'typeerror' ||
    /failed to fetch|networkerror|load failed|network request failed|timeout|connection refused|socket hang up|econnreset|etimedout|502|503|504|429/i.test(
      message
    )
  ) {
    return true;
  }

  // If status is 0 or undefined and error occurred during fetch
  if (status === 0 || !status) {
    return true;
  }

  return false;
}

// ─── Main Save Wrapper ────────────────────────────────────────────────────────

export async function saveOfflineAware<T extends { id: string }>(
  opts: SaveOfflineAwareOptions<T>
): Promise<SaveResult> {
  const { table, record, attachments = [], baseUpdatedAt, onlineSave, timeoutMs = 10000 } = opts;
  const clientRevision =
    (record as any).client_revision ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9));

  const recordWithRev = {
    ...record,
    client_revision: clientRevision,
  };
  const clean = stripLocalFields(table, recordWithRev as Record<string, unknown>) as T;
  const userId = getCurrentUserId() || 'anonymous';

  // 1. Always write locally to IDB cache first
  await cache.put(table, clean);

  // 2. Try online with a timeout if internet is available and attachments don't require offline staging
  const canAttemptOnline = isCaptureEnabled() && isOnline();

  if (canAttemptOnline && attachments.length === 0) {
    try {
      await withTimeout(onlineSave(clean), timeoutMs);
      // Online save succeeded — clear any older queued copy
      await outbox.removeForRecord(table, record.id);
      return 'synced';
    } catch (err: unknown) {
      if (!isNetworkError(err)) {
        // Validation, RLS, or constraint error — must throw to the user immediately
        throw err;
      }
      console.warn(`[saveOfflineAware] Online save failed with network error, falling back to outbox:`, err);
    }
  }

  // 3. Fall back to the outbox (offline or network failure or attachments present)
  const storedAttachments: Attachment[] = [];
  for (const att of attachments) {
    const ext = att.blob.type.includes('png') ? 'png' : 'jpg';
    const storagePath = `${userId}/${table}/${record.id}/${att.key}.${ext}`;
    const stored = await outbox.storeAttachment(att.blob, att.payloadPath, storagePath);
    storedAttachments.push(stored);
  }

  await outbox.enqueue({
    id: record.id,
    tableName: table,
    action: 'UPSERT',
    payload: clean as Record<string, unknown>,
    attachments: storedAttachments.length > 0 ? storedAttachments : undefined,
    baseUpdatedAt,
    schemaVersion: 1,
    userId,
    capturedAt: new Date().toISOString(),
  });

  return 'queued';
}
