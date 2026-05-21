import { openDB, IDBPDatabase } from 'idb';
import { SQLiteConnection, SQLiteDBConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'paradigm_offline_db';
const DB_VERSION = 7;

export interface OutboxItem {
  id?: number;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPDATE_ASSETS' | 'UPDATE_TOOLS' | 'SAVE_SETTINGS';
  payload: any;
  timestamp: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
}

class OfflineDatabase {
  private idb: IDBPDatabase | null = null;
  private sqlite: SQLiteDBConnection | null = null;
  private isMobile: boolean;
  private _initPromise: Promise<void> | null = null;

  constructor() {
    this.isMobile = Capacitor.getPlatform() !== 'web';
  }

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    this._initPromise.catch(() => { this._initPromise = null; }); // allow retry on failure
    return this._initPromise;
  }

  /** Lazy-init guard — ensures DB is ready before any operation */
  private async ensureInit() {
    if (!this._initPromise) await this.init();
    else await this._initPromise;
  }

  private async _doInit() {
    if (this.isMobile) {
      await this.initSQLite();
    } else {
      await this.initIDB();
    }
  }

  private async initIDB() {
    try {
      this.idb = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          // Create outbox store
          let outboxStore;
          if (!db.objectStoreNames.contains('outbox')) {
            outboxStore = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
          } else {
            outboxStore = transaction.objectStore('outbox');
          }

          if (!outboxStore.indexNames.contains('status')) {
            outboxStore.createIndex('status', 'status');
          }

          // v7: Ensure retryCount field exists on existing records
          if (oldVersion < 7) {
            const cursor = outboxStore.openCursor();
            cursor.then(async (c) => {
              while (c) {
                if (c.value.retryCount === undefined) {
                  const updated = { ...c.value, retryCount: 0 };
                  c.update(updated);
                }
                c = await c.continue();
              }
            }).catch(() => { /* best-effort migration */ });
          }

          // Create cache store
          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache', { keyPath: 'key' });
          }
        },
      });
    } catch (error) {
      console.error('[OfflineDatabase] initIDB error:', error);
      throw error;
    }
  }

  private async runIDB<T>(operation: (db: IDBPDatabase) => Promise<T>): Promise<T> {
    if (!this.idb) {
      await this.initIDB();
    }
    try {
      return await operation(this.idb!);
    } catch (error: any) {
      // Re-initialize and retry once if the database connection was closed or is closing (due to Vite HMR or browser issues)
      if (error && (error.name === 'InvalidStateError' || error.message?.includes('closing') || error.message?.includes('closed'))) {
        console.warn('[OfflineDatabase] IDB connection closed or invalid. Reinitializing and retrying...', error);
        this.idb = null;
        await this.initIDB();
        return await operation(this.idb!);
      }
      throw error;
    }
  }

  private async initSQLite() {
    const connection = new SQLiteConnection(CapacitorSQLite);
    const isConn = (await connection.isConnection(DB_NAME, false)).result;

    if (isConn) {
      this.sqlite = await connection.retrieveConnection(DB_NAME, false);
    } else {
      this.sqlite = await connection.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
    }

    await this.sqlite.open();

    const createOutboxTable = `
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0
      );
    `;
    const createCacheTable = `
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `;

    await this.sqlite.execute(createOutboxTable);
    await this.sqlite.execute(createCacheTable);

    // v7 migration: add retry_count column to existing outbox tables
    try {
      await this.sqlite.execute(`ALTER TABLE outbox ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  async addToOutbox(item: Omit<OutboxItem, 'id' | 'status' | 'timestamp' | 'retryCount'>) {
    // Offline mode disabled — inform user immediately instead of queuing
    throw new Error('Not connected to the internet. Please check your connection and try again.');
  }

  async getPendingOutbox(): Promise<OutboxItem[]> {
    await this.ensureInit();
    if (this.isMobile && this.sqlite) {
      const res = await this.sqlite.query(`SELECT * FROM outbox WHERE status = 'pending' ORDER BY timestamp ASC`);
      return (res.values || []).map(v => ({
        ...v,
        payload: JSON.parse(v.payload),
        retryCount: v.retry_count ?? 0,
      }));
    } else {
      return await this.runIDB(db => db.getAllFromIndex('outbox', 'status', 'pending'));
    }
  }

  async getAllOutbox(): Promise<OutboxItem[]> {
    await this.ensureInit();
    if (this.isMobile && this.sqlite) {
      const res = await this.sqlite.query(`SELECT * FROM outbox ORDER BY timestamp DESC`);
      return (res.values || []).map(v => ({
        ...v,
        payload: JSON.parse(v.payload),
        retryCount: v.retry_count ?? 0,
      }));
    } else {
      return await this.runIDB(db => db.getAll('outbox'));
    }
  }

  async updateOutboxStatus(id: number, status: OutboxItem['status']) {
    await this.ensureInit();
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`UPDATE outbox SET status = ? WHERE id = ?`, [status, id]);
    } else {
      await this.runIDB(async db => {
        const item = await db.get('outbox', id);
        if (item) {
          item.status = status;
          await db.put('outbox', item);
        }
      });
    }
  }

  async deleteFromOutbox(id: number) {
    await this.ensureInit();
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`DELETE FROM outbox WHERE id = ?`, [id]);
    } else {
      await this.runIDB(db => db.delete('outbox', id));
    }
  }

  /** Alias for deleteFromOutbox (spec naming) */
  async deleteOutboxItem(id: number) {
    return this.deleteFromOutbox(id);
  }

  /** Update retry count for an outbox item */
  async updateOutboxRetryCount(id: number, retryCount: number) {
    await this.ensureInit();
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`UPDATE outbox SET retry_count = ? WHERE id = ?`, [retryCount, id]);
    } else {
      await this.runIDB(async db => {
        const item = await db.get('outbox', id);
        if (item) {
          item.retryCount = retryCount;
          await db.put('outbox', item);
        }
      });
    }
  }

  async setCache(key: string, value: any) {
    await this.ensureInit();
    const timestamp = new Date().toISOString();
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`INSERT OR REPLACE INTO cache (key, value, timestamp) VALUES (?, ?, ?)`, [key, JSON.stringify(value), timestamp]);
    } else {
      await this.runIDB(db => db.put('cache', { key, value, timestamp }));
    }
  }

  async getCache(key: string): Promise<any | null> {
    const meta = await this.getCacheWithMeta(key);
    return meta ? meta.value : null;
  }

  async deleteCache(key: string): Promise<void> {
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`DELETE FROM cache WHERE key = ?`, [key]);
    } else {
      await this.runIDB(db => db.delete('cache', key));
    }
  }

  async deleteOldDescriptors(userId: string): Promise<void> {
    // Ensuring no legacy keys exist for the user
    await this.deleteCache(`gate_user_${userId}`);
    await this.deleteCache(`face_descriptor_${userId}`);
  }

  async getCacheWithMeta(key: string): Promise<{ value: any; timestamp: string } | null> {
    await this.ensureInit();
    if (this.isMobile && this.sqlite) {
      const res = await this.sqlite.query(`SELECT value, timestamp FROM cache WHERE key = ?`, [key]);
      if (res.values && res.values.length > 0) {
        return { 
            value: JSON.parse(res.values[0].value), 
            timestamp: res.values[0].timestamp 
        };
      }
    } else {
      const item = await this.runIDB(db => db.get('cache', key));
      if (item) {
        return { value: item.value, timestamp: item.timestamp };
      }
    }
    return null;
  }

  async getCacheWithTimestamp(key: string): Promise<{ value: any; timestamp: string } | null> {
    if (this.isMobile && this.sqlite) {
      const res = await this.sqlite.query(`SELECT value, timestamp FROM cache WHERE key = ?`, [key]);
      return res.values?.[0] ? { value: JSON.parse(res.values[0].value), timestamp: res.values[0].timestamp } : null;
    } else {
      const res = await this.runIDB(db => db.get('cache', key));
      return res ? { value: res.value, timestamp: res.timestamp } : null;
    }
  }

  async setSyncTime(timestamp: string) {
    await this.setCache('last_sync_time', timestamp);
  }

  async getSyncTime(): Promise<string | null> {
    return await this.getCache('last_sync_time');
  }

  // ── Offline-First Helpers ──────────────────────────────────────────────────

  /** Track last successful online communication for 14-day offline auth window */
  async setLastOnlineTimestamp() {
    await this.setCache('last_online_timestamp', new Date().toISOString());
  }

  async getLastOnlineTimestamp(): Promise<string | null> {
    return await this.getCache('last_online_timestamp');
  }

  /** Check if we're within the allowed offline window (default 14 days) */
  async isOfflineSessionValid(maxDays = 14): Promise<boolean> {
    const timestamp = await this.getLastOnlineTimestamp();
    if (!timestamp) return false;
    const lastOnline = new Date(timestamp).getTime();
    const now = Date.now();
    const daysSince = (now - lastOnline) / (1000 * 60 * 60 * 24);
    return daysSince <= maxDays;
  }

  /** Number of pending items in the outbox (for sync status UI) */
  async getPendingOutboxCount(): Promise<number> {
    const items = await this.getPendingOutbox();
    return items.length;
  }

  /** Total outbox size including failed items */
  async getTotalOutboxCount(): Promise<number> {
    if (this.isMobile && this.sqlite) {
      const res = await this.sqlite.query(`SELECT COUNT(*) as count FROM outbox`);
      return res.values?.[0]?.count ?? 0;
    } else {
      return await this.runIDB(db => db.count('outbox'));
    }
  }

  /** Purge cache entries older than maxMonths (default 3) to free storage */
  async purgeOldCache(maxMonths = 3) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - maxMonths);
    const cutoffStr = cutoff.toISOString();

    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`DELETE FROM cache WHERE timestamp < ? AND key LIKE 'attendance_history_%'`, [cutoffStr]);
      await this.sqlite.run(`DELETE FROM cache WHERE timestamp < ? AND key LIKE 'today_events_%'`, [cutoffStr]);
    } else {
      await this.runIDB(async db => {
        const tx = db.transaction('cache', 'readwrite');
        const store = tx.objectStore('cache');
        const allKeys = await store.getAllKeys();
        for (const key of allKeys) {
          const item = await store.get(key);
          if (item && item.timestamp < cutoffStr) {
            const k = String(key);
            if (k.startsWith('attendance_history_') || k.startsWith('today_events_')) {
              await store.delete(key);
            }
          }
        }
        await tx.done;
      });
    }
  }

  /** Alias for purgeOldCache (spec naming) */
  async clearOldCache(months = 3) {
    return this.purgeOldCache(months);
  }

  /** Delete all completed (synced) outbox items to free space */
  async clearSyncedOutbox() {
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`DELETE FROM outbox WHERE status = 'syncing'`);
    } else {
      await this.runIDB(async db => {
        const items = await db.getAllFromIndex('outbox', 'status', 'syncing');
        const tx = db.transaction('outbox', 'readwrite');
        for (const item of items) {
          if (item.id) await tx.store.delete(item.id);
        }
        await tx.done;
      });
    }
  }
}

export const offlineDb = new OfflineDatabase();
