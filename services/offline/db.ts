/**
 * Offline Database — Paradigm FMS
 *
 * Uses the `idb` package (already installed) to open a structured IndexedDB
 * database called `paradigmOfflineDB`.
 *
 * Stores:
 *   - snag_audits      : local mirror of snag_audits rows
 *   - ht_yard_audits   : local mirror of ht_yard_audits rows
 *   - ht_master_options: local mirror of ht_master_options rows (cache)
 *   - outbox           : pending mutations to be synced to Supabase
 *   - photos           : photo Blobs linked to outbox items
 *
 * Schema version: 1
 * Never mutate v1 stores — bump DB_VERSION and add an `upgrade` branch instead.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { SnagEntry } from '../../types/operations';
import type { HTMasterOption, OfflineHTYardAuditRecord } from '../../types/htYard';
import type { PPMExecutionRecord } from '../../types/ppm';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type OutboxAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OutboxItem {
  /** Client-generated UUID — also the record's permanent ID in Supabase */
  id: string;
  tableName: string;
  action: OutboxAction;
  payload: Record<string, unknown>;
  /** ID of a related photo blob in the `photos` store, if any */
  photoId?: string;
  status: OutboxStatus;
  /** Epoch ms when enqueued */
  createdAt: number;
  attempts: number;
  /** Last Supabase error message, populated on failure */
  failureReason?: string;
  /** Epoch ms timestamp when next attempt can be performed (exponential backoff) */
  nextAttemptAt?: number;
}

export interface StoredPhoto {
  /** Matches the related OutboxItem.photoId */
  id: string;
  /** Raw photo Blob — IndexedDB stores Blobs natively */
  blob: Blob;
  fileName: string;
  /** ID of the record this photo belongs to */
  linkedToId: string;
  createdAt: number;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const DB_NAME = 'paradigmOfflineDB';
const DB_VERSION = 1;

export interface ParadigmDB {
  snag_audits: {
    key: string;
    value: SnagEntry & { pending?: boolean };
  };
  ht_yard_audits: {
    key: string;
    value: OfflineHTYardAuditRecord;
  };
  ht_master_options: {
    key: string;
    value: HTMasterOption;
    indexes: { 'by-category': string };
  };
  ppm_executions: {
    key: string;
    value: PPMExecutionRecord;
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-status': string; 'by-table': string };
  };
  photos: {
    key: string;
    value: StoredPhoto;
    indexes: { 'by-linked': string };
  };
}

// ─── Singleton connection ─────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<ParadigmDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ParadigmDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ParadigmDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // snag_audits
        if (!db.objectStoreNames.contains('snag_audits')) {
          db.createObjectStore('snag_audits', { keyPath: 'id' });
        }

        // ht_yard_audits
        if (!db.objectStoreNames.contains('ht_yard_audits')) {
          db.createObjectStore('ht_yard_audits', { keyPath: 'id' });
        }

        // ht_master_options (read-through cache)
        if (!db.objectStoreNames.contains('ht_master_options')) {
          const store = db.createObjectStore('ht_master_options', { keyPath: 'id' });
          store.createIndex('by-category', 'category', { unique: false });
        }

        // ppm_executions
        if (!db.objectStoreNames.contains('ppm_executions')) {
          db.createObjectStore('ppm_executions', { keyPath: 'id' });
        }

        // outbox — the heart of the offline pattern
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('by-status', 'status', { unique: false });
          outboxStore.createIndex('by-table', 'tableName', { unique: false });
        }

        // photos — Blob storage for offline photo attachments
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
          photoStore.createIndex('by-linked', 'linkedToId', { unique: false });
        }
      },
    }).then((db) => {
      // Request durable (non-evictable) storage.
      // Without this, iOS Safari / Android Chrome may evict IDB data —
      // including photo Blobs — under OS memory pressure or when the app
      // is not installed as a PWA ("best-effort" bucket is evictable).
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        navigator.storage.persist().then((granted) => {
          _storagePersistGranted = granted;
          if (granted) {
            console.info('[OfflineDB] Durable storage granted — IDB is eviction-safe.');
          } else {
            console.warn('[OfflineDB] Durable storage denied — IDB data may be evicted under OS pressure.');
          }
        });
      } else {
        // Storage persistence API not available (e.g. older browser)
        _storagePersistGranted = null;
      }
      return db;
    });
  }
  return dbPromise;
}

/**
 * Returns the result of navigator.storage.persist():
 *   true  = durable storage granted (IDB is eviction-safe)
 *   false = denied (IDB may be evicted — show a warning to the user)
 *   null  = API not available or check not yet complete
 *
 * The UI layer (syncEngine.start) reads this and decides how to surface it.
 */
export function getStoragePersistenceState(): boolean | null {
  return _storagePersistGranted;
}

/** Module-level cache of the storage.persist() result. */
let _storagePersistGranted: boolean | null = null;


