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
 * Schema version: 2 (added ppm_executions + onboarding_submissions stores)
 * Never mutate existing stores — bump DB_VERSION and add an `upgrade` branch instead.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { SnagEntry } from '../../types/operations';
import type { HTMasterOption, OfflineHTYardAuditRecord } from '../../types/htYard';
import type { PPMExecutionRecord } from '../../types/ppm';
import type { OnboardingData } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict' | 'auth_paused';
export type OutboxAction = 'UPSERT' | 'DELETE' | 'INSERT' | 'UPDATE';

export interface Attachment {
  /** Key in the IDB `photos` store */
  photoId: string;
  /** Dot-notated or direct target path in payload, e.g. 'snag_picture_url' or 'documents.aadhaar_url' */
  payloadPath: string;
  /** Deterministic cloud path: `${userId}/${table}/${recordId}/${key}.jpg` */
  storagePath: string;
  /** Set after successful upload so retries skip it */
  uploadedUrl?: string;
}

export interface OutboxError {
  kind: 'network' | 'auth' | 'permanent' | 'conflict';
  code?: string;
  message: string;
}

export interface OutboxItem {
  /** Client-generated UUID — also the record's permanent ID in Supabase */
  id: string;
  /** Business record ID (matches id) */
  recordId?: string;
  tableName: string;
  action: OutboxAction;
  payload: Record<string, unknown>;
  /** Legacy single photo ID in the `photos` store */
  photoId?: string;
  /** Rich multi-attachment list with deterministic paths */
  attachments?: Attachment[];
  /** Server version the edit was based on (for conflict detection) */
  baseUpdatedAt?: string;
  /** Prior client revision tokens preserved across coalesces */
  priorRevisions?: string[];
  /** Payload shape version, for app upgrades with queued items */
  schemaVersion?: number;
  /** Owner ID; drain and UI filter by current user to isolate data on shared devices */
  userId?: string;
  /** Device ISO timestamp when user initiated action */
  capturedAt?: string;
  status: OutboxStatus;
  /** Epoch ms when enqueued */
  createdAt: number;
  attempts: number;
  /** Last error message, populated on failure */
  failureReason?: string;
  /** Detailed error classification */
  lastError?: OutboxError;
  /** Epoch ms timestamp when next attempt can be performed (exponential backoff) */
  nextAttemptAt?: number;
  /** Optional parent record UUID for dependency ordering */
  dependsOn?: string;
}

export interface StoredPhoto {
  /** Matches the related OutboxItem.photoId or Attachment.photoId */
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
export const DB_VERSION = 5;

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
  ht_custom_field_specs: {
    key: string;
    value: any;
    indexes: { 'by-category': string };
  };
  ppm_executions: {
    key: string;
    value: PPMExecutionRecord;
  };
  onboarding_submissions: {
    key: string;
    value: OnboardingData & { pending?: boolean; failed?: boolean };
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-status': string; 'by-table': string; 'by-user': string };
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
    dbPromise = (async () => {
      // If browser supports querying existing IndexedDB databases, detect higher version
      let effectiveVersion = DB_VERSION;
      if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
        try {
          const dbs = await indexedDB.databases();
          const existing = dbs.find(d => d.name === DB_NAME);
          if (existing?.version && existing.version > effectiveVersion) {
            effectiveVersion = existing.version;
          }
        } catch {
          // Ignore and proceed with DB_VERSION
        }
      }

      const openWithVersion = (v: number) => {
        return openDB<ParadigmDB>(DB_NAME, v, {
          upgrade(db, oldVersion, _newVersion, transaction) {
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

            // ht_custom_field_specs (dynamic field definitions)
            if (!db.objectStoreNames.contains('ht_custom_field_specs')) {
              const fieldStore = db.createObjectStore('ht_custom_field_specs', { keyPath: 'id' });
              fieldStore.createIndex('by-category', 'category', { unique: false });
            }

            // ppm_executions
            if (!db.objectStoreNames.contains('ppm_executions')) {
              db.createObjectStore('ppm_executions', { keyPath: 'id' });
            }

            // onboarding_submissions
            if (!db.objectStoreNames.contains('onboarding_submissions')) {
              db.createObjectStore('onboarding_submissions', { keyPath: 'id' });
            }

            // outbox — the heart of the offline pattern
            if (!db.objectStoreNames.contains('outbox')) {
              const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
              outboxStore.createIndex('by-status', 'status', { unique: false });
              outboxStore.createIndex('by-table', 'tableName', { unique: false });
              outboxStore.createIndex('by-user', 'userId', { unique: false });
            } else {
              const outboxStore = transaction.objectStore('outbox');
              if (!outboxStore.indexNames.contains('by-user')) {
                outboxStore.createIndex('by-user', 'userId', { unique: false });
              }
            }

            // photos — Blob storage for offline photo attachments
            if (!db.objectStoreNames.contains('photos')) {
              const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
              photoStore.createIndex('by-linked', 'linkedToId', { unique: false });
            }
          },
        });
      };

      try {
        const db = await openWithVersion(effectiveVersion);
        return db;
      } catch (err: any) {
        // Self-healing recovery if browser IndexedDB already has a higher version
        if (err?.name === 'VersionError' || String(err?.message || '').includes('less than the existing version')) {
          const match = String(err?.message || '').match(/existing version\s*\((\d+)\)/i);
          const higherVersion = match ? parseInt(match[1], 10) : effectiveVersion + 1;
          console.warn(`[OfflineDB] Auto-recovering from VersionError: upgrading to existing version ${higherVersion}`);
          const db = await openWithVersion(higherVersion);
          return db;
        }
        throw err;
      }
    })().then((db) => {
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        navigator.storage.persist().then((granted) => {
          _storagePersistGranted = granted;
          if (granted) {
            console.info('[OfflineDB] Durable storage granted — IDB is eviction-safe.');
          } else {
            console.debug('[OfflineDB] Durable storage not granted — IDB is best-effort (expected on localhost/non-PWA).');
          }
        }).catch(() => {});
      } else {
        _storagePersistGranted = null;
      }
      return db;
    }).catch((finalErr) => {
      dbPromise = null;
      throw finalErr;
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


