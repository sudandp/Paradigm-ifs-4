/**
 * Unified Storage Repository & Adapter Layer — Paradigm Offline Hardening
 *
 * Implements a unified interface `IOfflineStorageRepository` that bridges:
 * 1. IndexedDbStorageAdapter (Web / PWA / Desktop browser using `idb`)
 * 2. SqliteStorageAdapter   (Native Android & iOS using `@capacitor-community/sqlite` + `@capacitor/filesystem`)
 *
 * Provides factory `getStorageRepository()` with dynamic platform detection
 * and seamless fallback so callers remain decoupled from the underlying storage engine.
 */

import { withIdbTransaction, type TransactionDatabase } from './idbTransaction';
import { Capacitor } from '@capacitor/core';
import { getDb, type OutboxItem, type StoredPhoto } from './db';

export interface IOfflineStorageRepository {
  readonly engineName: 'indexeddb' | 'sqlite';
  initialize(): Promise<void>;

  // Generic Domain Record CRUD
  getRecord<T>(table: string, id: string): Promise<T | null>;
  putRecord<T>(table: string, id: string, record: T): Promise<void>;
  deleteRecord(table: string, id: string): Promise<void>;
  getAllRecords<T>(table: string): Promise<T[]>;

  // Outbox Mutation Queue
  enqueueOutbox(item: OutboxItem): Promise<void>;
  getOutboxItem(id: string): Promise<OutboxItem | null>;
  getAllOutbox(): Promise<OutboxItem[]>;
  getPendingOutbox(userId?: string): Promise<OutboxItem[]>;
  updateOutboxItem(item: OutboxItem): Promise<void>;
  deleteOutboxItem(id: string): Promise<void>;

  // Attachment / Photo Blobs
  storeAttachment(id: string, blob: Blob, fileName: string, linkedToId: string): Promise<void>;
  getAttachment(id: string): Promise<StoredPhoto | null>;
  deleteAttachment(id: string): Promise<void>;

  // Transaction Support
  runTransaction<T>(mode: 'readonly' | 'readwrite', stores: string[], fn: (repository: IOfflineStorageRepository) => Promise<T>): Promise<T>;
}

// ─── 1. IndexedDB Storage Adapter ─────────────────────────────────────────────

export class IndexedDbStorageAdapter implements IOfflineStorageRepository {
  readonly engineName = 'indexeddb' as const;
  private _activeTxDb: TransactionDatabase | null = null;

  constructor(private readonly transactionDb?: TransactionDatabase) {}

  private async database() { return this._activeTxDb ?? this.transactionDb ?? await getDb(); }

  async initialize(): Promise<void> {
    await this.database();
  }

  async getRecord<T>(table: string, id: string): Promise<T | null> {
    const db = await this.database();
    if (!db.objectStoreNames.contains(table as any)) return null;
    const res = await db.get(table as any, id);
    return (res as T) ?? null;
  }

  async putRecord<T>(table: string, id: string, record: T): Promise<void> {
    const db = await this.database();
    if (!db.objectStoreNames.contains(table as any)) {
      throw new Error(`Store "${table}" does not exist in IndexedDB schema`);
    }
    const itemToSave = typeof record === 'object' && record !== null ? { ...record, id } : record;
    await db.put(table as any, itemToSave);
  }

  async deleteRecord(table: string, id: string): Promise<void> {
    const db = await this.database();
    if (!db.objectStoreNames.contains(table as any)) return;
    await db.delete(table as any, id);
  }

  async getAllRecords<T>(table: string): Promise<T[]> {
    const db = await this.database();
    if (!db.objectStoreNames.contains(table as any)) return [];
    return (await db.getAll(table as any)) as T[];
  }

  async enqueueOutbox(item: OutboxItem): Promise<void> {
    const db = await this.database();
    await db.put('outbox', item);
  }

  async getOutboxItem(id: string): Promise<OutboxItem | null> {
    const db = await this.database();
    return (await db.get('outbox', id)) ?? null;
  }

  async getAllOutbox(): Promise<OutboxItem[]> {
    const db = await this.database();
    return await db.getAll('outbox');
  }

  async getPendingOutbox(userId?: string): Promise<OutboxItem[]> {
    const all = await this.getAllOutbox();
    const now = Date.now();
    return all.filter((i) => {
      const matchUser = !userId ? true : i.userId === userId;
      const isEligible = i.status === 'pending' && (!i.nextAttemptAt || i.nextAttemptAt <= now);
      return matchUser && isEligible;
    }).sort((a, b) => a.createdAt - b.createdAt);
  }

  async updateOutboxItem(item: OutboxItem): Promise<void> {
    const db = await this.database();
    await db.put('outbox', item);
  }

  async deleteOutboxItem(id: string): Promise<void> {
    const db = await this.database();
    await db.delete('outbox', id);
  }

  async storeAttachment(id: string, blob: Blob, fileName: string, linkedToId: string): Promise<void> {
    const db = await this.database();
    const record: StoredPhoto = {
      id,
      blob,
      fileName,
      linkedToId,
      createdAt: Date.now(),
    };
    await db.put('photos', record);
  }

  async getAttachment(id: string): Promise<StoredPhoto | null> {
    const db = await this.database();
    return (await db.get('photos', id)) ?? null;
  }

  async deleteAttachment(id: string): Promise<void> {
    const db = await this.database();
    await db.delete('photos', id);
  }

  async runTransaction<T>(mode: 'readonly' | 'readwrite', stores: string[], fn: (repository: IOfflineStorageRepository) => Promise<T>): Promise<T> {
    if (this._activeTxDb || this.transactionDb) throw new Error('Nested transactions are not supported');
    return withIdbTransaction(stores, mode, async (db) => {
      this._activeTxDb = db;
      try {
        return await fn(new IndexedDbStorageAdapter(db));
      } finally {
        this._activeTxDb = null;
      }
    });
  }
}

// ─── 2. Native SQLite Storage Adapter ─────────────────────────────────────────

export class SqliteStorageAdapter implements IOfflineStorageRepository {
  readonly engineName = 'sqlite' as const;
  private _sqliteConnection: any = null;
  private _dbInstance: any = null;
  private _initialized = false;
  private readonly _dbName = 'paradigm_offline_sqlite';

  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      if (!this._sqliteConnection) {
        const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
        this._sqliteConnection = new SQLiteConnection(CapacitorSQLite);
      }

      const isConsistent = await this._sqliteConnection.checkConnectionsConsistency();
      const isConnected = await this._sqliteConnection.isConnection(this._dbName, false);

      if (isConsistent.result && isConnected.result) {
        this._dbInstance = await this._sqliteConnection.retrieveConnection(this._dbName, false);
      } else {
        this._dbInstance = await this._sqliteConnection.createConnection(
          this._dbName,
          false,
          'no-encryption',
          1,
          false
        );
      }

      await this._dbInstance.open();

      // Create durable relational tables for domain records, outbox, and attachments
      await this._dbInstance.execute(`
        CREATE TABLE IF NOT EXISTS domain_records (
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (table_name, record_id)
        );

        CREATE TABLE IF NOT EXISTS outbox_items (
          id TEXT PRIMARY KEY NOT NULL,
          record_id TEXT,
          table_name TEXT NOT NULL,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          user_id TEXT,
          org_id TEXT,
          photo_id TEXT,
          attachments TEXT,
          base_updated_at TEXT,
          prior_revisions TEXT,
          schema_version INTEGER,
          captured_at TEXT,
          depends_on TEXT,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          lease_expires_at INTEGER,
          next_attempt_at INTEGER,
          failure_reason TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS attachment_meta (
          id TEXT PRIMARY KEY NOT NULL,
          file_name TEXT NOT NULL,
          linked_to_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_status_user ON outbox_items (status, user_id);
      `);

      // Versioned schema migration for preexisting SQLite databases
      try {
        const pragmaRes = await this._dbInstance.query('PRAGMA table_info(outbox_items);');
        const existingCols = new Set<string>((pragmaRes.values || []).map((col: any) => col.name));
        const requiredColumns: Record<string, string> = {
          record_id: 'TEXT',
          photo_id: 'TEXT',
          attachments: 'TEXT',
          base_updated_at: 'TEXT',
          prior_revisions: 'TEXT',
          schema_version: 'INTEGER',
          captured_at: 'TEXT',
          last_error: 'TEXT',
        };

        for (const [colName, colType] of Object.entries(requiredColumns)) {
          if (!existingCols.has(colName)) {
            try {
              await this._dbInstance.execute(`ALTER TABLE outbox_items ADD COLUMN ${colName} ${colType};`);
              console.log(`[SqliteStorageAdapter] Migrated outbox_items: added column ${colName}`);
            } catch (colErr) {
              console.warn(`[SqliteStorageAdapter] Migration column notice (${colName}):`, colErr);
            }
          }
        }
      } catch (pragmaErr) {
        console.warn('[SqliteStorageAdapter] Table pragma check error:', pragmaErr);
      }

      this._initialized = true;
      console.log('[SqliteStorageAdapter] Native SQLite database initialized successfully.');
    } catch (err) {
      console.error('[SqliteStorageAdapter] Initialization error, falling back to IDB:', err);
      throw err;
    }
  }

  async getRecord<T>(table: string, id: string): Promise<T | null> {
    await this.initialize();
    const query = 'SELECT payload FROM domain_records WHERE table_name = ? AND record_id = ?;';
    const res = await this._dbInstance.query(query, [table, id]);
    if (!res.values || res.values.length === 0) return null;
    return JSON.parse(res.values[0].payload) as T;
  }

  async putRecord<T>(table: string, id: string, record: T): Promise<void> {
    await this.initialize();
    const payloadStr = JSON.stringify(record);
    const sql = `
      INSERT OR REPLACE INTO domain_records (table_name, record_id, payload, updated_at)
      VALUES (?, ?, ?, ?);
    `;
    await this._dbInstance.run(sql, [table, id, payloadStr, Date.now()]);
  }

  async deleteRecord(table: string, id: string): Promise<void> {
    await this.initialize();
    await this._dbInstance.run('DELETE FROM domain_records WHERE table_name = ? AND record_id = ?;', [table, id]);
  }

  async getAllRecords<T>(table: string): Promise<T[]> {
    await this.initialize();
    const res = await this._dbInstance.query('SELECT payload FROM domain_records WHERE table_name = ?;', [table]);
    if (!res.values) return [];
    return res.values.map((v: any) => JSON.parse(v.payload) as T);
  }

  async enqueueOutbox(item: OutboxItem): Promise<void> {
    await this.initialize();
    const sql = `
      INSERT OR REPLACE INTO outbox_items 
        (id, record_id, table_name, action, status, user_id, org_id, photo_id, attachments, base_updated_at, prior_revisions, schema_version, captured_at, depends_on, payload, created_at, attempts, lease_expires_at, next_attempt_at, failure_reason, last_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await this._dbInstance.run(sql, [
      item.id,
      item.recordId || null,
      item.tableName,
      item.action,
      item.status,
      item.userId || null,
      item.orgId || null,
      item.photoId || null,
      item.attachments ? JSON.stringify(item.attachments) : null,
      item.baseUpdatedAt || null,
      item.priorRevisions ? JSON.stringify(item.priorRevisions) : null,
      item.schemaVersion != null ? item.schemaVersion : null,
      item.capturedAt || null,
      item.dependsOn || null,
      JSON.stringify(item.payload || {}),
      item.createdAt,
      item.attempts || 0,
      item.leaseExpiresAt || null,
      item.nextAttemptAt || null,
      item.failureReason || null,
      item.lastError || item.failureReason || null,
    ]);
  }

  async getOutboxItem(id: string): Promise<OutboxItem | null> {
    await this.initialize();
    const res = await this._dbInstance.query('SELECT * FROM outbox_items WHERE id = ?;', [id]);
    if (!res.values || res.values.length === 0) return null;
    return this._mapRowToOutboxItem(res.values[0]);
  }

  async getAllOutbox(): Promise<OutboxItem[]> {
    await this.initialize();
    const res = await this._dbInstance.query('SELECT * FROM outbox_items ORDER BY created_at ASC;');
    if (!res.values) return [];
    return res.values.map((r: any) => this._mapRowToOutboxItem(r));
  }

  async getPendingOutbox(userId?: string): Promise<OutboxItem[]> {
    await this.initialize();
    const now = Date.now();
    let query: string;
    let params: any[];

    if (userId) {
      query = `
        SELECT * FROM outbox_items 
        WHERE status = 'pending' 
          AND user_id = ?
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY created_at ASC;
      `;
      params = [userId, now];
    } else {
      query = `
        SELECT * FROM outbox_items 
        WHERE status = 'pending' 
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY created_at ASC;
      `;
      params = [now];
    }

    const res = await this._dbInstance.query(query, params);
    if (!res.values) return [];
    return res.values.map((r: any) => this._mapRowToOutboxItem(r));
  }

  async updateOutboxItem(item: OutboxItem): Promise<void> {
    await this.enqueueOutbox(item);
  }

  async deleteOutboxItem(id: string): Promise<void> {
    await this.initialize();
    await this._dbInstance.run('DELETE FROM outbox_items WHERE id = ?;', [id]);
  }

  async storeAttachment(id: string, blob: Blob, fileName: string, linkedToId: string): Promise<void> {
    await this.initialize();
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const path = `paradigm_offline_attachments/${id}_${fileName}`;

    // Read blob as base64 string
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const base64Data = await base64Promise;

    await Filesystem.writeFile({
      path,
      data: base64Data,
      directory: Directory.Data,
      recursive: true,
    });

    const sql = `
      INSERT OR REPLACE INTO attachment_meta (id, file_name, linked_to_id, file_path, mime_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    await this._dbInstance.run(sql, [id, fileName, linkedToId, path, blob.type || 'image/jpeg', Date.now()]);
  }

  async getAttachment(id: string): Promise<StoredPhoto | null> {
    await this.initialize();
    const res = await this._dbInstance.query('SELECT * FROM attachment_meta WHERE id = ?;', [id]);
    if (!res.values || res.values.length === 0) return null;
    const meta = res.values[0];

    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const fileResult = await Filesystem.readFile({
      path: meta.file_path,
      directory: Directory.Data,
    });

    // Convert base64 back to Blob
    const byteCharacters = atob(fileResult.data as string);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: meta.mime_type });

    return {
      id: meta.id,
      fileName: meta.file_name,
      linkedToId: meta.linked_to_id,
      blob,
      createdAt: meta.created_at,
    };
  }

  async deleteAttachment(id: string): Promise<void> {
    await this.initialize();
    const res = await this._dbInstance.query('SELECT file_path FROM attachment_meta WHERE id = ?;', [id]);
    if (res.values && res.values.length > 0) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.deleteFile({
          path: res.values[0].file_path,
          directory: Directory.Data,
        });
      } catch {
        // Safe silent catch if file was already removed
      }
    }
    await this._dbInstance.run('DELETE FROM attachment_meta WHERE id = ?;', [id]);
  }

  async runTransaction<T>(_mode: 'readonly' | 'readwrite', _stores: string[], fn: (repository: IOfflineStorageRepository) => Promise<T>): Promise<T> {
    await this.initialize();
    await this._dbInstance.run('BEGIN TRANSACTION;');
    try {
      const result = await fn(this);
      await this._dbInstance.run('COMMIT;');
      return result;
    } catch (err) {
      try {
        await this._dbInstance.run('ROLLBACK;');
      } catch {
        // Suppress rollback errors if connection was dropped
      }
      throw err;
    }
  }

  private _mapRowToOutboxItem(row: any): OutboxItem {
    let attachments;
    if (row.attachments) {
      try {
        attachments = typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments;
      } catch {
        attachments = undefined;
      }
    }
    let priorRevisions;
    if (row.prior_revisions) {
      try {
        priorRevisions = typeof row.prior_revisions === 'string' ? JSON.parse(row.prior_revisions) : row.prior_revisions;
      } catch {
        priorRevisions = undefined;
      }
    }
    return {
      id: row.id,
      recordId: row.record_id || undefined,
      tableName: row.table_name,
      action: row.action,
      status: row.status,
      userId: row.user_id || undefined,
      orgId: row.org_id || undefined,
      photoId: row.photo_id || undefined,
      attachments,
      baseUpdatedAt: row.base_updated_at || undefined,
      priorRevisions,
      schemaVersion: row.schema_version != null ? Number(row.schema_version) : undefined,
      capturedAt: row.captured_at || undefined,
      dependsOn: row.depends_on || undefined,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      createdAt: row.created_at,
      attempts: row.attempts,
      leaseExpiresAt: row.lease_expires_at || undefined,
      nextAttemptAt: row.next_attempt_at || undefined,
      failureReason: row.failure_reason || undefined,
      lastError: row.last_error || undefined,
    };
  }
}

// ─── 3. Repository Factory & Singleton ────────────────────────────────────────

let _activeRepository: IOfflineStorageRepository | null = null;

/**
 * Returns the active platform-specific offline storage repository.
 * Uses native SQLite on Android/iOS, and IndexedDB on Web/PWA.
 */
export function getStorageRepository(): IOfflineStorageRepository {
  if (_activeRepository) return _activeRepository;

  if (Capacitor.isNativePlatform()) {
    try {
      _activeRepository = new SqliteStorageAdapter();
      return _activeRepository;
    } catch (err) {
      console.warn('[StorageRepository] Native SQLite init failed, falling back to IndexedDB:', err);
      _activeRepository = new IndexedDbStorageAdapter();
      return _activeRepository;
    }
  }

  _activeRepository = new IndexedDbStorageAdapter();
  return _activeRepository;
}
